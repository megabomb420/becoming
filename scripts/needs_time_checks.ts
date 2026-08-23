import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  advanceNeeds,
  drinkCreature,
  effectiveOfflineMinutes,
  feedCreature,
  getNeedUrgency,
  getSleepBlocker,
  getVisibleNeedSignals,
  touchCreature,
  useToilet,
  washCreature,
} from '../src/systems/needsSystem';
import { simulateOfflineTime } from '../src/systems/offlineSimulation';
import { migrateGameState } from '../src/systems/persistence';
import {
  estimateNightRestMs,
  getLocalDateKey,
  getRoomLighting,
  getTimeOfDay,
} from '../src/systems/timeSystem';
import { GameState } from '../src/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const start = Date.UTC(2026, 7, 23, 12, 0);

let needsState = createHatchedCreature(createNewCreature('Needs', 2031));
needsState = {
  ...needsState,
  lastSaved: start,
  needsUpdatedAt: start,
  needs: {
    hunger: 80, hydration: 80, energy: 80, bladder: 80, bowel: 80,
    hygiene: 80, comfort: 80, stimulation: 80, social: 80,
  },
};

const afterHour = advanceNeeds(needsState, start + HOUR);
assert.ok(afterHour.needs.hunger < needsState.needs.hunger, 'hunger must lose satisfaction over real time');
assert.ok(afterHour.needs.hydration < needsState.needs.hydration, 'hydration must lose satisfaction over real time');
assert.ok(afterHour.needs.hunger > 72, 'one active hour must not be punishing');
assert.equal(afterHour.needsUpdatedAt, start + HOUR);
assert.deepEqual(advanceNeeds(afterHour, start + HOUR).needs, afterHour.needs, 'the same elapsed window must never be counted twice');

const sleeping = { ...needsState, sleepState: 'sleeping' as const, currentActivity: 'sleeping' };
const afterSleep = advanceNeeds(sleeping, start + 4 * HOUR, 'active', 4 * 60);
assert.ok(afterSleep.needs.energy > sleeping.needs.energy, 'sleep must restore energy');
assert.ok(afterSleep.needs.hydration < sleeping.needs.hydration, 'sleep must not freeze physical needs');

assert.equal(getNeedUrgency(24.99), 'urgent');
assert.equal(getNeedUrgency(25), 'attention');
assert.equal(getNeedUrgency(47.99), 'attention');
assert.equal(getNeedUrgency(48), 'notice');
assert.equal(getNeedUrgency(71.99), 'notice');
assert.equal(getNeedUrgency(72), 'settled');
assert.equal(getSleepBlocker({ ...needsState, needs: { ...needsState.needs, bladder: 24 } }), 'bladder');

let caredFor = { ...needsState, needs: { ...needsState.needs, hunger: 20, hydration: 20, bladder: 18, bowel: 19, hygiene: 22, comfort: 30, social: 30 } };
caredFor = feedCreature(caredFor, 'apple', start);
assert.ok(caredFor.needs.hunger > 50, 'food must satisfy hunger');
caredFor = drinkCreature(caredFor, start);
assert.ok(caredFor.needs.hydration > 60, 'water must satisfy hydration');
assert.ok(caredFor.needs.bladder < 18, 'drinking must make the toilet need more likely later');
caredFor = useToilet(caredFor, start);
assert.equal(caredFor.needs.bladder, 100);
assert.equal(caredFor.needs.bowel, 100);
caredFor = washCreature(caredFor, start);
assert.ok(caredFor.needs.hygiene > 70, 'washing must restore hygiene');
const afterTouch = touchCreature(caredFor, 'stroke', start);
assert.ok(afterTouch.needs.comfort > caredFor.needs.comfort);
assert.ok(afterTouch.needs.social > caredFor.needs.social);

const signalled = {
  ...needsState,
  needs: { ...needsState.needs, hydration: 19, hunger: 42, social: 65 },
};
assert.deepEqual(getVisibleNeedSignals(signalled).map(signal => signal.key), ['hydration', 'hunger', 'social']);

assert.ok(effectiveOfflineMinutes(7 * 24 * 60) < 8 * 60, 'a week away must flatten to less than eight active hours');
const weekLater = start + 7 * 24 * HOUR;
const offlineStart = { ...needsState, needs: Object.fromEntries(Object.keys(needsState.needs).map(key => [key, 90])) as GameState['needs'] };
const offlineWeek = simulateOfflineTime(offlineStart, weekLater - start, weekLater, () => 0).state;
assert.ok(offlineWeek.needs.hunger >= 20);
assert.ok(offlineWeek.needs.hydration >= 22);
assert.ok(offlineWeek.needs.energy >= 18);
assert.equal(offlineWeek.needsUpdatedAt, weekLater);
assert.equal(offlineWeek.lastSaved, weekLater);

const alreadyUrgent = { ...needsState, needs: { ...needsState.needs, hydration: 10 } };
const urgentReturn = simulateOfflineTime(alreadyUrgent, 2 * 24 * HOUR, start + 2 * 24 * HOUR, () => 0).state;
assert.ok(urgentReturn.needs.hydration <= 10, 'offline protection must not magically improve an already urgent need');

