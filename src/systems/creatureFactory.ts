import { CreatureIdentity, CreatureAppearance, GameState, DevelopmentState, Needs, PersonalityTraits, RelationshipModel, VocabularyEntry, RoomObject, Memory, Interest, SocialLearningState } from '../types';

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

function createInitialObjects(): RoomObject[] {
  return [
    { id: 'bowl', type: 'food_bowl', x: 80, y: 75, state: { filled: false }, interactions: 0 },
    { id: 'apple', type: 'apple', x: 20, y: 80, state: {}, interactions: 0 },
    { id: 'broccoli', type: 'broccoli', x: 30, y: 85, state: {}, interactions: 0 },
    { id: 'ball', type: 'ball', x: 70, y: 70, state: {}, interactions: 0 },
    { id: 'blanket', type: 'blanket', x: 15, y: 75, state: {}, interactions: 0 },
    { id: 'paper', type: 'paper', x: 85, y: 60, state: { drawn: false }, interactions: 0 },
    { id: 'pencil', type: 'pencil', x: 88, y: 62, state: {}, interactions: 0 },
    { id: 'box', type: 'box', x: 50, y: 78, state: { open: true }, interactions: 0 },
    { id: 'stone', type: 'stone', x: 60, y: 82, state: {}, interactions: 0 },
    { id: 'mirror', type: 'mirror', x: 50, y: 30, state: {}, interactions: 0 },
  ];
}

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

  const state: GameState = {
    identity,
    needs,
    personality,
    development,
    memories: [],
    vocabulary: [],
    relationship,
    roomObjects: createInitialObjects(),
    interests: [],
    socialLearning,
    lastSaved: birthTime,
    currentActivity: null,
    emotionalState: 'neutral',
    sleepState: 'awake',
    position: { x: 50, y: 60 },
    facing: 'right',
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
    },
    emotionalState: 'curious',
  };
}
