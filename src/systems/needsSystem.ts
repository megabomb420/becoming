import { GameState, Needs, Memory, RoomMess, RoomMessType } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';

const ACTIVE_DECAY_RATES = {
  hunger: 0.8,
  energy: 0.4,
  comfort: 0.3,
  stimulation: 0.6,
  social: 0.5,
  hygiene: 0.07,
  bladder: 0.32,
  bowel: 0.16,
};

const OFFLINE_DECAY_RATES = {
  hunger: 0.4,
  energy: 0.15,
  comfort: 0.1,
  stimulation: 0.2,
  social: 0.15,
  hygiene: 0.045,
  bladder: 0.2,
  bowel: 0.09,
};

export type NeedUpdateMode = 'active' | 'offline';

export type CareActionResultId =
  | 'pee'
  | 'poop'
  | 'both'
  | 'not_needed'
  | 'washed'
  | 'already_clean'
  | 'cleaned'
  | 'already_tidy';

export interface CareActionResult {
  state: GameState;
  performed: boolean;
  result: CareActionResultId;
  count?: number;
}

export interface CareCycleResult {
  state: GameState;
  accidents: RoomMessType[];
}

const clampNeed = (value: number) => Math.max(0, Math.min(100, value));

export function migrateNeeds(value: Partial<Needs> | undefined): Needs {
  const numberOr = (candidate: unknown, fallback: number) => Number.isFinite(candidate) ? clampNeed(Number(candidate)) : fallback;
  return {
    hunger: numberOr(value?.hunger, 60),
    energy: numberOr(value?.energy, 70),
    comfort: numberOr(value?.comfort, 65),
    stimulation: numberOr(value?.stimulation, 60),
    social: numberOr(value?.social, 55),
    hygiene: numberOr(value?.hygiene, 82),
    bladder: numberOr(value?.bladder, 76),
    bowel: numberOr(value?.bowel, 82),
  };
}

export function migrateRoomMess(value: unknown): RoomMess[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const mess = item as Partial<RoomMess>;
    if (mess.type !== 'pee' && mess.type !== 'poop') return [];
    return [{
      id: typeof mess.id === 'string' ? mess.id : `legacy-mess-${index}`,
      type: mess.type,
      x: Math.max(12, Math.min(88, Number.isFinite(mess.x) ? Number(mess.x) : 50)),
      y: Math.max(56, Math.min(77, Number.isFinite(mess.y) ? Number(mess.y) : 68)),
      createdAt: Number.isFinite(mess.createdAt) ? Number(mess.createdAt) : Date.now(),
    }];
  }).slice(-6);
}

function stableUnit(seed: number, salt: number): number {
  const raw = Math.sin(seed * 0.00037 + salt * 0.000013) * 10000;
  return raw - Math.floor(raw);
}

function createMess(state: GameState, type: RoomMessType, now: number, offset: number): RoomMess {
  const side = stableUnit(state.identity.seed, now + offset) > 0.5 ? 1 : -1;
  return {
    id: `mess-${type}-${now}-${offset}`,
    type,
    x: Math.max(14, Math.min(86, state.position.x + side * (5 + stableUnit(state.identity.seed, now + offset + 1) * 7))),
    y: Math.max(57, Math.min(76, state.position.y + 4 + stableUnit(state.identity.seed, now + offset + 2) * 3)),
    createdAt: now,
  };
}

export function updateNeeds(state: GameState, deltaMinutes: number, mode: NeedUpdateMode = 'active'): Needs {
  const personality = state.personality;
  const needs = migrateNeeds(state.needs);
  const rates = mode === 'offline' ? OFFLINE_DECAY_RATES : ACTIVE_DECAY_RATES;
  const sleeping = state.sleepState === 'sleeping';
  const activityMultiplier = sleeping ? 0.52 : 1;
  const bodyMultiplier = sleeping ? 0.58 : 1;
  const messPenalty = Math.min(0.18, (state.roomMess?.length ?? 0) * 0.035);

  return {
    hunger: clampNeed(needs.hunger - rates.hunger * deltaMinutes * bodyMultiplier * (1 + personality.impulsiveness / 200)),
    energy: clampNeed(needs.energy - rates.energy * deltaMinutes * activityMultiplier * (personality.calmness > 60 ? 0.8 : 1.2)),
    comfort: clampNeed(needs.comfort - rates.comfort * deltaMinutes * activityMultiplier),
    stimulation: clampNeed(needs.stimulation - rates.stimulation * deltaMinutes * activityMultiplier * (personality.curiosity > 60 ? 1.3 : 0.8)),
    social: clampNeed(needs.social - rates.social * deltaMinutes * activityMultiplier * (personality.sociability > 60 ? 1.2 : 0.7)),
    hygiene: clampNeed(needs.hygiene - (rates.hygiene * bodyMultiplier + messPenalty) * deltaMinutes),
    bladder: clampNeed(needs.bladder - rates.bladder * deltaMinutes * bodyMultiplier),
    bowel: clampNeed(needs.bowel - rates.bowel * deltaMinutes * bodyMultiplier),
  };
}

