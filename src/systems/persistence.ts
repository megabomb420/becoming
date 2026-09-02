import { authoritativeNow } from './authoritativeTime';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GameState, Needs, ObjectType } from '../types';
import { migrateBondState, migrateObjectPreferences } from './relationshipSystem';
import { migrateConversationState } from './conversationSystem';
import { mapLegacyStageIdsInProse, migrateDevelopmentExperience, syncDevelopmentWithAge } from './developmentSystem';
import { bootstrapLifePathState, migrateLifePathState } from './lifePathSystem';
import { isDreamRetelling, migrateInnerLifeState, migrateInterests, repairMalformedDreamProse } from './innerLifeSystem';
import { migrateContinuityState } from './continuitySystem';
import { migratePresenceState } from './presenceSystem';
import { migrateCreations } from './creationSystem';
import { migrateTouchBoundaryState } from './boundarySystem';
import { migrateSharedLanguageState } from './sharedLanguageSystem';
import { migrateRoomMess } from './needsSystem';
import { migrateWorldEnvironment } from './environmentSystem';
import { migrateHealthState } from './healthSystem';

interface BecomingDB extends DBSchema {
  gameState: {
    key: string;
    value: GameState;
  };
  snapshots: {
    key: number;
    value: { timestamp: number; state: GameState };
  };
}

const DB_NAME = 'becoming-db';
const DB_VERSION = 1;
const BASE_INVENTORY: ObjectType[] = [
  'water_bowl', 'litter_box', 'wash_basin',
  'apple', 'broccoli', 'ball', 'blanket', 'cushion', 'brush', 'jingle_toy', 'paper', 'pencil', 'box', 'stone', 'mirror',
];
const SAVE_FORMAT = 'becoming-save';
const SAVE_FORMAT_VERSION = 1;
const MAX_IMPORT_LENGTH = 2_000_000;
const DB_OPEN_TIMEOUT_MS = 2_000;
const BOOT_LOAD_TIMEOUT_MS = 2_000;
const BOOT_OPEN_ATTEMPTS = 8;
const CLOSE_WAIT_MS = 200;

let dbPromise: Promise<IDBPDatabase<BecomingDB>> | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let resetInProgress = false;
const openConnections = new Set<IDBPDatabase<BecomingDB>>();

const lifecycleChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('becoming-db-lifecycle')
  : null;

function closeSettledDatabaseConnections(): void {
  for (const db of openConnections) db.close();
  openConnections.clear();
}

export function closeDatabaseConnections(): void {
  closeSettledDatabaseConnections();
  dbPromise = null;
}

/**
 * Chrome queues IndexedDB opens. Closing and immediately opening (or reloading
 * into an open) hangs. Wait for the close event, then a short gap, before the
 * next document may open becoming-db.
 */
export async function closeDatabaseForReload(): Promise<void> {
  const closing = [...openConnections].map(db => new Promise<void>(resolve => {
    const timer = setTimeout(resolve, CLOSE_WAIT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      db.addEventListener('close', done, { once: true });
      db.close();
    } catch {
      done();
    }
  }));
  openConnections.clear();
  dbPromise = null;
  lifecycleChannel?.postMessage('close-connections');
  await Promise.all(closing);
  await new Promise<void>(resolve => setTimeout(resolve, 50));
}

if (lifecycleChannel) {
  lifecycleChannel.onmessage = event => {
    if (event.data === 'close-connections') closeDatabaseConnections();
  };
}

export async function databasePresence(factory: Pick<IDBFactory, 'databases'> | IDBFactory = indexedDB): Promise<'present' | 'absent' | 'unknown'> {
  if (typeof factory.databases !== 'function') return 'unknown';
  try {
    const timeout = timeoutAfter(1_200, 'Listing IndexedDB databases timed out.');
    try {
      const listed = await Promise.race([factory.databases(), timeout.promise]);
      return listed.some(entry => entry.name === DB_NAME) ? 'present' : 'absent';
    } finally {
      timeout.cancel();
    }
  } catch {
    return 'unknown';
  }
}

