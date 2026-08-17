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
