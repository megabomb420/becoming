import 'fake-indexeddb/auto';
import { IDBOpenDBRequest as FakeIDBOpenDBRequest } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  closeDatabaseConnections,
  isHatchableBoot,
  loadGameStateForBoot,
  migrateGameState,
  resetAllLocalData,
  resetForNewLife,
  saveGameState,
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
assert.equal(
  isHatchableBoot(await loadGameStateForBoot(memoryPersistence.load, 10)),
  true,
  'the same reset contract used by Settings must make the next boot hatchable',
);

assert.equal(
  isHatchableBoot(await loadGameStateForBoot(async () => null, 10)),
  true,
  'a missing database must enter the hatch flow',
);
assert.equal(
  await loadGameStateForBoot(() => new Promise(() => undefined), 10, 3, {
    presence: async () => 'absent',
    delay: async () => undefined,
  }),
  null,
  'a hung open plus confirmed missing becoming-db must enter the hatch flow',
);
assert.equal(
  await loadGameStateForBoot(() => new Promise(() => undefined), 10, 2, {
    presence: async () => 'present',
    delay: async () => undefined,
  }).then(
    () => 'resolved',
    () => 'rejected',
  ),
  'rejected',
  'a hung open while the database still exists must not become an egg',
);

// The first real IDB open never emits success/error, as observed on the
// affected PWA profile. Boot must abandon that request, make a genuinely new
// open, and recover the already-hatched record on its retry.
const blockedLife = createHatchedCreature(createNewCreature('Moth', 9901));
await saveGameState(blockedLife);
closeDatabaseConnections();
const healthyIndexedDB = globalThis.indexedDB;
const stalledRequest = new FakeIDBOpenDBRequest();
let openCalls = 0;
const firstOpenStalls = new Proxy(healthyIndexedDB, {
  get(target, property) {
    if (property === 'open') {
      return (name: string, version?: number) => {
        openCalls += 1;
        if (openCalls === 1) return stalledRequest;
        return version === undefined ? target.open(name) : target.open(name, version);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: firstOpenStalls });
let recoveredAfterRetry: GameState | null;
try {
  recoveredAfterRetry = await loadGameStateForBoot(undefined, 10, 2, { delay: async () => undefined });
} finally {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: healthyIndexedDB });
}
assert.ok(openCalls >= 2, 'boot retry must issue a new IndexedDB open rather than reuse the stalled promise');
assert.ok(recoveredAfterRetry, 'the retry must rehydrate an existing living record');
assert.equal(recoveredAfterRetry.identity.id, blockedLife.identity.id);
assert.equal(recoveredAfterRetry.development.hatched, true);
assert.equal(isHatchableBoot(recoveredAfterRetry), false, 'a slow first open must never become an egg');

closeDatabaseConnections();
const threeThenLive = createHatchedCreature(createNewCreature('Moth', 9902));
await saveGameState(threeThenLive);
closeDatabaseConnections();
openCalls = 0;
const firstThreeStall = new Proxy(healthyIndexedDB, {
  get(target, property) {
    if (property === 'open') {
      return (name: string, version?: number) => {
        openCalls += 1;
        if (openCalls <= 3) return new FakeIDBOpenDBRequest();
        return version === undefined ? target.open(name) : target.open(name, version);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: firstThreeStall });
let recoveredAfterBusy: GameState | null;
try {
  recoveredAfterBusy = await loadGameStateForBoot(undefined, 10, 4, { delay: async () => undefined, presence: async () => 'present' });
} finally {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: healthyIndexedDB });
}
assert.ok(openCalls >= 4, 'a busy save must keep issuing new opens instead of parking');
assert.ok(recoveredAfterBusy, 'leaving the busy screen means the living record rehydrated');
assert.equal(recoveredAfterBusy.identity.id, threeThenLive.identity.id);

// App treats busy as a round, not a destination: keep calling a new boot until
// the living record rehydrates. Parking on Try again fails this assertion.
async function simulateAppBoot(
  loader: () => Promise<GameState | null>,
  presence: () => Promise<'present' | 'absent' | 'unknown'> = async () => 'present',
): Promise<'room' | 'egg'> {
  for (let round = 0; round < 6; round += 1) {
    try {
      const saved = await loadGameStateForBoot(loader, 10, 1, {
        delay: async () => undefined,
        presence,
      });
      return saved && !isHatchableBoot(saved) ? 'room' : 'egg';
    } catch {
      // Same path as App auto-retry / Try again: a new open, not a dead end.
    }
  }
  throw new Error('boot remained on the busy screen');
}
let busyRounds = 0;
assert.equal(
  await simulateAppBoot(() => {
    busyRounds += 1;
    if (busyRounds >= 3) return Promise.resolve(threeThenLive);
    return new Promise(() => undefined);
  }),
  'room',
  'a reproduced busy/hung open must leave that screen into the same living room',
);
assert.equal(
  await simulateAppBoot(async () => null, async () => 'absent'),
  'egg',
  'confirmed missing becoming-db must leave boot into the egg, not stay on Try again',
);

// A completed reset is the explicit transition back to a truly empty DB.
await resetAllLocalData();
const afterRealReset = await loadGameStateForBoot(undefined, 100, 2);
assert.equal(afterRealReset, null, 'reset followed by boot must enter hatching from a confirmed empty read');

const ash = createHatchedCreature(createNewCreature('Ash', 8128));
await saveGameState(ash);
closeDatabaseConnections();
const ashAfterReload = await loadGameStateForBoot(undefined, 100, 2);
assert.ok(ashAfterReload, 'a durably saved hatch must exist on the next boot');
assert.equal(ashAfterReload.development.hatched, true, 'reload must keep the hatch transition');
assert.equal(ashAfterReload.identity.id, ash.identity.id, 'reload must keep the same creature identity');
assert.equal(ashAfterReload.identity.name, 'Ash', 'reload must return to Ash rather than a new egg');

const appSource = readFileSync('src/App.tsx', 'utf8');
const updateStart = appSource.indexOf('const prepareForUpdate');
const updateEnd = appSource.indexOf('const handleUpdateFailed');
const updateContract = appSource.slice(updateStart, updateEnd);
assert.ok(updateStart >= 0 && updateEnd > updateStart, 'App must expose a bounded PWA update preparation path');
assert.ok(
  updateContract.indexOf('await saveGameState') >= 0
  && updateContract.indexOf('releaseDatabaseForReload()') > updateContract.indexOf('await saveGameState'),
  'PWA update must save in-memory life before releasing IndexedDB for reload',
);
assert.match(appSource, /updatingRef\.current\) return/, 'pagehide must not reopen IndexedDB during update reload');
assert.match(appSource, /onClick=\{\(\) => void runBoot\(\)\}/, 'Try again must run a new boot/open attempt without reloading the same dead page state');
assert.match(appSource, /closeDatabaseConnections\(\);/, 'Try again / auto-retry must drop the previous hung open before a new attempt');
assert.match(appSource, /retryTimerRef\.current = setTimeout\(\(\) => \{\s*if \(bootRunRef\.current === run\) void runBoot\(\);/, 'busy boot must auto-retry instead of parking');
assert.match(appSource, /setBootError\(true\)/);
assert.match(appSource, /Opening the local save/);
assert.match(appSource, /The save is still there/);
assert.doesNotMatch(appSource, /Loading…/);
assert.doesNotMatch(appSource, /will not open a new egg without a confirmed empty save/);
assert.doesNotMatch(appSource, /The local save has not opened yet/);
assert.match(appSource, /releaseDatabaseForReload/);

let deletionRequest: {
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onblocked: null | (() => void);
  error: DOMException | null;
} = { onsuccess: null, onerror: null, onblocked: null, error: null };
const blockedReset = resetAllLocalData({
  deleteDatabase: () => deletionRequest as unknown as IDBOpenDBRequest,
});
while (!deletionRequest.onblocked) await Promise.resolve();
let resetSettled = false;
void blockedReset.then(() => { resetSettled = true; });
deletionRequest.onblocked?.();
await Promise.resolve();
assert.equal(resetSettled, false, 'a blocked IndexedDB deletion must not be reported as a successful reset');
deletionRequest.onsuccess?.();
await blockedReset;

console.log('Persistence reset and migration checks passed.');
