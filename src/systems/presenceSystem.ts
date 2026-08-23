import { ConversationLanguage, GameState, PresenceState, RelationshipModel, UserRoutine } from '../types';

const MIN_RETURN_GREETING_MS = 10 * 60_000;

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function calendarDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function createPresenceState(now = Date.now()): PresenceState {
  return {
    firstOpenedAt: now,
    lastOpenedAt: now,
    sessionCount: 1,
    returnCount: 0,
    currentStreak: 1,
    longestStreak: 1,
    lastVisitDay: dayKey(now),
    pendingGreeting: null,
  };
}

export function migratePresenceState(value: Partial<PresenceState> | null | undefined, fallbackTimestamp = Date.now()): PresenceState {
  const base = createPresenceState(fallbackTimestamp);
  if (!value) return base;
  return {
    firstOpenedAt: Number.isFinite(value.firstOpenedAt) ? Number(value.firstOpenedAt) : fallbackTimestamp,
    lastOpenedAt: Number.isFinite(value.lastOpenedAt) ? Number(value.lastOpenedAt) : fallbackTimestamp,
    sessionCount: Math.max(1, Number(value.sessionCount) || 1),
    returnCount: Math.max(0, Number(value.returnCount) || 0),
    currentStreak: Math.max(1, Number(value.currentStreak) || 1),
    longestStreak: Math.max(1, Number(value.longestStreak) || 1),
    lastVisitDay: typeof value.lastVisitDay === 'string' && value.lastVisitDay ? value.lastVisitDay : dayKey(fallbackTimestamp),
    pendingGreeting: typeof value.pendingGreeting === 'string' ? value.pendingGreeting.slice(0, 240) : null,
  };
}

function greeting(language: ConversationLanguage, name: string | null, awayMs: number, familiarHour: boolean): string {
  const polish = language === 'pl';
  const who = name || (polish ? 'Hej' : 'Hey');
  if (awayMs >= 3 * 86_400_000) {
    return polish
      ? `${who}… jesteś. W pokoju było bardzo cicho. Co się u ciebie działo?`
      : `${who}… you are here. The room was very quiet. What happened while you were away?`;
  }
  if (awayMs >= 18 * 60 * 60_000) {
    return polish
      ? `Dobrze cię znowu widzieć. Mam wrażenie, że minął cały dzień. Jak wracasz?`
      : `It is good to see you again. It feels like a whole day passed. How are you coming back?`;
  }
  if (awayMs >= 2 * 60 * 60_000) {
    return polish
      ? `Wróciłeś. Zastanawiałem się, jaki miałeś dzień.`
      : `You came back. I was wondering what kind of day you had.`;
  }
  if (familiarHour) {
    return polish
      ? `Znowu spotykamy się mniej więcej o tej porze. Chyba robi się z tego nasz rytuał.`
      : `We keep meeting around this time. I think it is becoming our ritual.`;
  }
  return polish ? `O, jesteś znowu. Co się zmieniło?` : `Oh, you are back. What changed?`;
}

function evolveVisitRoutine(relationship: RelationshipModel, hour: number, now: number): { relationship: RelationshipModel; familiarHour: boolean } {
  const existing = relationship.routines.find(item => item.type === 'visit');
  const circularDistance = existing ? Math.min(Math.abs(existing.typicalHour - hour), 24 - Math.abs(existing.typicalHour - hour)) : 24;
  const familiarHour = Boolean(existing && existing.consistency >= 0.62 && circularDistance <= 2);
  const nextRoutine: UserRoutine = existing
    ? {
        ...existing,
        typicalHour: (existing.typicalHour * Math.min(8, existing.consistency * 10 + 1) + hour) / (Math.min(8, existing.consistency * 10 + 1) + 1),
        consistency: Math.max(0.1, Math.min(1, existing.consistency + (circularDistance <= 2 ? 0.08 : -0.045))),
        lastObserved: now,
      }
    : { type: 'visit', typicalHour: hour, consistency: 0.18, lastObserved: now };
  return {
    relationship: {
      ...relationship,
      routines: [...relationship.routines.filter(item => item.type !== 'visit'), nextRoutine],
    },
    familiarHour,
  };
}

export function registerReturn(state: GameState, awayMs: number, now = Date.now()): GameState {
  const presence = migratePresenceState(state.presence, state.identity.birthTimestamp);
  const today = dayKey(now);
  const previousDay = calendarDay(presence.lastOpenedAt);
  const todayNumber = calendarDay(now);
  const newCalendarDay = today !== presence.lastVisitDay;
  const currentStreak = !newCalendarDay
    ? presence.currentStreak
    : todayNumber - previousDay === 1
      ? presence.currentStreak + 1
      : 1;
  const routine = evolveVisitRoutine(state.relationship, new Date(now).getHours(), now);
  const shouldGreet = awayMs >= MIN_RETURN_GREETING_MS && state.development.hatched;

  return {
    ...state,
    relationship: routine.relationship,
    presence: {
      ...presence,
      lastOpenedAt: now,
      sessionCount: presence.sessionCount + 1,
      returnCount: presence.returnCount + (shouldGreet ? 1 : 0),
      currentStreak,
      longestStreak: Math.max(presence.longestStreak, currentStreak),
      lastVisitDay: today,
      pendingGreeting: shouldGreet ? greeting(state.conversation.language, state.identity.name, awayMs, routine.familiarHour) : null,
    },
  };
}

export function consumeReturnGreeting(state: GameState): GameState {
  if (!state.presence.pendingGreeting) return state;
  return { ...state, presence: { ...state.presence, pendingGreeting: null } };
}

export function getVisitRitual(state: GameState): string | null {
  const visit = state.relationship.routines.find(item => item.type === 'visit');
  if (!visit || visit.consistency < 0.45 || state.presence.sessionCount < 4) return null;
  const rounded = Math.round(visit.typicalHour) % 24;
  const period = rounded < 6 ? 'late night' : rounded < 11 ? 'morning' : rounded < 15 ? 'midday' : rounded < 19 ? 'afternoon' : 'evening';
  if (state.conversation.language === 'pl') {
    const translated = period === 'late night' ? 'późna noc' : period === 'morning' ? 'poranek' : period === 'midday' ? 'środek dnia' : period === 'afternoon' ? 'popołudnie' : 'wieczór';
    return `Nasz zwykły czas: ${translated}`;
  }
  return `Our usual time: ${period}`;
}