function timeoutAfter(ms: number, message: string): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  return {
    promise: new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
    cancel: () => clearTimeout(timer),
  };
}

function getDB(): Promise<IDBPDatabase<BecomingDB>> {
  if (!dbPromise) {
    // Chrome cannot abort IDBOpenDBRequest. Timing this out and calling open()
    // again queues a second request behind the first forever. One open only.
    const opening = openDB<BecomingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // A half-created v1 database is recoverable. Only create stores that
        // are actually absent rather than throwing during the repair open.
        if (!db.objectStoreNames.contains('gameState')) db.createObjectStore('gameState');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'timestamp' });
      },
      blocked() {
        console.warn('Opening Becoming IndexedDB is waiting for another connection.');
        closeSettledDatabaseConnections();
        lifecycleChannel?.postMessage('close-connections');
      },
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase | null)?.close();
        closeSettledDatabaseConnections();
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });
    const attempt = opening.then(db => {
      if (resetInProgress) {
        db.close();
        throw new Error('Becoming IndexedDB open was superseded.');
      }
      openConnections.add(db);
      return db;
    });
    dbPromise = attempt;
    void attempt.catch(() => {
      if (dbPromise === attempt) dbPromise = null;
    });
  }
  return dbPromise;
}

function validNeed(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value as number)) : fallback;
}

