import { GameState, Memory, OfflineActivity } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';
import { advanceNeeds, applyNeedDelta } from './needsSystem';
import { estimateNightRestMs, getTimeOfDay, shouldBeDrowsy } from './timeSystem';

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

  const naturalNightRestMs = estimateNightRestMs(needsFrom, now, timezoneOffsetAt);
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
  const explores = awayMinutes > 30
    && currentState.personality.curiosity * currentState.personality.independence > 2_400;
  if (explores) {
    const discoveries = ['looked at objects', 'moved something', 'sat quietly', 'explored room'];
    const index = Math.abs(Math.floor((currentState.identity.seed + leftAt / 60_000) % discoveries.length));
    activities.push({
      type: discoveries[index],
      duration: Math.min(90, awayMinutes * 0.18),
      timestamp: leftAt + safeAwayMs * 0.58,
    });
    currentState = applyNeedDelta(currentState, { stimulation: 8, energy: -3 }, now);
  }

  if (awayMinutes > 120) {
    const attachment = currentState.personality.affection / 100;
    const memory: Memory = {
      id: `mem-absence-${now}`,
      timestamp: now,
      content: `user was gone for ${Math.floor(awayMinutes / 60)} hours`,
      importance: Math.min(8, 4 + Math.floor(awayMinutes / 360)),
      emotionalValence: attachment > 0.5 ? 0.2 : -0.1,
      tags: ['absence', 'user'],
      mentioned: false,
      understood: currentState.development.cognitiveLevel > 30,
      compressed: false,
    };
    currentState = { ...currentState, memories: [...currentState.memories, memory].slice(-200) };
  }

  const localOffset = timezoneOffsetAt(now);
  const time = getTimeOfDay(now, localOffset);
  const shortUnfinishedSleep = wasSleeping && manualSleepMs > 0 && manualSleepMs < 8 * 60 * 60_000;
  const sleepState: GameState['sleepState'] = shortUnfinishedSleep
    ? 'sleeping'
    : shouldBeDrowsy(time, currentState.needs.energy) ? 'drowsy' : 'awake';

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
