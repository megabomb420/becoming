import { GameState, Needs, Memory } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';

const NEED_DECAY_RATES = {
  hunger: 0.8,
  energy: 0.4,
  comfort: 0.3,
  stimulation: 0.6,
  social: 0.5,
};

export function updateNeeds(state: GameState, deltaMinutes: number): Needs {
  const personality = state.personality;
  const multiplier = 1; // deltaMinutes already in minutes

  return {
    hunger: Math.max(0, Math.min(100, state.needs.hunger - NEED_DECAY_RATES.hunger * deltaMinutes * multiplier * (1 + personality.impulsiveness / 200))),
    energy: Math.max(0, Math.min(100, state.needs.energy - NEED_DECAY_RATES.energy * deltaMinutes * multiplier * (personality.calmness > 60 ? 0.8 : 1.2))),
    comfort: Math.max(0, Math.min(100, state.needs.comfort - NEED_DECAY_RATES.comfort * deltaMinutes * multiplier)),
    stimulation: Math.max(0, Math.min(100, state.needs.stimulation - NEED_DECAY_RATES.stimulation * deltaMinutes * multiplier * (personality.curiosity > 60 ? 1.3 : 0.8))),
    social: Math.max(0, Math.min(100, state.needs.social - NEED_DECAY_RATES.social * deltaMinutes * multiplier * (personality.sociability > 60 ? 1.2 : 0.7))),
  };
}

export function getDominantNeed(state: GameState): keyof Needs | null {
  const thresholds = {
    hunger: 30,
    energy: 25,
    comfort: 20,
    stimulation: 25,
    social: 20,
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
    },
    memories: [...state.memories, ...newMemories].slice(-200),
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
