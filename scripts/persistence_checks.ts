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
    readFallback: undefined,
  }).then(
    () => 'resolved',
    () => 'rejected',
  ),
  'rejected',
  'a hung open while the database still exists must not become an egg',
);

const blockedLife = createHatchedCreature(createNewCreature('Moth', 9901));
let loaderCalls = 0;
let resolveLate: (value: GameState | null) => void;
const lateLoad = new Promise<GameState | null>(resolve => {
  resolveLate = resolve;
});
const lateBoot = loadGameStateForBoot(() => {
  loaderCalls += 1;
  return lateLoad;
}, 10, 4, {
  delay: async () => undefined,
  presence: async () => 'present',
  readFallback: undefined,
});
assert.equal(loaderCalls, 1, 'Chrome must not stack a second IndexedDB open behind a pending one');
resolveLate!(blockedLife);
const recoveredLate = await lateBoot;
assert.equal(loaderCalls, 1, 'a late success must use the original open');
assert.ok(recoveredLate);
assert.equal(recoveredLate.identity.id, blockedLife.identity.id);
assert.equal(isHatchableBoot(recoveredLate), false, 'a slow first open must never become an egg');

await saveGameState(blockedLife);
closeDatabaseConnections();
const healthyIndexedDB = globalThis.indexedDB;
let openCalls = 0;
const stall = new FakeIDBOpenDBRequest();
const hangFirstOpen = new Proxy(healthyIndexedDB, {
  get(target, property) {
    if (property === 'open') {
      return () => {
        openCalls += 1;
        if (openCalls > 1) throw new Error('Chrome must not stack a second indexedDB.open');
        return stall;
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: hangFirstOpen });
let recoveredFromFallback: GameState | null;
try {
  recoveredFromFallback = await loadGameStateForBoot(undefined, 10, 3, {
    delay: async () => undefined,
    presence: async () => 'present',
    readFallback: async () => blockedLife,
  });
} finally {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: healthyIndexedDB });
}
assert.equal(openCalls, 1, 'a hung main-thread open must not enqueue another open');
assert.ok(recoveredFromFallback);
assert.equal(recoveredFromFallback.identity.id, blockedLife.identity.id);

closeDatabaseConnections();
const extraLife = createHatchedCreature(createNewCreature('Moth', 9911));
await saveGameState(extraLife);
closeDatabaseConnections();
const extraConnection = await new Promise<IDBDatabase>((resolve, reject) => {
  const request = healthyIndexedDB.open('becoming-db', 1);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Could not open a second connection.'));
});
const recoveredWithExtra = await loadGameStateForBoot(undefined, 100, 2, { readFallback: undefined });
extraConnection.close();
assert.ok(recoveredWithExtra, 'another same-version connection must not block boot');
assert.equal(recoveredWithExtra.identity.id, extraLife.identity.id);
assert.equal(isHatchableBoot(recoveredWithExtra), false);

async function simulateAppBoot(
  loader: () => Promise<GameState | null>,
  presence: () => Promise<'present' | 'absent' | 'unknown'> = async () => 'present',
): Promise<'room' | 'egg'> {
  try {
    const saved = await loadGameStateForBoot(loader, 10, 4, {
      delay: async () => undefined,
      presence,
      readFallback: undefined,
    });
    return saved && !isHatchableBoot(saved) ? 'room' : 'egg';
  } catch {
    throw new Error('boot remained on the busy screen');
  }
}
let resolveBusy: (value: GameState | null) => void;
const busyLoad = new Promise<GameState | null>(resolve => {
  resolveBusy = resolve;
});
const busyBoot = simulateAppBoot(() => busyLoad);
resolveBusy!(extraLife);
assert.equal(await busyBoot, 'room', 'a delayed open must leave the opening screen into the same living room');
assert.equal(
  await simulateAppBoot(async () => null, async () => 'absent'),
  'egg',
  'confirmed missing becoming-db must leave boot into the egg, not stay on Try again',
);

// A completed reset is the explicit transition back to a truly empty DB.
await resetAllLocalData();
const afterRealReset = await loadGameStateForBoot(undefined, 100, 2, { readFallback: undefined });
assert.equal(afterRealReset, null, 'reset followed by boot must enter hatching from a confirmed empty read');
closeDatabaseConnections();
const extraEmpty = await new Promise<IDBDatabase>((resolve, reject) => {
  const request = healthyIndexedDB.open('becoming-db', 1);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Could not open a second empty connection.'));
});
const eggWithExtra = await loadGameStateForBoot(undefined, 100, 2, { readFallback: undefined });
extraEmpty.close();
assert.equal(eggWithExtra, null, 'another connection on an empty save must still reach the egg');

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
  && updateContract.indexOf('closeDatabaseForReload()') > updateContract.indexOf('await saveGameState'),
  'PWA update must save in-memory life then wait for IndexedDB to close before reload',
);
assert.match(appSource, /updatingRef\.current\) return/, 'pagehide must not reopen IndexedDB during update reload');
assert.match(appSource, /onClick=\{\(\) => void runBoot\(\)\}/, 'Try again must wait on the same in-flight open');
const runBootStart = appSource.indexOf('const runBoot');
const runBootLoad = appSource.indexOf('loadGameStateForBoot', runBootStart);
assert.ok(runBootStart >= 0 && runBootLoad > runBootStart);
assert.doesNotMatch(
  appSource.slice(runBootStart, runBootLoad),
  /closeDatabaseConnections/,
  'boot must not close a pending Chrome open before waiting on it',
);
assert.match(appSource, /Opening the local save/);
assert.match(appSource, /Waiting on the same save/);
assert.doesNotMatch(appSource, /Loading…/);
assert.doesNotMatch(appSource, /will not open a new egg without a confirmed empty save/);
assert.doesNotMatch(appSource, /The local save has not opened yet/);
assert.doesNotMatch(appSource, /The save is still there/);
assert.match(appSource, /closeDatabaseForReload/);
assert.match(
  appSource,
  /applyCircadianSleep\(registerReturn/,
  'boot must land on their sleep/wake before the room can greet',
);
const loadingSlice = appSource.slice(appSource.indexOf('if (loading || bootError)'), appSource.indexOf('if (showEgg)'));
assert.doesNotMatch(loadingSlice, /PwaUpdateNotice/, 'service worker must not register until IndexedDB has opened');
const pwaSource = readFileSync('src/components/PwaUpdateNotice.tsx', 'utf8');
assert.match(pwaSource, /updateServiceWorker\(true\)/);
const viteSource = readFileSync('vite.config.ts', 'utf8');
assert.doesNotMatch(viteSource, /clientsClaim/, 'claiming the page during boot races IndexedDB open in Chrome');

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
