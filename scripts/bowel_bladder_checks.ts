import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { advanceNeeds, getNeedUrgency, getSleepBlocker } from '../src/systems/needsSystem';
import { simulateOfflineTime } from '../src/systems/offlineSimulation';
import { parseImportedGameState, serializeGameState } from '../src/systems/persistence';
import { GameState } from '../src/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const start = Date.UTC(2026, 7, 23, 12, 0);

function bowelState(value: number): GameState {
  const base = createHatchedCreature(createNewCreature('Bowel', 991));
  return {
    ...base,
    lastSaved: start,
    needsUpdatedAt: start,
    needs: {
      ...base.needs,
      bladder: 90,
      bowel: value,
    },
  };
}

// 1. Urgent bowel survives a long offline absence: the offline model has no
//    comfortable floor for bladder/bowel, so an already-urgent body is never
//    healed back to comfort and never silently loses its need.
const urgent = bowelState(24);
const away = simulateOfflineTime(urgent, 4 * HOUR, start + 4 * HOUR, () => 0).state;
assert.ok(away.needs.bowel < 26, 'urgent bowel must stay urgent after a long absence, not be floored to comfort');
assert.ok(away.needs.bowel <= 24, 'offline must never improve an already-urgent bowel');
assert.ok(away.needs.bowel > 0, 'a moderate absence decays bowel without a premature accident reset');
assert.equal(getNeedUrgency(away.needs.bowel), 'urgent');

// 2. A body that empties during the absence leaves a persistent floor trace
//    instead of being quietly healed (the accident belongs to the room).
const crossing = bowelState(2);
const emptied = simulateOfflineTime(crossing, 4 * HOUR, start + 4 * HOUR, () => 0).state;
assert.ok(emptied.needs.bowel >= 70, 'a body that empties during absence resets only after leaving a mark');
assert.ok(
  emptied.roomMess.some(mess => mess.type === 'poop'),
  'an emptied bowel must leave a persistent poop floor trace',
);

// 3. Rest/sleep does not clear an urgent bowel: sleep slows the decay, it does
//    not reset the value, and an urgent bowel still blocks settling.
const resting = {
  ...bowelState(22),
  sleepState: 'sleeping' as const,
  currentActivity: 'sleeping',
  sleepStartTimestamp: start,
};
const afterSleep = advanceNeeds(resting, start + 4 * HOUR, 'active', 4 * 60);
assert.ok(afterSleep.needs.bowel < 26, 'sleep must not clear an urgent bowel');
assert.ok(afterSleep.needs.bowel <= 22, 'sleep must never reset bowel to comfort');
assert.notEqual(afterSleep.needs.bowel, 100, 'sleep must not flush bowel back to full');
assert.equal(getSleepBlocker({ ...bowelState(24), needs: { ...bowelState(24).needs, bowel: 24 } }), 'bowel', 'an urgent bowel must still block settling');

// 4. Save -> load preserves the bowel value and any floor marks.
const marked = {
  ...crossing,
  roomMess: [
    ...crossing.roomMess,
    { id: 'poop-keep', type: 'poop' as const, x: 44, y: 70, timestamp: start },
  ],
};
const loaded = parseImportedGameState(serializeGameState(marked));
assert.equal(loaded.needs.bowel, marked.needs.bowel, 'save/load must keep the bowel value');
assert.ok(
  loaded.roomMess.some(mess => mess.id === 'poop-keep' && mess.type === 'poop'),
  'save/load must keep persistent poop floor marks',
);

console.log('Bowel/bladder regression checks passed.');
