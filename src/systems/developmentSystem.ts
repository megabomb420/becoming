import { GameState, DevelopmentStage, Memory, VocabularyEntry } from '../types';

const STAGE_THRESHOLDS: Record<DevelopmentStage, { cognitive: number; language: number }> = {
  egg: { cognitive: 0, language: 0 },
  newborn: { cognitive: 5, language: 0 },
  animal: { cognitive: 15, language: 0 },
  communicating: { cognitive: 30, language: 10 },
  first_words: { cognitive: 45, language: 25 },
  combining: { cognitive: 60, language: 45 },
  sentences: { cognitive: 75, language: 65 },
  mature: { cognitive: 90, language: 85 },
};

export function getStageFromLevels(cognitive: number, language: number, hatched: boolean): DevelopmentStage {
  const stages: DevelopmentStage[] = ['mature', 'sentences', 'combining', 'first_words', 'communicating', 'animal', 'newborn', 'egg'];
  for (const stage of stages) {
    const t = STAGE_THRESHOLDS[stage];
    if (cognitive >= t.cognitive && language >= t.language) return stage;
  }
  // Once hatched, never regress to egg. Minimum stage is newborn.
  if (hatched) return 'newborn';
  return 'egg';
}

export function updateDevelopment(state: GameState, activeMinutes: number): GameState {
  const personality = state.personality;
  const stimulation = state.needs.stimulation;
  const social = state.needs.social;

  // Development is driven by interaction, stimulation, and time
  const cognitiveGain = activeMinutes * 0.01 * (1 + personality.curiosity / 100) * (stimulation > 30 ? 1 : 0.5);
  const languageGain = activeMinutes * 0.008 * (1 + personality.sociability / 100) * (social > 20 ? 1 : 0.3);
  const emotionalGain = activeMinutes * 0.005 * (1 + personality.affection / 100);
  const independenceGain = activeMinutes * 0.003 * (personality.independence / 100);

  const newCognitive = Math.min(100, state.development.cognitiveLevel + cognitiveGain);
  const newLanguage = Math.min(100, state.development.languageLevel + languageGain);
  const newStage = getStageFromLevels(newCognitive, newLanguage, state.development.hatched);

  const newState: GameState = {
    ...state,
    development: {
      ...state.development,
      chronologicalAge: state.development.chronologicalAge + activeMinutes * 60000,
      cognitiveLevel: newCognitive,
      languageLevel: newLanguage,
      emotionalLevel: Math.min(100, state.development.emotionalLevel + emotionalGain),
      independence: Math.min(100, state.development.independence + independenceGain),
      stage: newStage,
    },
  };

  // Check for stage transitions and create memories
  if (newStage !== state.development.stage) {
    const stageMemories: Memory[] = [{
      id: `mem-stage-${Date.now()}`,
      timestamp: Date.now(),
      content: `reached ${newStage}`,
      importance: 8,
      emotionalValence: 0.6,
      tags: ['development', 'milestone'],
      mentioned: false,
      understood: newCognitive > 40,
      compressed: false,
    }];

    // Add vocabulary when reaching new language stages
    const newVocab: VocabularyEntry[] = [];
    if (newStage === 'first_words' && state.development.stage !== 'first_words') {
      const firstWords = ['you', 'food', 'no', 'more'];
      firstWords.forEach((word, i) => {
        newVocab.push({
          word,
          learnedAt: Date.now() + i * 1000,
          confidence: 0.3,
          contexts: ['early'],
          usageCount: 0,
        });
      });
    }

    return {
      ...newState,
      memories: [...newState.memories, ...stageMemories].slice(-200),
      vocabulary: [...newState.vocabulary, ...newVocab],
    };
  }

  return newState;
}

const AGE_FLOORS = [
  { days: 60, cognitive: 90, language: 85, emotional: 80, independence: 70 },
  { days: 30, cognitive: 75, language: 65, emotional: 65, independence: 52 },
  { days: 14, cognitive: 60, language: 45, emotional: 50, independence: 38 },
  { days: 7, cognitive: 45, language: 25, emotional: 38, independence: 25 },
  { days: 3, cognitive: 30, language: 10, emotional: 25, independence: 14 },
  { days: 1, cognitive: 15, language: 3, emotional: 12, independence: 5 },
  { days: 0, cognitive: 5, language: 0, emotional: 0, independence: 0 },
];

