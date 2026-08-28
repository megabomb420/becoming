import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  isHatchableBoot,
  migrateGameState,
  resetAllLocalData,
  resetForNewLife,
} from '../src/systems/persistence';
import { GameState } from '../src/types';

const NOW = 1_825_000_000_000;
const living = createHatchedCreature(createNewCreature('Moth', 125));
const v012Save: GameState = {
  ...living,
  identity: {
    ...living.identity,
    id: 'creature-moth-live',
    name: 'Moth',
    birthTimestamp: NOW - 9 * 86_400_000,
  },
  development: {
    ...living.development,
    hatched: true,
    stage: 'combining',
    chronologicalAge: 9 * 86_400_000,
    cognitiveLevel: 66,
    languageLevel: 50,
  },
  roomObjects: [
    { id: 'stone-live', type: 'stone', x: 31, y: 66, state: { status: 'keepsake' }, interactions: 5, placedByUser: true, beingUsedByCreature: false },
    { id: 'ball-live', type: 'ball', x: 73, y: 69, state: { status: 'shared_game' }, interactions: 7, placedByUser: true, beingUsedByCreature: false },
  ],
  inventory: living.inventory.filter(type => type !== 'stone' && type !== 'ball'),
};

const migrated = migrateGameState(v012Save);
assert.equal(migrated.development.hatched, true, 'migration must preserve the permanent hatch transition');
assert.equal(migrated.development.stage, 'combining', 'migration must not rewind a valid living stage');
assert.equal(migrated.identity.id, v012Save.identity.id);
assert.equal(migrated.identity.name, 'Moth');
assert.ok(migrated.development.cognitiveLevel >= v012Save.development.cognitiveLevel, 'migration must not lower cognitive development');
assert.ok(migrated.development.languageLevel >= v012Save.development.languageLevel, 'migration must not lower language development');
assert.deepEqual(
  migrated.roomObjects.map(object => ({ id: object.id, type: object.type, status: object.state.status })),
  v012Save.roomObjects.map(object => ({ id: object.id, type: object.type, status: object.state.status })),
  'migration must preserve placed objects and their durable state',
);

let stored: GameState | null = living;
const memoryPersistence = {
  load: async () => stored,
  reset: async () => { stored = null; },
};
assert.equal(isHatchableBoot(await memoryPersistence.load()), false, 'the fixture must begin as a living room save');
await resetForNewLife(memoryPersistence);
assert.equal(isHatchableBoot(await memoryPersistence.load()), true, 'the same reset contract used by Settings must make the next boot hatchable');

let deletionRequest: {
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onblocked: null | (() => void);
  error: DOMException | null;
} = { onsuccess: null, onerror: null, onblocked: null, error: null };
const blockedReset = resetAllLocalData({
  deleteDatabase: () => deletionRequest as unknown as IDBOpenDBRequest,
});
await Promise.resolve();
await Promise.resolve();
let resetSettled = false;
void blockedReset.then(() => { resetSettled = true; });
deletionRequest.onblocked?.();
await Promise.resolve();
assert.equal(resetSettled, false, 'a blocked IndexedDB deletion must not be reported as a successful reset');
deletionRequest.onsuccess?.();
await blockedReset;

console.log('Persistence reset and migration checks passed.');
