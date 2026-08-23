import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GameState, MemoryBookEntry, Needs, ObjectType } from '../types';
import { migrateBondState, migrateObjectPreferences } from './relationshipSystem';
import { migrateConversationState } from './conversationSystem';
import { syncDevelopmentWithAge } from './developmentSystem';
import { bootstrapLifePathState, migrateLifePathState } from './lifePathSystem';
import { migrateInnerLifeState, migrateInterests } from './innerLifeSystem';
import { migrateContinuityState } from './continuitySystem';
import { migratePresenceState } from './presenceSystem';
import { migrateCreations } from './creationSystem';
import { migrateTouchBoundaryState } from './boundarySystem';
import { migrateSharedLanguageState } from './sharedLanguageSystem';

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

let dbPromise: Promise<IDBPDatabase<BecomingDB>> | null = null;

function getDB(): Promise<IDBPDatabase<BecomingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BecomingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('gameState');
        db.createObjectStore('memoryBook');
        db.createObjectStore('snapshots', { keyPath: 'timestamp' });
      },
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
  // Existing five-need creatures keep their exact values; physical needs that
  // did not exist before start comfortably instead of punishing an upgrade.
  const oldNeeds = (migrated.needs ?? {}) as Partial<Needs>;
  migrated.needs = {
    hunger: validNeed(oldNeeds.hunger, 78),
    hydration: validNeed(oldNeeds.hydration, 82),
    energy: validNeed(oldNeeds.energy, 78),
    bladder: validNeed(oldNeeds.bladder, 88),
    bowel: validNeed(oldNeeds.bowel, 90),
    hygiene: validNeed(oldNeeds.hygiene, 82),
    comfort: validNeed(oldNeeds.comfort, 78),
    stimulation: validNeed(oldNeeds.stimulation, 74),
    social: validNeed(oldNeeds.social, 74),
  };
  const savedAt = Number.isFinite(migrated.lastSaved) ? migrated.lastSaved : migrated.identity.birthTimestamp;
  migrated.needsUpdatedAt = Number.isFinite(migrated.needsUpdatedAt) ? migrated.needsUpdatedAt : savedAt;

  // Ensure development.hatched exists
  if (typeof migrated.development?.hatched !== 'boolean') {
    migrated.development = {
      ...migrated.development,
      hatched: migrated.development?.stage !== 'egg',
    };
  }

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

export async function saveGameState(state: GameState): Promise<void> {
  const db = await getDB();
  const toSave = { ...state, lastSaved: Date.now() };
  await db.put('gameState', toSave, 'current');
  if (Math.random() < 0.1) {
    await db.put('snapshots', { timestamp: Date.now(), state: toSave });
  }
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