function addGrowthMilestone(previous: GameState, next: GameState): GameState {
  if (next.development.stage === previous.development.stage) return next;

  const now = Date.now();
  const memory: Memory = {
    id: `mem-stage-${now}`,
    timestamp: now,
    content: `reached ${next.development.stage}`,
    importance: 8,
    emotionalValence: 0.6,
    tags: ['development', 'milestone'],
    mentioned: false,
    understood: next.development.cognitiveLevel > 40,
    compressed: false,
  };

  const hasFirstWords = next.vocabulary.some(entry => ['you', 'food', 'no', 'more'].includes(entry.word));
  const firstWords: VocabularyEntry[] = next.development.languageLevel >= 25 && !hasFirstWords
    ? ['you', 'food', 'no', 'more'].map((word, index) => ({
        word,
        learnedAt: now + index,
        confidence: 0.3,
        contexts: ['early'],
        usageCount: 0,
      }))
    : [];

  return {
    ...next,
    memories: [...next.memories, memory].slice(-200),
    vocabulary: [...next.vocabulary, ...firstWords],
  };
}

/**
 * Real time provides a minimum level of development. Conversation and play can
 * make a creature grow faster, but being left alone can never make it younger.
 */
export function syncDevelopmentWithAge(state: GameState, now = Date.now()): GameState {
  if (!state.development.hatched) return state;

  const chronologicalAge = Math.max(
    state.development.chronologicalAge,
    Math.max(0, now - state.identity.birthTimestamp),
  );
  const ageDays = chronologicalAge / (24 * 60 * 60 * 1000);
  const floor = AGE_FLOORS.find(entry => ageDays >= entry.days) ?? AGE_FLOORS[AGE_FLOORS.length - 1];
  const cognitiveLevel = Math.max(state.development.cognitiveLevel, floor.cognitive);
  const languageLevel = Math.max(state.development.languageLevel, floor.language);
  const next: GameState = {
    ...state,
    development: {
      ...state.development,
      chronologicalAge,
      cognitiveLevel,
      languageLevel,
      emotionalLevel: Math.max(state.development.emotionalLevel, floor.emotional),
      independence: Math.max(state.development.independence, floor.independence),
      stage: getStageFromLevels(cognitiveLevel, languageLevel, true),
    },
  };

  return addGrowthMilestone(state, next);
}

/** One conversation is a meaningful learning event, not just another timer tick. */
export function advanceDevelopmentFromConversation(state: GameState, now = Date.now()): GameState {
  const aged = syncDevelopmentWithAge(state, now);
  const cognitiveGain = 1.7 + aged.personality.curiosity / 100;
  const languageGain = 1.05 + aged.personality.sociability / 160;
  const cognitiveLevel = Math.min(100, aged.development.cognitiveLevel + cognitiveGain);
  const languageLevel = Math.min(100, aged.development.languageLevel + languageGain);
  const next: GameState = {
    ...aged,
    development: {
      ...aged.development,
      cognitiveLevel,
      languageLevel,
      emotionalLevel: Math.min(100, aged.development.emotionalLevel + 0.45),
      independence: Math.min(100, aged.development.independence + 0.12),
      stage: getStageFromLevels(cognitiveLevel, languageLevel, true),
    },
  };

  return addGrowthMilestone(aged, next);
}

export function getDevelopmentLabel(stage: DevelopmentStage): string {
  return {
    egg: 'Unhatched',
    newborn: 'Newborn',
    animal: 'Listening',
    communicating: 'Finding a voice',
    first_words: 'First words',
    combining: 'Learning thoughts',
    sentences: 'Young mind',
    mature: 'Mature mind',
  }[stage];
}

export function getDevelopmentDescription(stage: DevelopmentStage): string {
  return {
    egg: 'Waiting to emerge.',
    newborn: 'It hears your voice before it understands the words.',
    animal: 'It recognises tone and begins collecting familiar sounds.',
    communicating: 'Meaning is forming, one word at a time.',
    first_words: 'It can name fragments of its growing world.',
    combining: 'It joins words, memories and simple opinions.',
    sentences: 'It can reflect on patterns and ask what they mean.',
    mature: 'It speaks with a voice shaped by your shared history.',
  }[stage];
}

export function shouldLearnWord(state: GameState, word: string): boolean {
  if (state.vocabulary.find(v => v.word === word)) return false;
  if (state.development.languageLevel < 10) return false;
  return Math.random() < 0.3 + (state.personality.curiosity / 200);
}

export function learnWord(state: GameState, word: string, context: string): GameState {
  if (!shouldLearnWord(state, word)) return state;

  const entry: VocabularyEntry = {
    word,
    learnedAt: Date.now(),
    confidence: 0.2 + Math.random() * 0.3,
    contexts: [context],
    usageCount: 0,
  };

  const memory: Memory = {
    id: `mem-word-${Date.now()}`,
    timestamp: Date.now(),
    content: `learned word "${word}"`,
    importance: 6,
    emotionalValence: 0.7,
    tags: ['language', 'learning'],
    mentioned: false,
    understood: true,
    compressed: false,
  };

  return {
    ...state,
    vocabulary: [...state.vocabulary, entry],
    memories: [...state.memories, memory].slice(-200),
  };
}