export function migrateGameState(state: GameState): GameState {
  // Migrate old state that may be missing new fields
  const migrated = { ...state };

  // v0.10: all needs share one clear direction (100 settled, 0 urgent).
  // The old minute-based model could leave every legacy value at zero after a
  // short absence. A one-time floor moves those five values out of crisis;
  // physical needs that did not exist before also start comfortably.
  const oldNeeds = (migrated.needs ?? {}) as Partial<Needs>;
  const legacyNeeds = !Number.isFinite(oldNeeds.hydration)
    || !Number.isFinite(oldNeeds.bladder)
    || !Number.isFinite(oldNeeds.bowel)
    || !Number.isFinite(oldNeeds.hygiene)
    || !Number.isFinite(migrated.needsUpdatedAt);
  const legacyValue = (value: unknown, fallback: number) => {
    const migratedValue = validNeed(value, fallback);
    return legacyNeeds ? Math.max(68, migratedValue) : migratedValue;
  };
  migrated.needs = {
    hunger: legacyValue(oldNeeds.hunger, 78),
    hydration: validNeed(oldNeeds.hydration, 82),
    energy: legacyValue(oldNeeds.energy, 78),
    bladder: validNeed(oldNeeds.bladder, 88),
    bowel: validNeed(oldNeeds.bowel, 90),
    hygiene: validNeed(oldNeeds.hygiene, 82),
    comfort: legacyValue(oldNeeds.comfort, 78),
    stimulation: legacyValue(oldNeeds.stimulation, 74),
    social: legacyValue(oldNeeds.social, 74),
  };
  const savedAt = Number.isFinite(migrated.lastSaved) ? migrated.lastSaved : migrated.identity.birthTimestamp;
  migrated.needsUpdatedAt = Number.isFinite(migrated.needsUpdatedAt) ? migrated.needsUpdatedAt : savedAt;

  // v0.11: weather consent, the rounded selected place, the last successful
  // Open-Meteo snapshot, learned weather preferences, and cache timestamps all
  // live with the creature in IndexedDB. Older saves begin unconfigured and
  // receive the same one-time consent choice as a fresh creature.
  migrated.world = migrateWorldEnvironment(migrated.world);
  migrated.roomMess = migrateRoomMess(migrated.roomMess);

  // v0.14.5: existing living saves receive a safe healthy health state. They
  // are never retroactively ill because historical health data did not exist.
  // A backup round-trip of a real (alive or dead) health state is preserved.
  const healthSavedAt = Number.isFinite(migrated.lastSaved) ? migrated.lastSaved : savedAt;
  migrated.health = migrateHealthState(migrated.health, healthSavedAt);

  // Ensure development.hatched exists
  if (typeof migrated.development?.hatched !== 'boolean') {
    migrated.development = {
      ...migrated.development,
      hatched: migrated.development?.stage !== 'egg',
    };
  }
  migrated.development = {
    ...migrated.development,
    experience: migrateDevelopmentExperience(migrated.development?.experience, migrated.identity.seed),
  };

  // Movement and reactions are transient UI processes. A reload cannot resume
  // their timers safely, so restore a coherent idle/sleeping state instead of
  // leaving the creature permanently "walking" toward an old target.
  if (migrated.sleepState === 'sleeping') {
    migrated.creatureBehavior = 'sleeping';
    migrated.currentActivity = 'sleeping';
  } else {
    migrated.creatureBehavior = 'idle';
    migrated.currentActivity = null;
  }

  // Ensure room objects have new fields
  migrated.roomObjects = (migrated.roomObjects ?? []).map(obj => ({
      ...obj,
      x: Math.max(10, Math.min(90, Number.isFinite(obj.x) ? obj.x : 50)),
      y: Math.max(60, Math.min(76, Number.isFinite(obj.y) ? obj.y : 64)),
      placedByUser: obj.placedByUser ?? true,
      // An interrupted animation must not leave an object permanently locked.
      beingUsedByCreature: false,
    }));

  // Recover inventory entries missing from older saves. Every base object is
  // either in the tray or in the room; consumable food returns to the tray
  // after it is eaten.
  const roomTypes = new Set<ObjectType>(migrated.roomObjects.map(obj => obj.type));
  const existingInventory = (Array.isArray(migrated.inventory) ? migrated.inventory : [])
    .filter((type, index, all) => all.indexOf(type) === index && !roomTypes.has(type));
  const presentTypes = new Set<ObjectType>([
    ...existingInventory,
    ...migrated.roomObjects.map(obj => obj.type),
  ]);
  migrated.inventory = [
    ...existingInventory,
    ...BASE_INVENTORY.filter(type => !presentTypes.has(type)),
  ];

  // v0.5–v0.6: preserve learned tastes and relationship development while
  // giving older saves deterministic starting preferences.
  migrated.objectPreferences = migrateObjectPreferences(
    migrated.objectPreferences,
    migrated.personality,
    migrated.identity.seed,
  );
  migrated.bond = migrateBondState(migrated.bond, migrated.relationship);

  // v0.7: conversations now survive closing the chat and facts learned from
  // the user remain part of the creature's mind. Older saves begin cleanly.
  migrated.socialLearning = {
    observations: migrated.socialLearning?.observations ?? [],
    imitated: migrated.socialLearning?.imitated ?? [],
    activeCuriosities: migrated.socialLearning?.activeCuriosities ?? [],
    noticedUserConsistency: migrated.socialLearning?.noticedUserConsistency ?? false,
    lastBehaviourQuestion: migrated.socialLearning?.lastBehaviourQuestion ?? 0,
  };
  migrated.conversation = migrateConversationState(migrated.conversation);
  migrated.continuity = migrateContinuityState(migrated.continuity);
  migrated.presence = migratePresenceState(migrated.presence, migrated.lastSaved || migrated.identity.birthTimestamp);
  migrated.creations = migrateCreations(migrated.creations);
  migrated.touchBoundaries = migrateTouchBoundaryState(migrated.touchBoundaries);
  migrated.sharedLanguage = migrateSharedLanguageState(migrated.sharedLanguage);

  // v0.9.9: existing creatures keep every memory and learned habit. Their
  // initial life-path leanings are seeded from the personality they already
  // developed, then future conversations and choices move those paths.
  migrated.lifePath = migrated.lifePath
    ? migrateLifePathState(migrated.lifePath, migrated.personality)
    : bootstrapLifePathState(migrated.personality, migrated.socialLearning.observations);

  // v0.9.10: existing creatures keep every previous memory and gain a
  // backwards-compatible inner life. Placeholder interests are preserved.
  migrated.interests = migrateInterests(migrated.interests);
  migrated.innerLife = migrateInnerLifeState(migrated.innerLife);

  // v0.14.12 fixes milestone *writing* and dream *generation*, but saves that
  // booted under an older version can already store prose embedding the raw
  // internal stage id (a dream fragment, its "dreamed:" memory, or a transcript
  // quoting the dream). Repair that stored prose once on load so no display
  // surface ever shows the internal id again.
  migrated.memories = (migrated.memories ?? []).map(memory => ({
    ...memory,
    content: mapLegacyStageIdsInProse(memory.content),
  }));
  if (migrated.innerLife) {
    migrated.innerLife = {
      ...migrated.innerLife,
      dreams: (migrated.innerLife.dreams ?? []).map(dream => ({
        ...dream,
        fragment: mapLegacyStageIdsInProse(dream.fragment),
      })),
    };
  }
  if (migrated.conversation) {
    // Only creature-authored text is repaired: user messages are the player's
    // own words and must survive byte-for-byte. The standalone last-creature
    // message field can also carry the legacy prose.
    migrated.conversation = {
      ...migrated.conversation,
      messages: (migrated.conversation.messages ?? []).map(message => message.sender === 'creature'
        ? { ...message, text: mapLegacyStageIdsInProse(message.text) }
        : message),
      lastCreatureMessage: typeof migrated.conversation.lastCreatureMessage === 'string'
        ? mapLegacyStageIdsInProse(migrated.conversation.lastCreatureMessage)
        : migrated.conversation.lastCreatureMessage,
    };
  }

  // Dreams written before the dream-image fix splice milestone UI copy into
  // prose as a noun ("Reached First words floated above the room…"). Repair
  // only that recognisable construction inside stored dream prose — dream
  // fragments and "dreamed:" memories — plus creature speech that recognisably
  // retells such a dream ("I had a strange dream: …"). Ordinary creature
  // speech and user-authored text are never rewritten; no other prose is
  // paraphrased.
  if (migrated.innerLife) {
    migrated.innerLife = {
      ...migrated.innerLife,
      dreams: (migrated.innerLife.dreams ?? []).map(dream => ({
        ...dream,
        fragment: repairMalformedDreamProse(dream.fragment),
      })),
    };
  }
  migrated.memories = (migrated.memories ?? []).map(memory => memory.tags?.includes('dream')
    ? { ...memory, content: repairMalformedDreamProse(memory.content) }
    : memory);
  if (migrated.conversation) {
    migrated.conversation = {
      ...migrated.conversation,
      messages: (migrated.conversation.messages ?? []).map(message => message.sender === 'creature' && isDreamRetelling(message.text)
        ? { ...message, text: repairMalformedDreamProse(message.text) }
        : message),
      lastCreatureMessage: typeof migrated.conversation.lastCreatureMessage === 'string' && isDreamRetelling(migrated.conversation.lastCreatureMessage)
        ? repairMalformedDreamProse(migrated.conversation.lastCreatureMessage)
        : migrated.conversation.lastCreatureMessage,
    };
  }

  // Ensure hatched creatures never have stage 'egg'
  if (migrated.development.hatched && migrated.development.stage === 'egg') {
    migrated.development = {
      ...migrated.development,
      stage: 'newborn',
      cognitiveLevel: Math.max(5, migrated.development.cognitiveLevel),
    };
  }

  return syncDevelopmentWithAge(migrated);
}

interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  version: number;
  exportedAt: number;
  state: GameState;
}

export function serializeGameState(state: GameState): string {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    version: SAVE_FORMAT_VERSION,
    exportedAt: authoritativeNow(),
    state: { ...state, lastSaved: authoritativeNow() },
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseImportedGameState(source: string): GameState {
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_IMPORT_LENGTH) {
    throw new Error('This backup is empty or too large.');
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('This is not a valid Becoming backup.');
  }
  const envelope = value as Partial<SaveEnvelope>;
  const candidate = envelope?.state as Partial<GameState> | undefined;
  if (
    envelope?.format !== SAVE_FORMAT
    || envelope.version !== SAVE_FORMAT_VERSION
    || !candidate
    || typeof candidate.identity?.id !== 'string'
    || !Number.isFinite(candidate.identity?.seed)
    || !candidate.development
    || !candidate.needs
    || !candidate.personality
    || !candidate.relationship
    || !Array.isArray(candidate.relationship.routines)
    || !Array.isArray(candidate.memories)
    || !Array.isArray(candidate.vocabulary)
    || !Array.isArray(candidate.roomObjects)
    || !Array.isArray(candidate.inventory)
  ) {
    throw new Error('This file does not contain a complete Becoming creature.');
  }
  try {
    return migrateGameState(candidate as GameState);
  } catch {
    throw new Error('This Becoming backup is damaged or incompatible.');
  }
}

