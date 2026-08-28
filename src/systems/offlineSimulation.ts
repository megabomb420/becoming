import { GameState, Memory, ObjectType, OfflineActivity, ReturnTrace, ReturnTraceKind, RoomObject } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';
import { advanceNeeds, applyNeedDelta, getSleepBlocker } from './needsSystem';
import { getRestSchedule } from './lifePathSystem';
import { estimateNightRestMs, estimateWakeMs, getTimeOfDay, isCreatureRestPhase, shouldBeDrowsy } from './timeSystem';
import { endOutdoorVisit } from './environmentSystem';

const TRACE_MINIMUM_MS = 10 * 60_000;

const traceObjectNames: Record<ObjectType, { en: string; pl: string }> = {
  water_bowl: { en: 'water bowl', pl: 'miska z wodą' },
  litter_box: { en: 'litter box', pl: 'kuweta' },
  wash_basin: { en: 'wash basin', pl: 'miska do mycia' },
  food_bowl: { en: 'bowl', pl: 'miska' },
  apple: { en: 'apple', pl: 'jabłko' },
  broccoli: { en: 'broccoli', pl: 'brokuł' },
  ball: { en: 'ball', pl: 'piłka' },
  blanket: { en: 'blanket', pl: 'koc' },
  paper: { en: 'paper', pl: 'papier' },
  pencil: { en: 'pencil', pl: 'ołówek' },
  box: { en: 'box', pl: 'pudełko' },
  stone: { en: 'stone', pl: 'kamień' },
  mirror: { en: 'mirror', pl: 'lustro' },
};

function stableUnit(seed: number, salt: number): number {
  const raw = Math.sin(seed * 0.00031 + salt * 23.117) * 10000;
  return raw - Math.floor(raw);
}

function traceCaption(kind: ReturnTraceKind, object?: RoomObject): Pick<ReturnTrace, 'captionEn' | 'captionPl'> {
  const names = object ? traceObjectNames[object.type] : null;
  if (kind === 'moved_object' && names) return { captionEn: `The ${names.en} is not where you left it.`, captionPl: `${names.pl[0].toUpperCase()}${names.pl.slice(1)} nie leży tam, gdzie wcześniej.` };
  if (kind === 'used_object' && names) return { captionEn: `The ${names.en} carries a fresh trace of use.`, captionPl: `Na rzeczy „${names.pl}” został świeży ślad użycia.` };
  if (kind === 'continued_creation') return { captionEn: 'The mark on the paper continued while the room was quiet.', captionPl: 'Ślad na papierze urósł, kiedy w pokoju było cicho.' };
  if (kind === 'mirror_visit') return { captionEn: 'A faint touch remains on the mirror.', captionPl: 'Na lustrze został delikatny ślad dotyku.' };
  return { captionEn: 'A familiar resting place looks newly pressed.', captionPl: 'Znajome miejsce odpoczynku wygląda, jakby dopiero co ktoś z niego wstał.' };
}

