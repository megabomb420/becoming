import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GameState, MemoryBookEntry, Needs, ObjectType } from '../types';
import { migrateBondState, migrateObjectPreferences } from './relationshipSystem';
import { migrateConversationState } from './conversationSystem';
import { migrateDevelopmentExperience, syncDevelopmentWithAge } from './developmentSystem';
import { bootstrapLifePathState, migrateLifePathState } from './lifePathSystem';
import { migrateInnerLifeState, migrateInterests } from './innerLifeSystem';
import { migrateContinuityState } from './continuitySystem';
import { migratePresenceState } from './presenceSystem';
import { migrateCreations } from './creationSystem';
import { migrateTouchBoundaryState } from './boundarySystem';
import { migrateSharedLanguageState } from './sharedLanguageSystem';
import { migrateRoomMess } from './needsSystem';
import { migrateWorldEnvironment } from './environmentSystem';

interface BecomingDB extends DBSchema {
  gameState: {
    key: string;
    value: GameState;
  };
  memoryBook: {
    key: string;
    value: MemoryBookEntry;
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
  'apple', 'broccoli', 'ball', 'blanket', 'paper', 'pencil', 'box', 'stone', 'mirror',
];
const SAVE_FORMAT = 'becoming-save';
const SAVE_FORMAT_VERSION = 1;
const MAX_IMPORT_LENGTH = 2_000_000;
const DB_OPEN_TIMEOUT_MS = 2_500;
const BOOT_LOAD_TIMEOUT_MS = 4_000;

let dbPromise: Promise<IDBPDatabase<BecomingDB>> | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let resetInProgress = false;
const openConnections = new Set<IDBPDatabase<BecomingDB>>();

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
    let abandoned = false;
    let rejectBlocked: (error: Error) => void = () => undefined;
    const blocked = new Promise<never>((_, reject) => { rejectBlocked = reject; });
    const timeout = timeoutAfter(DB_OPEN_TIMEOUT_MS, 'Opening Becoming IndexedDB timed out.');
    const opening = openDB<BecomingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // A half-created v1 database is recoverable. Only create stores that
        // are actually absent rather than throwing during the repair open.
        if (!db.objectStoreNames.contains('gameState')) db.createObjectStore('gameState');
        if (!db.objectStoreNames.contains('memoryBook')) db.createObjectStore('memoryBook');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'timestamp' });
      },
      blocked() {
        rejectBlocked(new Error('Opening Becoming IndexedDB was blocked by another connection.'));
      },
      blocking(_currentVersion, _blockedVersion, event) {
        // A reset from this or another open tab must be allowed to finish.
        // Keeping an old connection alive here leaves deleteDatabase blocked
        // and the next boot waiting forever for the same database.
        (event.target as IDBDatabase | null)?.close();
        // `blocking` is idb's versionchange handler. Any cached wrapper for
        // this one database is stale once a version change/delete begins.
        for (const connection of openConnections) connection.close();
        openConnections.clear();
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    });

    const attempt = Promise.race([opening, blocked, timeout.promise])
      .then(db => {
        if (resetInProgress || abandoned) {
          db.close();
          throw new Error('Becoming IndexedDB opened while a reset was in progress.');
        }
        openConnections.add(db);
        return db;
      })
      .finally(() => timeout.cancel());

    dbPromise = attempt;
    void attempt.catch(() => {
      abandoned = true;
      if (dbPromise === attempt) dbPromise = null;
    });
    // An IDB open request cannot be cancelled. If it resolves after our
    // timeout/blocked fallback, close the late connection immediately so it
    // cannot obstruct reset or a later healthy boot.
    void opening.then(db => {
      if (abandoned || resetInProgress) {
        db.close();
        openConnections.delete(db);
      }
    }).catch(() => undefined);
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
      y: Math.max(54, Math.min(76, Number.isFinite(obj.y) ? obj.y : 64)),
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
    exportedAt: Date.now(),
    state: { ...state, lastSaved: Date.now() },
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

/**
 * Boot is deliberately finite. IndexedDB can leave an open/get request
 * pending forever without firing success or error; a missing or unreadable
 * local save must therefore enter the existing hatch flow instead of keeping
 * the entire application on its first-paint Loading sentinel.
 */
export async function loadGameStateForBoot(
  loader: () => Promise<GameState | null> = loadGameState,
  timeoutMs = BOOT_LOAD_TIMEOUT_MS,
): Promise<GameState | null> {
  const timeout = timeoutAfter(timeoutMs, 'Loading Becoming state timed out.');
  try {
    return await Promise.race([loader(), timeout.promise]);
  } catch (error) {
    console.warn('Becoming could not read local state during boot; opening the hatch flow.', error);
    return null;
  } finally {
    timeout.cancel();
  }
}

async function writeGameState(state: GameState): Promise<void> {
  const db = await getDB();
  const toSave = { ...state, lastSaved: Date.now() };
  await db.put('gameState', toSave, 'current');
  if (Math.random() < 0.1) {
    await db.put('snapshots', { timestamp: Date.now(), state: toSave });
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
    for (const db of openConnections) db.close();
    openConnections.clear();
    dbPromise = null;

    // Closing the connection rejects normal in-flight writes. Bound the drain
    // as a second defence against a browser that leaves an IDB operation
    // pending forever; resetInProgress makes any late open close itself.
    const drainTimeout = timeoutAfter(DB_OPEN_TIMEOUT_MS, 'Waiting for Becoming saves timed out.');
    try {
      await Promise.race([saveQueue.catch(() => undefined), drainTimeout.promise]).catch(() => undefined);
    } finally {
      drainTimeout.cancel();
    }
    for (const db of openConnections) db.close();
    openConnections.clear();
    dbPromise = null;

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

export async function loadMemoryBook(): Promise<MemoryBookEntry[]> {
  const db = await getDB();
  const entries = await db.getAll('memoryBook');
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

export async function addMemoryBookEntry(entry: MemoryBookEntry): Promise<void> {
  const db = await getDB();
  await db.put('memoryBook', entry, `${entry.day}-${entry.timestamp}`);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('gameState');
  await db.clear('memoryBook');
  await db.clear('snapshots');
}