export async function loadGameState(): Promise<GameState | null> {
  const db = await getDB();
  const result = await db.get('gameState', 'current');
  if (!result) return null;
  return migrateGameState(result);
}

/** Read becoming-db from a dedicated worker so a hung main-thread open is not the only client. */
export async function readGameStateFromWorker(): Promise<GameState | null | undefined> {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return undefined;
  }
  const source = `self.onmessage=function(){var req=indexedDB.open(${JSON.stringify(DB_NAME)});var t=setTimeout(function(){self.postMessage({t:1});self.close()},1500);req.onerror=function(){clearTimeout(t);self.postMessage({e:1});self.close()};req.onsuccess=function(){var db=req.result;if(!db.objectStoreNames.contains('gameState')){clearTimeout(t);db.close();self.postMessage({n:1});self.close();return}var g=db.transaction('gameState','readonly').objectStore('gameState').get('current');g.onsuccess=function(){clearTimeout(t);self.postMessage({s:g.result||null});db.close();self.close()};g.onerror=function(){clearTimeout(t);self.postMessage({e:1});db.close();self.close()}}};`;
  return new Promise(resolve => {
    let worker: Worker;
    try {
      worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    } catch {
      resolve(undefined);
      return;
    }
    const kill = setTimeout(() => {
      try { worker.terminate(); } catch { /* ignore */ }
      resolve(undefined);
    }, 2_000);
    worker.onmessage = event => {
      clearTimeout(kill);
      try { worker.terminate(); } catch { /* ignore */ }
      const data = event.data as { t?: number; e?: number; n?: number; s?: GameState | null };
      if (data.t || data.e) {
        resolve(undefined);
        return;
      }
      if (data.n || data.s == null) {
        resolve(null);
        return;
      }
      try {
        resolve(migrateGameState(data.s));
      } catch {
        resolve(undefined);
      }
    };
    worker.onerror = () => {
      clearTimeout(kill);
      try { worker.terminate(); } catch { /* ignore */ }
      resolve(undefined);
    };
    worker.postMessage('open');
  });
}

export interface BootLoadHooks {
  delay?: (ms: number) => Promise<void>;
  presence?: () => Promise<'present' | 'absent' | 'unknown'>;
  readFallback?: () => Promise<GameState | null | undefined>;
}

function bootRetryDelay(attempt: number): number {
  return Math.min(200 * 2 ** attempt, 1_000);
}

/**
 * Start one read and keep it. A timeout is UI-only: Chrome's IDB open queue
 * poisons if we abandon that request and call open() again. Confirmed missing
 * becoming-db becomes an egg. A fallback reader may return the record while
 * the original open is still pending. Timeout never becomes an empty save.
 */
