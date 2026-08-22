import { GameState } from '../types';
import { generateSocialSpeech, shouldSpeakSocially } from './socialLearningSystem';

interface SpeechContext {
  trigger: string;
  emotionalState: string;
  recentEvent?: string;
}

export function generateCreatureSpeech(state: GameState, context: SpeechContext): string | null {
  const { development, vocabulary, personality, emotionalState, sleepState } = state;

  if (sleepState === 'sleeping') return null;
  if (development.stage === 'egg') return null;
  if (development.stage === 'newborn') {
    const sounds = ['mip', 'naa', 'ka', 'brr', 'pu'];
    return sounds[Math.floor(Math.random() * sounds.length)];
  }

  const stage = development.stage;

  // Try social learning speech first (relatively rare, contextually meaningful)
  if (shouldSpeakSocially(state)) {
    const social = generateSocialSpeech(state, {
      aboutUser: context.trigger === 'idle' || context.trigger === 'chat',
      expressingOpinion: context.trigger === 'chat' || context.trigger === 'touch',
      askingWhy: context.trigger === 'chat',
    });
    if (social) return social;
  }

  // Stage-based speech generation
  if (stage === 'animal') {
    const sounds = ['mip', 'naa', 'ka', 'brr', 'pu', 'mrr', 'eh'];
    if (Math.random() < 0.3 && vocabulary.length > 0) {
      return vocabulary[0].word;
    }
    const s = sounds[Math.floor(Math.random() * sounds.length)];
    if (Math.random() < 0.3) return s + ' ' + s;
    return s;
  }

  if (stage === 'communicating') {
    const protoWords = vocabulary.map(v => v.word);
    const defaults = ['you', 'food', 'no', 'more'];
    const available = protoWords.length > 0 ? protoWords : defaults;
    return available[Math.floor(Math.random() * available.length)];
  }

  if (stage === 'first_words') {
    const words = vocabulary.length > 0 ? vocabulary.map(v => v.word) : ['you', 'food', 'no', 'more', 'sleep'];
    if (Math.random() < 0.3 && words.length >= 2) {
      return `${words[Math.floor(Math.random() * words.length)]} ${words[Math.floor(Math.random() * words.length)]}`;
    }
    return words[Math.floor(Math.random() * words.length)];
  }

  if (stage === 'combining') {
    const words = vocabulary.map(v => v.word);
    if (words.length < 2) return words[0] || 'mip';
    
    const templates = [
      () => `${words[Math.floor(Math.random() * words.length)]}?`,
      () => `more ${words[Math.floor(Math.random() * words.length)]}`,
      () => `no ${words[Math.floor(Math.random() * words.length)]}`,
      () => `${words[Math.floor(Math.random() * words.length)]} ${words[Math.floor(Math.random() * words.length)]}`,
    ];
    return templates[Math.floor(Math.random() * templates.length)]();
  }

  if (stage === 'sentences' || stage === 'mature') {
    const words = vocabulary.map(v => v.word);
    const relationshipTemplates = state.bond.stage === 'bonded'
      ? [
          () => 'you came back',
          () => 'stay here with me',
          () => 'I knew it was you',
        ]
      : state.bond.stage === 'close'
        ? [
            () => 'I was looking for you',
            () => 'do you remember our game?',
          ]
        : [];
    const complexTemplates = [
      () => `where you go?`,
      () => `don't want that`,
      () => `give back`,
      () => `why you leave?`,
      () => `you usually come now`,
      () => `I made something`,
      () => `do you like it?`,
      () => context.trigger === 'food' ? 'food?' : `where ${words[Math.floor(Math.random() * words.length)]}?`,
      ...relationshipTemplates,
    ];
    return complexTemplates[Math.floor(Math.random() * complexTemplates.length)]();
  }

  return null;
}

export function shouldSpeak(state: GameState): boolean {
  if (state.development.stage === 'egg') return false;
  if (state.sleepState === 'sleeping') return false;
  
  const baseChance = state.personality.sociability / 200;
  const stageMultiplier = {
    newborn: 0.1,
    animal: 0.15,
    communicating: 0.25,
    first_words: 0.35,
    combining: 0.4,
    sentences: 0.5,
    mature: 0.5,
    egg: 0,
  }[state.development.stage];

  return Math.random() < (baseChance + stageMultiplier);
}
