import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GameState, MemoryBookEntry, ObjectType } from '../types';

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
const BASE_INVENTORY: ObjectType[] = ['apple', 'broccoli', 'ball', 'blanket', 'paper', 'pencil', 'box', 'stone', 'mirror'];

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

function migrateState(state: GameState): GameState {
  // Migrate old state that may be missing new fields
  const migrated = { ...state };

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

  // Ensure hatched creatures never have stage 'egg'
  if (migrated.development.hatched && migrated.development.stage === 'egg') {
    migrated.development = {
      ...migrated.development,
      stage: 'newborn',
      cognitiveLevel: Math.max(5, migrated.development.cognitiveLevel),
    };
  }

  return migrated;
}

export async function loadGameState(): Promise<GameState | null> {
  const db = await getDB();
  const result = await db.get('gameState', 'current');
  if (!result) return null;
  return migrateState(result);
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
