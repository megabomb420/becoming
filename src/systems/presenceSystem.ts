import { AbsenceEpisode, ConversationLanguage, GameState, OfflineActivity, PresenceState, RelationshipModel, ReturnTrace, UserRoutine } from '../types';
import { getRestSchedule } from './lifePathSystem';
import { getTimeOfDay, isCreatureRestPhase } from './timeSystem';

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
    pendingTrace: null,
    absenceEpisodes: [],
  };
}

function migrateReturnTrace(value: Partial<ReturnTrace> | null | undefined): ReturnTrace | null {
  if (!value || typeof value.id !== 'string' || !Number.isFinite(value.timestamp)) return null;
  const kinds = new Set(['moved_object', 'used_object', 'rested', 'continued_creation', 'mirror_visit']);
  if (!kinds.has(String(value.kind))) return null;
  return {
    id: value.id.slice(0, 80),
    kind: value.kind as ReturnTrace['kind'],
    timestamp: Number(value.timestamp),
    objectId: typeof value.objectId === 'string' ? value.objectId.slice(0, 100) : undefined,
    objectType: value.objectType,
    captionEn: typeof value.captionEn === 'string' ? value.captionEn.slice(0, 180) : 'Something in the room changed.',
    captionPl: typeof value.captionPl === 'string' ? value.captionPl.slice(0, 180) : 'Coś w pokoju się zmieniło.',
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
    pendingTrace: migrateReturnTrace(value.pendingTrace),
    absenceEpisodes: Array.isArray(value.absenceEpisodes) ? value.absenceEpisodes.slice(-12).flatMap(item => {
      const episode = item as Partial<AbsenceEpisode>;
      if (!Number.isFinite(episode.returnedAt) || !Number.isFinite(episode.durationMs)) return [];
      const returnedAt = Number(episode.returnedAt);
      const durationMs = Math.max(0, Number(episode.durationMs));
      return [{
        id: typeof episode.id === 'string' ? episode.id.slice(0, 80) : `absence-${returnedAt}`,
        leftAt: Number.isFinite(episode.leftAt) ? Number(episode.leftAt) : returnedAt - durationMs,
        returnedAt,
        durationMs,
        activityTypes: Array.isArray(episode.activityTypes) ? episode.activityTypes.slice(0, 5).map(item => String(item).slice(0, 48)) : [],
        trace: migrateReturnTrace(episode.trace) ?? undefined,
      }];
    }) : [],
  };
}

function activitySummary(activityTypes: string[], language: ConversationLanguage): string {
  const polish = language === 'pl';
  if (activityTypes.some(type => type === 'slept')) return polish ? 'spałem i przyniosłem ze snu kilka dziwnych obrazów' : 'I slept and brought back a few strange images';
  if (activityTypes.some(type => type === 'moved something')) return polish ? 'przestawiłem coś w pokoju i udawałem, że tak miało być' : 'I moved something in the room and pretended it was intentional';
  if (activityTypes.some(type => type === 'continued a drawing')) return polish ? 'wróciłem do śladu na papierze i dodałem coś po swojemu' : 'I returned to the mark on the paper and added something of my own';
  if (activityTypes.some(type => type === 'used a favorite')) return polish ? 'wróciłem do jednej z moich ulubionych rzeczy' : 'I returned to one of my favorite things';
  if (activityTypes.some(type => type === 'looked at objects')) return polish ? 'oglądałem rzeczy, które zostawiłeś w pokoju' : 'I looked closely at the things you left in the room';
  if (activityTypes.some(type => type === 'explored room')) return polish ? 'obchodziłem pokój, szukając czegoś nowego' : 'I explored the room, looking for something new';
  if (activityTypes.some(type => type === 'sat quietly')) return polish ? 'siedziałem cicho i układałem sobie myśli' : 'I sat quietly and arranged my thoughts';
  return polish ? 'pokój był cichy, więc obserwowałem, jak mija czas' : 'the room was quiet, so I watched time pass';
}

export function getAbsenceSummary(state: GameState, episode: AbsenceEpisode | undefined = state.presence.absenceEpisodes[state.presence.absenceEpisodes.length - 1]): string | null {
  if (!episode) return null;
  return activitySummary(episode.activityTypes, state.conversation.language);
}

