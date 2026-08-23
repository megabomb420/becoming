import { CreatureIdentity, CreatureAppearance, GameState, DevelopmentState, Needs, PersonalityTraits, RelationshipModel, SocialLearningState, ConversationState, ObjectType } from '../types';
import { createBondState, createObjectPreferences } from './relationshipSystem';
import { createLifePathState } from './lifePathSystem';
import { createInnerLifeState } from './innerLifeSystem';
import { createContinuityState } from './continuitySystem';
import { createPresenceState } from './presenceSystem';
import { createTouchBoundaryState } from './boundarySystem';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateAppearance(rand: () => number): CreatureAppearance {
  const earOptions: CreatureAppearance['earShape'][] = ['none', 'small', 'round', 'pointy'];
  return {
    baseHue: Math.floor(rand() * 360),
    eyeSize: 0.7 + rand() * 0.5,
    roundness: 0.6 + rand() * 0.4,
    earShape: earOptions[Math.floor(rand() * earOptions.length)],
    tailLength: rand() > 0.3 ? rand() : 0,
    markings: rand() > 0.6 ? ['spot'] : [],
  };
}

function generatePersonality(rand: () => number): PersonalityTraits {
  return {
    curiosity: rand() * 100,
    caution: rand() * 100,
    affection: 30 + rand() * 50,
    independence: rand() * 100,
    calmness: 30 + rand() * 50,
    impulsiveness: rand() * 100,
    optimism: 40 + rand() * 60,
    stubbornness: rand() * 100,
    confidence: 20 + rand() * 40,
    sociability: 30 + rand() * 60,
  };
}

const ALL_INVENTORY_ITEMS: ObjectType[] = [
  'apple', 'broccoli', 'ball', 'blanket', 'paper', 'pencil', 'box', 'stone', 'mirror',
];

export function createNewCreature(name: string | null = null, seed = Date.now()): GameState {
  const rand = seededRandom(seed);
  const birthTime = Date.now();

  const identity: CreatureIdentity = {
    id: `creature-${seed}`,
    name,
    birthTimestamp: birthTime,
    seed,
    appearance: generateAppearance(rand),
  };

  const development: DevelopmentState = {
    chronologicalAge: 0,
    cognitiveLevel: 0,
    languageLevel: 0,
    emotionalLevel: 0,
    independence: 0,
    stage: 'egg',
    hatched: false,
  };

  const needs: Needs = {
    hunger: 40 + rand() * 30,
    energy: 60 + rand() * 30,
    comfort: 50 + rand() * 30,
    stimulation: 40 + rand() * 30,
    social: 30 + rand() * 40,
  };

  const personality = generatePersonality(rand);

  const relationship: RelationshipModel = {
    trust: 20,
    attachment: 10,
    familiarity: 0,
    inferredTraits: [],
    routines: [],
  };

  const socialLearning: SocialLearningState = {
    observations: [],
    imitated: [],
    activeCuriosities: [],
    noticedUserConsistency: false,
    lastBehaviourQuestion: 0,
  };

  const conversation: ConversationState = {
    messages: [],
    facts: [],
    totalUserMessages: 0,
    totalCreatureMessages: 0,
    language: 'unknown',
    lastConversationAt: 0,
    lastCreatureMessage: null,
  };

  const state: GameState = {
    identity,
    needs,
    personality,
    lifePath: createLifePathState(personality, birthTime),
    development,
    memories: [],
    vocabulary: [],
    relationship,
    bond: createBondState(relationship),
    roomObjects: [],
    inventory: [...ALL_INVENTORY_ITEMS],
    objectPreferences: createObjectPreferences(personality, seed),
    interests: [],
    innerLife: createInnerLifeState(birthTime),
    socialLearning,
    conversation,
    continuity: createContinuityState(),
    presence: createPresenceState(birthTime),
    creations: [],
    touchBoundaries: createTouchBoundaryState(),
    lastSaved: birthTime,
    currentActivity: null,
    emotionalState: 'neutral',
    sleepState: 'awake',
    position: { x: 50, y: 60 },
    facing: 'right',
    creatureBehavior: 'idle',
  };

  return state;
}

export function createHatchedCreature(eggState: GameState): GameState {
  return {
    ...eggState,
    development: {
      ...eggState.development,
      stage: 'newborn',
      chronologicalAge: 0,
      hatched: true,
      // Ensure newborn starts with enough cognitive level so
      // development system never regresses to egg
      cognitiveLevel: Math.max(5, eggState.development.cognitiveLevel),
    },
    emotionalState: 'curious',
    creatureBehavior: 'idle',
  };
}