// One existing minute heartbeat owns ordinary physiology. Even a very long
// offline interval creates at most one pee and one poop trace, so reopening
// never floods the room or save file with simulated events.
export function advanceNeeds(state: GameState, deltaMinutes: number, now = Date.now(), mode: NeedUpdateMode = 'active'): CareCycleResult {
  let next: GameState = { ...state, needs: updateNeeds(state, deltaMinutes, mode) };
  const accidents: RoomMessType[] = [];
  const newMess: RoomMess[] = [];

  if (next.development.hatched && next.needs.bladder <= 0) {
    accidents.push('pee');
    newMess.push(createMess(next, 'pee', now, 11));
    next = {
      ...next,
      needs: {
        ...next.needs,
        bladder: 72,
        hygiene: clampNeed(next.needs.hygiene - 12),
        comfort: clampNeed(next.needs.comfort - 4),
      },
    };
  }

  if (next.development.hatched && next.needs.bowel <= 0) {
    accidents.push('poop');
    newMess.push(createMess(next, 'poop', now, 29));
    next = {
      ...next,
      needs: {
        ...next.needs,
        bowel: 82,
        hygiene: clampNeed(next.needs.hygiene - 20),
        comfort: clampNeed(next.needs.comfort - 7),
      },
    };
  }

  if (newMess.length > 0) {
    next = {
      ...next,
      roomMess: [...(next.roomMess ?? []), ...newMess].slice(-6),
      emotionalState: next.sleepState === 'sleeping' ? next.emotionalState : 'concerned',
    };
  }

  return { state: next, accidents };
}

export function getDominantNeed(state: GameState): keyof Needs | null {
  const thresholds = {
    hunger: 30,
    energy: 25,
    comfort: 20,
    stimulation: 25,
    social: 20,
    hygiene: 35,
    bladder: 28,
    bowel: 22,
  };

  let lowest: keyof Needs | null = null;
  let lowestVal = 100;

  for (const [key, threshold] of Object.entries(thresholds)) {
    const val = state.needs[key as keyof Needs];
    if (val < threshold && val < lowestVal) {
      lowest = key as keyof Needs;
      lowestVal = val;
    }
  }

  return lowest;
}

export function feedCreature(state: GameState, foodType: string): GameState {
  const hungerBoost = foodType === 'apple' ? 35 : 30;
  const comfortBoost = foodType === 'apple' ? 5 : 2;

  const newMemories: Memory[] = [];
  if (state.needs.hunger < 40) {
    newMemories.push({
      id: `mem-${Date.now()}`,
      timestamp: Date.now(),
      content: `ate ${foodType} when hungry`,
      importance: 4,
      emotionalValence: 0.5,
      tags: ['food', 'satisfied'],
      mentioned: false,
      understood: state.development.cognitiveLevel > 20,
      compressed: false,
    });
  }

  return {
    ...state,
    needs: {
      ...state.needs,
      hunger: Math.min(100, state.needs.hunger + hungerBoost),
      comfort: Math.min(100, state.needs.comfort + comfortBoost),
      hygiene: clampNeed(state.needs.hygiene - 1),
      bladder: clampNeed(state.needs.bladder - (foodType === 'apple' ? 14 : 8)),
      bowel: clampNeed(state.needs.bowel - (foodType === 'broccoli' ? 18 : 12)),
    },
    memories: [...state.memories, ...newMemories].slice(-200),
  };
}