function greeting(
  language: ConversationLanguage,
  name: string | null,
  awayMs: number,
  familiarHour: boolean,
  restPhase: boolean,
): string {
  const polish = language === 'pl';
  const who = name || (polish ? 'Hej' : 'Hey');
  if (restPhase) {
    if (awayMs >= 3 * 86_400_000) {
      return polish
        ? `${who}… jesteś. Długo byłem w swojej porze snu. Co się u ciebie działo?`
        : `${who}… you are here. I was in my rest for a long time. What happened while you were away?`;
    }
    if (awayMs >= 18 * 60 * 60_000) {
      return polish
        ? `Wróciłeś w moją porę snu. Dobrze, że jesteś.`
        : `You came during my rest. It is good you are here.`;
    }
    if (awayMs >= 2 * 60 * 60_000) {
      return polish
        ? `Wróciłeś w moją porę snu.`
        : `You came during my rest.`;
    }
    return polish
      ? `O, jesteś. Przyszedłeś w moją porę snu.`
      : `Oh, you are here. You came during my rest.`;
  }
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
      ? `Wróciłeś. Zastanawiałem się, co u ciebie.`
      : `You came back. I was wondering how you were.`;
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

export function registerReturn(state: GameState, awayMs: number, now = Date.now(), activities: OfflineActivity[] = []): GameState {
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
  const restPhase = isCreatureRestPhase(getTimeOfDay(now, state.world), getRestSchedule(state.lifePath));
  // Visit hours are learned only while they are in their wake. Night-shift
  // returns must not become a shared ritual they were not awake to keep.
  const routine = restPhase
    ? { relationship: state.relationship, familiarHour: false }
    : evolveVisitRoutine(state.relationship, new Date(now).getHours(), now);
  const shouldGreet = awayMs >= MIN_RETURN_GREETING_MS && state.development.hatched;
  const episode: AbsenceEpisode | null = shouldGreet ? {
    id: `absence-${now}`,
    leftAt: now - awayMs,
    returnedAt: now,
    durationMs: awayMs,
    activityTypes: [...new Set(activities.map(activity => activity.type.slice(0, 48)))].slice(0, 5),
    trace: presence.pendingTrace ?? undefined,
  } : null;
  const baseGreeting = shouldGreet
    ? greeting(state.conversation.language, state.identity.name, awayMs, routine.familiarHour, restPhase)
    : null;
  const activityLine = episode && awayMs >= 30 * 60_000 ? activitySummary(episode.activityTypes, state.conversation.language) : null;

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
      pendingGreeting: baseGreeting && activityLine && !presence.pendingTrace
        ? state.conversation.language === 'pl' ? `${baseGreeting} Kiedy cię nie było, ${activityLine}.` : `${baseGreeting} While you were gone, ${activityLine}.`
        : baseGreeting,
      pendingTrace: presence.pendingTrace,
      absenceEpisodes: episode ? [...presence.absenceEpisodes, episode].slice(-12) : presence.absenceEpisodes,
    },
  };
}

export function consumeReturnGreeting(state: GameState): GameState {
  if (!state.presence.pendingGreeting) return state;
  return { ...state, presence: { ...state.presence, pendingGreeting: null } };
}

export function consumeReturnTrace(state: GameState): GameState {
  const trace = state.presence.pendingTrace;
  if (!trace) return state;
  return {
    ...state,
    presence: { ...state.presence, pendingTrace: null },
    roomObjects: state.roomObjects.map(object => object.state.returnTraceId === trace.id
      ? { ...object, state: { ...object.state, returnTraceId: undefined } }
      : object),
  };
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

export function getPresenceReply(state: GameState, text: string): string | null {
  if (!/(?:what did you do while i was (?:gone|away)|what happened while i was away|co robiłeś kiedy mnie nie było|co robiles kiedy mnie nie bylo|co robiłeś beze mnie|co robiles beze mnie|co się działo kiedy mnie nie było|co sie dzialo kiedy mnie nie bylo)/i.test(text)) return null;
  const episode = state.presence.absenceEpisodes[state.presence.absenceEpisodes.length - 1];
  const summary = getAbsenceSummary(state, episode);
  if (!summary) return state.conversation.language === 'pl' ? 'Jeszcze nie mam żadnej nieobecności do opowiedzenia.' : 'I do not have an absence story to tell yet.';
  return state.conversation.language === 'pl' ? `Kiedy cię nie było, ${summary}.` : `While you were gone, ${summary}.`;
}
