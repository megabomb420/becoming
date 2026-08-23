import { GameState, Memory, ObjectType, OfflineActivity, ReturnTrace, ReturnTraceKind, RoomObject } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';
import { advanceNeeds } from './needsSystem';

const TRACE_MINIMUM_MS = 10 * 60_000;

const traceObjectNames: Record<ObjectType, { en: string; pl: string }> = {
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

export function simulateOfflineTime(state: GameState, awayMs: number): { state: GameState; activities: OfflineActivity[] } {
  const activities: OfflineActivity[] = [];
  let currentState = { ...state };
  const awayMinutes = awayMs / 60000;

  if (awayMinutes < 2) {
    return { state: currentState, activities };
  }

  const now = Date.now();
  const leftAt = now - awayMs;

  // If creature was sleeping when user left, model continued sleep
  const wasSleeping = state.sleepState === 'sleeping';
  const sleepStart = state.sleepStartTimestamp ?? leftAt;
  const sleepDuration = wasSleeping ? Math.min(awayMs, now - sleepStart) : 0;

  if (wasSleeping && sleepDuration > 0) {
    // Creature slept for part or all of the absence
    const sleptMinutes = sleepDuration / 60000;
    const wakeThreshold = 480; // 8 hours of sleep is plenty
    if (sleptMinutes >= wakeThreshold) {
      currentState = {
        ...currentState,
        sleepState: 'awake',
        currentActivity: null,
        sleepStartTimestamp: undefined,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + 60),
        },
      };
      currentState = generateDreamAfterSleep(currentState, sleepDuration, now);
      activities.push({ type: 'slept', duration: sleptMinutes, timestamp: now - sleepDuration / 2 });
    } else {
      // Still sleeping or just woke up
      currentState = {
        ...currentState,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + sleptMinutes * 0.5),
        },
      };
      if (awayMinutes > wakeThreshold) {
        currentState.sleepState = 'awake';
        currentState.currentActivity = null;
        currentState.sleepStartTimestamp = undefined;
      }
      activities.push({ type: 'slept', duration: sleptMinutes, timestamp: now - sleepDuration / 2 });
    }
  }

  // Check if absence spanned night hours (22:00 - 06:00) and creature wasn't already sleeping
  if (!wasSleeping && awayMinutes > 60) {
    const leftHour = new Date(leftAt).getHours();
    const returnHour = new Date(now).getHours();
    const spannedNight = (leftHour >= 22 || leftHour <= 6) || (returnHour >= 22 || returnHour <= 6) || awayMinutes > 480;

    if (spannedNight) {
      currentState = {
        ...currentState,
        sleepState: 'awake',
        currentActivity: null,
        sleepStartTimestamp: undefined,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + 40),
        },
      };
      currentState = generateDreamAfterSleep(currentState, awayMs * 0.6, now);
      activities.push({ type: 'slept', duration: awayMinutes * 0.6, timestamp: now - awayMs / 2 });
    }
  }

  // Independent exploration based on personality (only if awake)
  if (currentState.sleepState === 'awake') {
    const exploreChance = currentState.personality.curiosity / 100;
    const independence = currentState.personality.independence / 100;

    if (awayMinutes > 30 && Math.random() < exploreChance * independence) {
      const discoveries = ['looked at objects', 'moved something', 'sat quietly', 'explored room'];
      activities.push({
        type: discoveries[Math.floor(Math.random() * discoveries.length)],
        duration: awayMinutes * 0.3,
        timestamp: now - awayMs * 0.3,
      });

      currentState = {
        ...currentState,
        needs: {
          ...currentState.needs,
          stimulation: Math.min(100, currentState.needs.stimulation + 10),
          hunger: Math.max(0, currentState.needs.hunger - awayMinutes * 0.5),
        },
      };
    }
  }

  // Emotional response to absence
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
    currentState.memories = [...currentState.memories, memory].slice(-200);
  }

  // Leave one physical, state-backed trace before any return dialogue. The
  // trace reuses the same offline simulation pass and does not add background
  // timers or writes.
  const traced = applyReturnTrace(currentState, awayMs, now);
  currentState = traced.state;
  if (traced.activity) activities.push(traced.activity);

  // The same hidden need model continues while away at gentler rates. The
  // care cycle is deliberately bounded to one trace of each kind per return.
  currentState = advanceNeeds(currentState, awayMinutes, now, 'offline').state;

  // Age progresses
  currentState = {
    ...currentState,
    development: {
      ...currentState.development,
      chronologicalAge: currentState.development.chronologicalAge + awayMs,
    },
    lastSaved: now,
  };

  return { state: currentState, activities };
}