const legacy = createHatchedCreature(createNewCreature('Legacy', 77)) as unknown as GameState & { needs: Partial<GameState['needs']> };
legacy.needs = { hunger: 33, energy: 44, comfort: 55, stimulation: 66, social: 77 };
delete (legacy as Partial<GameState>).needsUpdatedAt;
legacy.inventory = legacy.inventory.filter(type => !['water_bowl', 'litter_box', 'wash_basin'].includes(type));
const migrated = migrateGameState(legacy as GameState);
assert.equal(migrated.needs.hunger, 68, 'legacy zero-prone needs must leave the old model outside crisis');
assert.equal(migrated.needs.energy, 68);
assert.equal(migrated.needs.comfort, 68);
assert.equal(migrated.needs.hydration, 82);
assert.equal(migrated.needsUpdatedAt, migrated.lastSaved);
assert.ok(migrated.inventory.includes('water_bowl'));
assert.ok(migrated.inventory.includes('litter_box'));
assert.ok(migrated.inventory.includes('wash_basin'));

const utc = (hour: number, minute = 0) => Date.UTC(2026, 7, 23, hour, minute);
assert.equal(getTimeOfDay(utc(0), 0).phase, 'night');
assert.equal(getTimeOfDay(utc(12), 0).phase, 'day');
assert.ok(getTimeOfDay(utc(6), 0).solarFactor > getTimeOfDay(utc(4), 0).solarFactor, 'morning light must rise continuously around the seasonally estimated sunrise');
const fallbackSchedule = getTimeOfDay(utc(12), 0);
const atLocalMinute = (minute: number) => Date.UTC(2026, 7, 23, 0, Math.round(minute));
assert.ok(
  getTimeOfDay(atLocalMinute(fallbackSchedule.sunsetMinute - 45), 0).solarFactor
    > getTimeOfDay(atLocalMinute(fallbackSchedule.sunsetMinute + 90), 0).solarFactor,
  'evening light must fall continuously around the seasonally estimated sunset',
);

assert.equal(getLocalDateKey(Date.UTC(2026, 7, 23, 23, 59), 0), '2026-08-23');
assert.equal(getLocalDateKey(Date.UTC(2026, 7, 24, 0, 0), 0), '2026-08-24');
assert.equal(getLocalDateKey(Date.UTC(2026, 7, 23, 23, 30), -60), '2026-08-24');
assert.equal(getLocalDateKey(Date.UTC(2026, 7, 23, 23, 30), 240), '2026-08-23');
const sameInstant = Date.UTC(2026, 7, 23, 20, 30);
assert.equal(getTimeOfDay(sameInstant, -60).phase, 'night', 'UTC+1 user should see 21:30 local night');
assert.equal(getTimeOfDay(sameInstant, 240).phase, 'day', 'UTC-4 user should see 16:30 local day');
assert.equal(getTimeOfDay(utc(13), 0).minuteOfDay - getTimeOfDay(utc(12), 0).minuteOfDay, 60, 'the game clock must advance at the normal real-world rate');

const beforeNightBoundary = getRoomLighting(getTimeOfDay(utc(20, 59), 0));
const afterNightBoundary = getRoomLighting(getTimeOfDay(utc(21), 0));
assert.ok(Math.abs(beforeNightBoundary.brightness - afterNightBoundary.brightness) < 0.01, 'phase labels may change, but lighting must stay continuous');

// Dublin changes from UTC+0 to UTC+1 at 01:00 UTC on 29 March 2026. The same
// solar-night slice therefore contains one fewer real hour than a fixed-offset
// clock, even though both are sampled from identical UTC endpoints.
const dstStart = Date.UTC(2026, 2, 29, 0, 0);
const dstEnd = Date.UTC(2026, 2, 29, 8, 0);
const dstRest = estimateNightRestMs(dstStart, dstEnd, timestamp => timestamp < Date.UTC(2026, 2, 29, 1, 0) ? 0 : -60);
const fixedOffsetRest = estimateNightRestMs(dstStart, dstEnd, () => 0);
assert.equal(fixedOffsetRest - dstRest, HOUR);

const returnStart = Date.UTC(2026, 7, 22, 12, 0);
const returnNow = returnStart + 26 * HOUR;
const returned = simulateOfflineTime({ ...needsState, needsUpdatedAt: returnStart, lastSaved: returnStart }, 26 * HOUR, returnNow, () => 0);
const sleepActivity = returned.activities.find(activity => activity.type === 'slept');
assert.ok(sleepActivity && sleepActivity.duration >= 8 * 60 && sleepActivity.duration <= 9 * 60);
assert.equal(returned.state.sleepState, 'awake', 'a daytime return must not look mysteriously asleep');
assert.equal(returned.state.needsUpdatedAt, returnNow);

console.log('Needs, urgency, care actions, migration, offline return, local-day, timezone, DST, and day-phase checks passed.');
