import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GameState, MemoryBookEntry } from '../types';

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

  // Ensure creatureBehavior exists
  if (!migrated.creatureBehavior) {
    migrated.creatureBehavior = 'idle';
  }

  // Ensure inventory exists (for old saves where everything was in roomObjects)
  if (!migrated.inventory) {
    migrated.inventory = [];
  }

  // Ensure room objects have new fields
  if (migrated.roomObjects) {
    migrated.roomObjects = migrated.roomObjects.map(obj => ({
      ...obj,
      placedByUser: obj.placedByUser ?? true,
      beingUsedByCreature: obj.beingUsedByCreature ?? false,
    }));
  }

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