function applyReturnTrace(state: GameState, awayMs: number, now: number): { state: GameState; activity?: OfflineActivity } {
  if (awayMs < TRACE_MINIMUM_MS || !state.development.hatched) return { state };
  const recentKinds = new Set(state.presence.absenceEpisodes.slice(-2).map(episode => episode.trace?.kind).filter(Boolean));
  const favoriteType = state.development.experience?.favoriteObject;
  const favorite = favoriteType ? state.roomObjects.find(object => object.type === favoriteType) : undefined;
  const paper = state.roomObjects.find(object => object.type === 'paper');
  const mirror = state.roomObjects.find(object => object.type === 'mirror');
  const movable = state.roomObjects.filter(object => object.type !== 'food_bowl');
  const candidates: Array<{ kind: ReturnTraceKind; weight: number; object?: RoomObject }> = [
    { kind: 'rested', weight: 12 + state.personality.calmness * 0.11 },
  ];
  if (movable.length > 0) candidates.push({ kind: 'moved_object', weight: 5 + state.personality.curiosity * 0.08 + state.personality.independence * 0.09, object: movable[Math.floor(stableUnit(state.identity.seed, now + 3) * movable.length)] });
  if (favorite) candidates.push({ kind: 'used_object', weight: 10 + state.objectPreferences[favorite.type].affinity * 0.3, object: favorite });
  if (paper && state.roomObjects.some(object => object.type === 'pencil') && state.creations.length > 0) candidates.push({ kind: 'continued_creation', weight: 7 + state.personality.curiosity * 0.08, object: paper });
  if (mirror && state.development.cognitiveLevel >= 12) candidates.push({ kind: 'mirror_visit', weight: 5 + state.personality.curiosity * 0.06, object: mirror });

  const weighted = candidates.map(candidate => ({
    ...candidate,
    weight: candidate.weight * (recentKinds.has(candidate.kind) ? 0.12 : 1),
  }));
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = stableUnit(state.identity.seed, Math.floor(now / 60_000) + Math.floor(awayMs / 60_000)) * total;
  const selected = weighted.find(candidate => {
    roll -= candidate.weight;
    return roll <= 0;
  }) ?? weighted[0];
  const traceId = `return-trace-${now}`;
  const caption = traceCaption(selected.kind, selected.object);
  const trace: ReturnTrace = {
    id: traceId,
    kind: selected.kind,
    timestamp: now,
    objectId: selected.object?.id,
    objectType: selected.object?.type,
    ...caption,
  };
  let next = state;

  if (selected.kind === 'moved_object' && selected.object) {
    const direction = stableUnit(state.identity.seed, now + 11) > 0.5 ? 1 : -1;
    const x = Math.max(12, Math.min(88, selected.object.x + direction * (8 + stableUnit(state.identity.seed, now + 13) * 7)));
    const y = Math.max(55, Math.min(75, selected.object.y + (stableUnit(state.identity.seed, now + 17) - 0.5) * 5));
    next = {
      ...next,
      roomObjects: next.roomObjects.map(object => object.id === selected.object?.id
        ? { ...object, x, y, state: { ...object.state, returnTraceId: traceId, status: 'moved-away' } }
        : object),
    };
  } else if (selected.object) {
    const status = selected.kind === 'continued_creation' ? 'continued-away' : selected.kind === 'mirror_visit' ? 'touched-away' : 'used-away';
    next = {
      ...next,
      roomObjects: next.roomObjects.map(object => object.id === selected.object?.id
        ? { ...object, state: { ...object.state, returnTraceId: traceId, status } }
        : object),
    };
  } else {
    const preferred = next.development.experience?.preferredRestSpot ?? { x: 50, y: 62 };
    const blanket = next.roomObjects.find(object => object.type === 'blanket');
    const rest = blanket
      ? { x: Math.max(14, Math.min(86, blanket.x + (blanket.x > 50 ? -10 : 10))), y: blanket.y }
      : preferred;
    next = { ...next, position: rest, creatureBehavior: 'idle', currentActivity: null };
  }
  next = { ...next, presence: { ...next.presence, pendingTrace: trace } };
  const activityType = selected.kind === 'moved_object'
    ? 'moved something'
    : selected.kind === 'mirror_visit'
      ? 'looked at objects'
      : selected.kind === 'continued_creation'
        ? 'continued a drawing'
        : selected.kind === 'used_object'
          ? 'used a favorite'
          : 'sat quietly';
  return {
    state: next,
    activity: { type: activityType, duration: Math.max(4, awayMs / 60_000 * 0.18), timestamp: now - awayMs * 0.22 },
  };
}

export type TimezoneOffsetAt = (timestamp: number) => number;