function addFirstCareMemory(state: GameState, tag: string, content: string, now: number): GameState {
  if (state.memories.some(memory => memory.tags.includes(tag))) return state;
  const memory: Memory = {
    id: `mem-${tag}-${now}`,
    timestamp: now,
    content,
    importance: 4,
    emotionalValence: 0.25,
    tags: ['care', tag],
    mentioned: false,
    understood: state.development.cognitiveLevel > 18,
    compressed: false,
  };
  return { ...state, memories: [...state.memories, memory].slice(-200) };
}

export function useToilet(state: GameState, now = Date.now()): CareActionResult {
  const needsPee = state.needs.bladder < 62;
  const needsPoop = state.needs.bowel < 54;
  if (!needsPee && !needsPoop) return { state, performed: false, result: 'not_needed' };
  const result: CareActionResultId = needsPee && needsPoop ? 'both' : needsPoop ? 'poop' : 'pee';
  let next: GameState = {
    ...state,
    needs: {
      ...state.needs,
      bladder: needsPee ? 100 : state.needs.bladder,
      bowel: needsPoop ? 100 : state.needs.bowel,
      hygiene: clampNeed(state.needs.hygiene + 2),
      comfort: clampNeed(state.needs.comfort + 4),
    },
  };
  next = addFirstCareMemory(next, 'first-toilet', 'used the toilet before the room became messy', now);
  return { state: next, performed: true, result };
}

export function washCreature(state: GameState): CareActionResult {
  if (state.needs.hygiene >= 92) return { state, performed: false, result: 'already_clean' };
  return {
    performed: true,
    result: 'washed',
    state: {
      ...state,
      needs: {
        ...state.needs,
        hygiene: 100,
        comfort: clampNeed(state.needs.comfort + 8),
      },
    },
  };
}

export function cleanRoomMess(state: GameState, messId?: string): CareActionResult {
  const current = state.roomMess ?? [];
  const removed = messId ? current.filter(mess => mess.id === messId) : current;
  if (removed.length === 0) return { state, performed: false, result: 'already_tidy', count: 0 };
  const roomMess = messId ? current.filter(mess => mess.id !== messId) : [];
  return {
    performed: true,
    result: 'cleaned',
    count: removed.length,
    state: {
      ...state,
      roomMess,
      needs: {
        ...state.needs,
        hygiene: clampNeed(state.needs.hygiene + Math.min(8, removed.length * 3)),
        comfort: clampNeed(state.needs.comfort + Math.min(10, removed.length * 4)),
      },
    },
  };
}

export function putToSleep(state: GameState): GameState {
  return {
    ...state,
    sleepState: 'sleeping',
    currentActivity: 'sleeping',
    sleepStartTimestamp: Date.now(),
  };
}

export function wakeUp(state: GameState, now = Date.now()): GameState {
  const sleepStart = state.sleepStartTimestamp ?? state.lastSaved;
  const sleptDuration = state.currentActivity === 'sleeping' ? now - sleepStart : 0;
  const energyGain = Math.min(100, state.needs.energy + (sleptDuration / 60000) * 2);

  const awakeState: GameState = {
    ...state,
    sleepState: 'awake',
    currentActivity: null,
    sleepStartTimestamp: undefined,
    needs: { ...state.needs, energy: Math.min(100, energyGain) },
  };
  return generateDreamAfterSleep(awakeState, sleptDuration, now);
}

export function touchCreature(state: GameState, touchType: 'tap' | 'stroke' | 'hold'): GameState {
  const comfortBoost = touchType === 'stroke' ? 15 : touchType === 'hold' ? 20 : 5;
  const socialBoost = touchType === 'stroke' ? 10 : 5;

  const memories: Memory[] = [];
  if (state.development.stage !== 'egg') {
    memories.push({
      id: `mem-${Date.now()}`,
      timestamp: Date.now(),
      content: `user ${touchType}ed creature`,
      importance: 3,
      emotionalValence: 0.4,
      tags: ['touch', 'social'],
      mentioned: false,
      understood: true,
      compressed: false,
    });
  }

  return {
    ...state,
    needs: {
      ...state.needs,
      comfort: Math.min(100, state.needs.comfort + comfortBoost),
      social: Math.min(100, state.needs.social + socialBoost),
    },
    memories: [...state.memories, ...memories].slice(-200),
  };
}