export async function loadGameStateForBoot(
  loader: () => Promise<GameState | null> = loadGameState,
  timeoutMs = BOOT_LOAD_TIMEOUT_MS,
  attempts = BOOT_OPEN_ATTEMPTS,
  hooks: BootLoadHooks = {},
): Promise<GameState | null> {
  let lastError: unknown = new Error('Loading Becoming state failed.');
  const presence = hooks.presence ?? databasePresence;
  const delay = hooks.delay ?? ((ms: number) => new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  }));
  const readFallback = Object.prototype.hasOwnProperty.call(hooks, 'readFallback')
    ? hooks.readFallback
    : readGameStateFromWorker;
  const load = loader();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timeout = timeoutAfter(timeoutMs, 'Loading Becoming state timed out.');
    try {
      return await Promise.race([load, timeout.promise]);
    } catch (error) {
      lastError = error;
      if (await presence() === 'absent') return null;
      if (readFallback) {
        try {
          const fallback = await readFallback();
          if (fallback !== undefined) return fallback;
        } catch {
          // Keep waiting on the original open.
        }
      }
      if (attempt < attempts - 1) await delay(bootRetryDelay(attempt));
    } finally {
      timeout.cancel();
    }
  }
  throw lastError;
}

async function writeGameState(state: GameState): Promise<void> {
  const db = await getDB();
  const toSave = { ...state, lastSaved: authoritativeNow() };
  await db.put('gameState', toSave, 'current');
  if (Math.random() < 0.1) {
    await db.put('snapshots', { timestamp: authoritativeNow(), state: toSave });
  }
}

/**
 * Serialize writes so an older in-flight save can never finish after a newer
 * pagehide/update flush and silently restore stale identity or room state.
 */
export function saveGameState(state: GameState): Promise<void> {
  const snapshot = structuredClone(state);
  const operation = saveQueue.catch(() => undefined).then(() => writeGameState(snapshot));
  saveQueue = operation;
  return operation;
}

type DatabaseDeleter = Pick<IDBFactory, 'deleteDatabase'>;

export async function resetAllLocalData(factory: DatabaseDeleter = indexedDB): Promise<void> {
  resetInProgress = true;
  try {
    // Never await dbPromise here: the exact outage being recovered from is an
    // IDB open promise that never settles. Close every connection that did
    // settle and make any late open close itself via resetInProgress.
    closeDatabaseConnections();

    // Closing the connection rejects normal in-flight writes. Bound the drain
    // as a second defence against a browser that leaves an IDB operation
    // pending forever; resetInProgress makes any late open close itself.
    const drainTimeout = timeoutAfter(DB_OPEN_TIMEOUT_MS, 'Waiting for Becoming saves timed out.');
    try {
      await Promise.race([saveQueue.catch(() => undefined), drainTimeout.promise]).catch(() => undefined);
    } finally {
      drainTimeout.cancel();
    }
    closeDatabaseConnections();

    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not clear local Becoming data.'));
      request.onblocked = () => {
        console.warn('Becoming reset is waiting for another open tab to release IndexedDB.');
      };
    });
    // IDB reports success only after deletion has completed. Do not verify by
    // opening the database: that would recreate it before pagehide/reload.
  } finally {
    resetInProgress = false;
  }
}

export function isHatchableBoot(state: GameState | null): boolean {
  return state === null || state.development.hatched === false;
}

interface NewLifePersistence {
  reset: () => Promise<void>;
}

/**
 * Contract used by Settings: deletion is complete before App reloads into the
 * existing hatch flow. It intentionally does not reopen IndexedDB to verify,
 * because doing so can recreate the database during pagehide/reload.
 */
export async function resetForNewLife(store?: NewLifePersistence): Promise<void> {
  const persistence = store ?? { reset: resetAllLocalData };
  await persistence.reset();
}