export function simulateOfflineTime(
  state: GameState,
  awayMs: number,
  now = Date.now(),
  timezoneOffsetAt: TimezoneOffsetAt = timestamp => new Date(timestamp).getTimezoneOffset(),
): { state: GameState; activities: OfflineActivity[] } {
  const activities: OfflineActivity[] = [];
  const safeAwayMs = Math.max(0, awayMs);
  const awayMinutes = safeAwayMs / 60_000;
  const leftAt = now - safeAwayMs;
  const needsFrom = Number.isFinite(state.needsUpdatedAt) ? state.needsUpdatedAt : leftAt;

  if (awayMinutes < 1) return { state, activities };

  if (state.world.place === 'outdoors') {
    state = endOutdoorVisit(state, now);
  }

  const schedule = getRestSchedule(state.lifePath);
  const naturalNightRestMs = estimateNightRestMs(needsFrom, now, timezoneOffsetAt, state.world, schedule);
  const wasSleeping = state.sleepState === 'sleeping';
  const sleepStart = state.sleepStartTimestamp ?? leftAt;
  const manualSleepMs = wasSleeping ? Math.min(Math.max(0, now - sleepStart), 8 * 60 * 60_000) : 0;
  const totalNeedWindow = Math.max(0, now - needsFrom);
  const sleepMs = Math.min(totalNeedWindow, Math.max(naturalNightRestMs, manualSleepMs));

  let currentState = advanceNeeds(state, now, 'offline', sleepMs / 60_000);

  if (sleepMs >= 60 * 60_000) {
    activities.push({ type: 'slept', duration: sleepMs / 60_000, timestamp: now - sleepMs / 2 });
    currentState = generateDreamAfterSleep(currentState, sleepMs, now);
  }

  // Independent activity makes absence feel lived-in without using randomness
  // that would make the same restored save produce different outcomes.
  const wakeMs = estimateWakeMs(needsFrom, now, timezoneOffsetAt, currentState.world, schedule);
  const explores = awayMinutes > 30
    && currentState.personality.curiosity * currentState.personality.independence > 2_400;
  const livedTheirDay = !explores && wakeMs >= 30 * 60_000;
  if (explores || livedTheirDay) {
    const discoveries = ['looked at objects', 'moved something', 'sat quietly', 'explored room'];
    const index = Math.abs(Math.floor((currentState.identity.seed + leftAt / 60_000) % discoveries.length));
    activities.push({
      type: discoveries[index],
      duration: Math.min(90, Math.max(8, (livedTheirDay ? wakeMs : safeAwayMs) / 60_000 * 0.18)),
      timestamp: leftAt + safeAwayMs * 0.58,
    });
    currentState = applyNeedDelta(currentState, { stimulation: 8, energy: -3 }, now);
  }

  if (awayMinutes > 120) {
    const memory: Memory = {
      id: `mem-absence-${now}`,
      timestamp: now,
      content: `the room had ${Math.floor(awayMinutes / 60)} quiet hour${awayMinutes >= 120 ? 's' : ''} of its own`,
      importance: Math.min(7, 4 + Math.floor(awayMinutes / 360)),
      emotionalValence: 0.08,
      tags: ['absence', 'presence'],
      mentioned: false,
      understood: currentState.development.cognitiveLevel > 30,
      compressed: false,
    };
    currentState = { ...currentState, memories: [...currentState.memories, memory].slice(-200) };
  }

  // Leave one physical, state-backed trace before any return dialogue. The
  // trace reuses the same offline simulation pass and does not add background
  // timers or writes.
  const traced = applyReturnTrace(currentState, awayMs, now);
  currentState = traced.state;
  if (traced.activity) activities.push(traced.activity);

  const localOffset = timezoneOffsetAt(now);
  const time = getTimeOfDay(now, currentState.world, localOffset);
  const shortUnfinishedSleep = wasSleeping && manualSleepMs > 0 && manualSleepMs < 8 * 60 * 60_000;
  const maySettle = !getSleepBlocker(currentState)
    && (isCreatureRestPhase(time, schedule) || currentState.needs.energy < 20);
  const sleepState: GameState['sleepState'] = shortUnfinishedSleep || maySettle
    ? 'sleeping'
    : shouldBeDrowsy(time, currentState.needs.energy, schedule) ? 'drowsy' : 'awake';

  currentState = {
    ...currentState,
    development: {
      ...currentState.development,
      chronologicalAge: currentState.development.chronologicalAge + safeAwayMs,
    },
    sleepState,
    currentActivity: sleepState === 'sleeping' ? 'sleeping' : null,
    sleepStartTimestamp: sleepState === 'sleeping' ? sleepStart : undefined,
    creatureBehavior: sleepState === 'sleeping' ? 'sleeping' : 'idle',
    lastSaved: now,
    needsUpdatedAt: now,
  };

  return { state: currentState, activities };
}
