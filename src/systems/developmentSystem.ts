import { authoritativeNow } from './authoritativeTime';
import {
  AutonomousMomentId,
  DevelopmentExperienceState,
  DevelopmentStage,
  GameState,
  MeaningfulFirst,
  MeaningfulFirstId,
  Memory,
  ObjectType,
  VocabularyEntry,
} from '../types';

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

function stableUnit(seed: number, salt: number): number {
  const raw = Math.sin(seed * 0.00019 + salt * 71.733) * 10000;
  return raw - Math.floor(raw);
}

export function createDevelopmentExperience(seed: number): DevelopmentExperienceState {
  return {
    firsts: [],
    recentAutonomy: [],
    lastAutonomousAt: 0,
    preferredRestSpot: {
      x: 29 + stableUnit(seed, 3) * 42,
      y: 59 + stableUnit(seed, 5) * 10,
    },
    favoriteObject: null,
  };
}

export function migrateDevelopmentExperience(
  value: Partial<DevelopmentExperienceState> | null | undefined,
  seed: number,
): DevelopmentExperienceState {
  const base = createDevelopmentExperience(seed);
  const allowedFirsts = new Set<MeaningfulFirstId>([
    'first_word',
    'first_spontaneous_approach',
    'first_refusal',
    'first_favorite',
    'first_dream',
    'first_creation',
    'first_opinion',
    'first_shared_saying',
    'mirror_recognition',
    'first_autonomous_object',
  ]);
  const allowedAutonomy = new Set<AutonomousMomentId>([
    'listen',
    'watch_dust',
    'stretch',
    'sniff',
    'yawn',
    'seek_user',
    'cautious_probe',
    'bold_test',
    'independent_nearby',
    'steadfast_rest',
    'favorite_return',
    'mirror_check',
    'imitate_user',
    'rehearse_word',
    'continue_creation',
  ]);
  const firsts = Array.isArray(value?.firsts) ? value.firsts.slice(-24).flatMap(item => {
    const first = item as Partial<MeaningfulFirst>;
    if (!allowedFirsts.has(first.id as MeaningfulFirstId) || !Number.isFinite(first.timestamp)) return [];
    const fallback = meaningfulFirstCopy(first.id as MeaningfulFirstId);
    return [{
      ...fallback,
      id: first.id as MeaningfulFirstId,
      timestamp: Number(first.timestamp),
      titleEn: typeof first.titleEn === 'string' ? first.titleEn.slice(0, 80) : fallback.titleEn,
      titlePl: typeof first.titlePl === 'string' ? first.titlePl.slice(0, 80) : fallback.titlePl,
      detailEn: typeof first.detailEn === 'string' ? first.detailEn.slice(0, 240) : fallback.detailEn,
      detailPl: typeof first.detailPl === 'string' ? first.detailPl.slice(0, 240) : fallback.detailPl,
      announced: first.announced === true,
    }];
  }) : [];
  const recentAutonomy = Array.isArray(value?.recentAutonomy) ? value.recentAutonomy.slice(-18).flatMap(item => {
    if (!item || !allowedAutonomy.has(item.id as AutonomousMomentId) || !Number.isFinite(item.timestamp)) return [];
    return [{
      id: item.id as AutonomousMomentId,
      timestamp: Number(item.timestamp),
      objectType: typeof item.objectType === 'string' ? item.objectType as ObjectType : undefined,
    }];
  }) : [];
  const rest = value?.preferredRestSpot;
  return {
    firsts,
    recentAutonomy,
    lastAutonomousAt: Number.isFinite(value?.lastAutonomousAt) ? Number(value?.lastAutonomousAt) : 0,
    preferredRestSpot: rest && Number.isFinite(rest.x) && Number.isFinite(rest.y)
      ? { x: Math.max(18, Math.min(82, Number(rest.x))), y: Math.max(54, Math.min(73, Number(rest.y))) }
      : base.preferredRestSpot,
    favoriteObject: typeof value?.favoriteObject === 'string' ? value.favoriteObject as ObjectType : null,
  };
}

function meaningfulFirstCopy(id: MeaningfulFirstId): Omit<MeaningfulFirst, 'timestamp' | 'announced'> {
  const copy: Record<MeaningfulFirstId, Omit<MeaningfulFirst, 'timestamp' | 'announced'>> = {
    first_word: {
      id,
      titleEn: 'A word became its own',
      titlePl: 'Słowo stało się jego',
      detailEn: 'A sound returned with intention, no longer only an echo.',
      detailPl: 'Dźwięk wrócił z intencją — nie był już tylko echem.',
    },
    first_spontaneous_approach: {
      id,
      titleEn: 'It came closer by itself',
      titlePl: 'Samo podeszło bliżej',
      detailEn: 'For the first time, closeness was its decision.',
      detailPl: 'Po raz pierwszy bliskość była jego decyzją.',
    },
    first_refusal: {
      id,
      titleEn: 'A small no',
      titlePl: 'Małe „nie”',
      detailEn: 'It discovered that trust can include asking for space.',
      detailPl: 'Odkryło, że zaufanie może też oznaczać prośbę o przestrzeń.',
    },
    first_favorite: {
      id,
      titleEn: 'Something became a favorite',
      titlePl: 'Coś stało się ulubione',
      detailEn: 'It returned to one thing often enough for preference to become attachment.',
      detailPl: 'Wracało do jednej rzeczy tak często, aż upodobanie stało się przywiązaniem.',
    },
    first_dream: {
      id,
      titleEn: 'The first dream',
      titlePl: 'Pierwszy sen',
      detailEn: 'Memory loosened its edges and became somewhere new.',
      detailPl: 'Wspomnienie straciło ostre krawędzie i stało się nowym miejscem.',
    },
    first_creation: {
      id,
      titleEn: 'The first deliberate mark',
      titlePl: 'Pierwszy zamierzony ślad',
      detailEn: 'Something appeared in the room that had not existed before.',
      detailPl: 'W pokoju pojawiło się coś, czego wcześniej nie było.',
    },
    first_opinion: {
      id,
      titleEn: 'An opinion of its own',
      titlePl: 'Własne zdanie',
      detailEn: 'It did not only remember a subject; it began to take a position.',
      detailPl: 'Nie tylko zapamiętało temat — zaczęło zajmować własne stanowisko.',
    },
    first_shared_saying: {
      id,
      titleEn: 'A phrase became ours',
      titlePl: 'Zdanie stało się nasze',
      detailEn: 'Repetition turned ordinary words into a private piece of language.',
      detailPl: 'Powtórzenie zmieniło zwykłe słowa w kawałek wspólnego języka.',
    },
    mirror_recognition: {
      id,
      titleEn: 'It recognized itself',
      titlePl: 'Rozpoznało siebie',
      detailEn: 'The other creature in the glass finally became “me”.',
      detailPl: 'Inny stworek w szkle w końcu stał się „mną”.',
    },
    first_autonomous_object: {
      id,
      titleEn: 'It chose what to do',
      titlePl: 'Samo wybrało, co zrobić',
      detailEn: 'A familiar thing was used without waiting to be shown.',
      detailPl: 'Użyło znanej rzeczy, nie czekając na podpowiedź.',
    },
  };
  return copy[id];
}

export function recordMeaningfulFirst(state: GameState, id: MeaningfulFirstId, now = authoritativeNow()): GameState {
  const experience = migrateDevelopmentExperience(state.development.experience, state.identity.seed);
  if (experience.firsts.some(first => first.id === id)) return state;
  const first: MeaningfulFirst = { ...meaningfulFirstCopy(id), timestamp: now, announced: false };
  const memory: Memory = {
    id: `mem-first-${id}-${now}`,
    timestamp: now,
    content: first.titleEn,
    importance: 8,
    emotionalValence: 0.75,
    tags: ['development', 'first', id],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 20,
    compressed: false,
  };
  return {
    ...state,
    development: {
      ...state.development,
      experience: { ...experience, firsts: [...experience.firsts, first].slice(-24) },
    },
    memories: [...state.memories, memory].slice(-200),
  };
}

export function getPendingMeaningfulFirst(state: GameState): MeaningfulFirst | null {
  return state.development.experience?.firsts.find(first => !first.announced) ?? null;
}

export function markMeaningfulFirstAnnounced(state: GameState, id: MeaningfulFirstId): GameState {
  const experience = migrateDevelopmentExperience(state.development.experience, state.identity.seed);
  if (!experience.firsts.some(first => first.id === id && !first.announced)) return state;
  return {
    ...state,
    development: {
      ...state.development,
      experience: {
        ...experience,
        firsts: experience.firsts.map(first => first.id === id ? { ...first, announced: true } : first),
      },
    },
  };
}

export function recordAutonomousMoment(
  state: GameState,
  id: AutonomousMomentId,
  now = authoritativeNow(),
  objectType?: ObjectType,
): GameState {
  const experience = migrateDevelopmentExperience(state.development.experience, state.identity.seed);
  return {
    ...state,
    development: {
      ...state.development,
      experience: {
        ...experience,
        recentAutonomy: [...experience.recentAutonomy, { id, timestamp: now, objectType }].slice(-18),
        lastAutonomousAt: now,
      },
    },
  };
}

function refusalCount(state: GameState): number {
  return state.touchBoundaries.boundariesShown
    + Object.values(state.objectPreferences).reduce((sum, preference) => sum + preference.refusals, 0);
}

function strongestFavorite(state: GameState): ObjectType | null {
  const ranked = (Object.entries(state.objectPreferences) as Array<[ObjectType, GameState['objectPreferences'][ObjectType]]>)
    .filter(([, preference]) => preference.interactions >= 2 && preference.affinity >= 16)
    .sort((a, b) => b[1].affinity - a[1].affinity || b[1].interactions - a[1].interactions);
  return ranked[0]?.[0] ?? null;
}

/**
 * Observe transitions already produced by the existing systems. This does not
 * create another gameplay loop: it gives important changes one shared memory
 * language and lets Room stage them once, without extra timers or AI calls.
 */
export function observeDevelopmentSignals(previous: GameState, nextInput: GameState, now = authoritativeNow()): GameState {
  let next = nextInput;
  const favorite = strongestFavorite(next);
  const currentExperience = migrateDevelopmentExperience(next.development.experience, next.identity.seed);
  if (favorite !== currentExperience.favoriteObject) {
    next = {
      ...next,
      development: {
        ...next.development,
        experience: { ...currentExperience, favoriteObject: favorite },
      },
    };
  }
  if (previous.vocabulary.length === 0 && next.vocabulary.length > 0) next = recordMeaningfulFirst(next, 'first_word', now);
  if (refusalCount(previous) === 0 && refusalCount(next) > 0) next = recordMeaningfulFirst(next, 'first_refusal', now);
  if (!previous.development.experience?.favoriteObject && favorite) next = recordMeaningfulFirst(next, 'first_favorite', now);
  if (previous.innerLife.dreams.length === 0 && next.innerLife.dreams.length > 0) next = recordMeaningfulFirst(next, 'first_dream', now);
  if (previous.creations.length === 0 && next.creations.length > 0) next = recordMeaningfulFirst(next, 'first_creation', now);
  if (previous.innerLife.opinions.length === 0 && next.innerLife.opinions.length > 0) next = recordMeaningfulFirst(next, 'first_opinion', now);
  const hadSaying = previous.sharedLanguage.phrases.some(phrase => phrase.adoptedAt);
  const hasSaying = next.sharedLanguage.phrases.some(phrase => phrase.adoptedAt);
  if (!hadSaying && hasSaying) next = recordMeaningfulFirst(next, 'first_shared_saying', now);
  const recognized = new Set(['recognized', 'reflective']);
  if (!recognized.has(previous.innerLife.selfAwareness.stage) && recognized.has(next.innerLife.selfAwareness.stage)) {
    next = recordMeaningfulFirst(next, 'mirror_recognition', now);
  }
  return next;
}

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

export function updateDevelopment(state: GameState, activeMinutes: number, now = authoritativeNow()): GameState {
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
      id: `mem-stage-${now}`,
      timestamp: now,
      content: getDevelopmentMilestoneText(newStage, 'en'),
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
          learnedAt: now + i * 1000,
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

  const now = authoritativeNow();
  const memory: Memory = {
    id: `mem-stage-${now}`,
    timestamp: now,
    content: getDevelopmentMilestoneText(next.development.stage, 'en'),
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
export function syncDevelopmentWithAge(state: GameState, now = authoritativeNow()): GameState {
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
export function advanceDevelopmentFromConversation(state: GameState, now = authoritativeNow()): GameState {
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

export function getDevelopmentLabel(stage: DevelopmentStage, language: 'en' | 'pl' = 'en'): string {
  const english = {
    egg: 'Unhatched',
    newborn: 'Newborn',
    animal: 'Listening',
    communicating: 'Finding a voice',
    first_words: 'First words',
    combining: 'Learning thoughts',
    sentences: 'Young mind',
    mature: 'Mature mind',
  }[stage];
  const polish = {
    egg: 'Przed wykluciem',
    newborn: 'Noworodek',
    animal: 'Nasłuchuje',
    communicating: 'Szuka głosu',
    first_words: 'Pierwsze słowa',
    combining: 'Układa myśli',
    sentences: 'Młody umysł',
    mature: 'Dojrzały umysł',
  }[stage];
  return language === 'pl' ? polish : english;
}

export function getDevelopmentMilestoneText(stage: DevelopmentStage, language: 'en' | 'pl' = 'en'): string {
  const label = getDevelopmentLabel(stage, language);
  return language === 'pl' ? `Osiągnęło etap: ${label}` : `Reached ${label}`;
}

export function getDevelopmentStageFromMemory(content: string): DevelopmentStage | null {
  const match = content.trim().match(/^(?:reached|osiągnęło etap:)\s+(.+)$/i);
  if (!match) return null;
  const value = match[1].trim().toLocaleLowerCase();
  const stages: DevelopmentStage[] = ['egg', 'newborn', 'animal', 'communicating', 'first_words', 'combining', 'sentences', 'mature'];
  return stages.find(stage => (
    stage === value
    || getDevelopmentLabel(stage, 'en').toLocaleLowerCase() === value
    || getDevelopmentLabel(stage, 'pl').toLocaleLowerCase() === value
  )) ?? null;
}

export const DEVELOPMENT_STAGES: DevelopmentStage[] = ['egg', 'newborn', 'animal', 'communicating', 'first_words', 'combining', 'sentences', 'mature'];

/**
 * Repairs prose that older versions generated with the raw internal stage id
 * embedded — for example a dream fragment stored as "reached first_words
 * floated above the room…". Only genuinely snake-case stage ids (today just
 * `first_words`) are remapped, because a bare single-word label such as
 * "animal" is ordinary prose and must never be rewritten. Milestone phrases
 * keep their canonical form ("Reached First words"). Idempotent: already-clean
 * prose is returned unchanged.
 */
export function mapLegacyStageIdsInProse(text: string): string {
  if (!text || !text.includes('_')) return text;
  const pattern = DEVELOPMENT_STAGES.filter(stage => stage.includes('_')).join('|');
  return text
    .replace(new RegExp(`\\breached\\s+(${pattern})\\b`, 'gi'), (_match, stage: string) => getDevelopmentMilestoneText(stage as DevelopmentStage, 'en'))
    .replace(new RegExp(`\\bosiągnęło etap:\\s+(${pattern})\\b`, 'gi'), (_match, stage: string) => getDevelopmentMilestoneText(stage as DevelopmentStage, 'pl'))
    .replace(new RegExp(`\\b(${pattern})\\b`, 'g'), (stage: string) => getDevelopmentLabel(stage as DevelopmentStage, 'en'));
}

export function getDevelopmentDescription(stage: DevelopmentStage, language: 'en' | 'pl' = 'en'): string {
  const english = {
    egg: 'Waiting to emerge.',
    newborn: 'It hears your voice before it understands the words.',
    animal: 'It recognises tone and begins collecting familiar sounds.',
    communicating: 'Meaning is forming, one word at a time.',
    first_words: 'It can name fragments of its growing world.',
    combining: 'It joins words, memories and simple opinions.',
    sentences: 'It can reflect on patterns and ask what they mean.',
    mature: 'It speaks with a voice shaped by your shared history.',
  }[stage];
  const polish = {
    egg: 'Czeka, by się pojawić.',
    newborn: 'Słyszy twój głos, zanim zacznie rozumieć słowa.',
    animal: 'Rozpoznaje ton i zaczyna zbierać znajome dźwięki.',
    communicating: 'Znaczenie powstaje po jednym słowie naraz.',
    first_words: 'Potrafi nazwać fragmenty swojego rosnącego świata.',
    combining: 'Łączy słowa, wspomnienia i proste opinie.',
    sentences: 'Rozpoznaje wzorce i pyta, co znaczą.',
    mature: 'Mówi głosem ukształtowanym przez waszą wspólną historię.',
  }[stage];
  return language === 'pl' ? polish : english;
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
    learnedAt: authoritativeNow(),
    confidence: 0.2 + Math.random() * 0.3,
    contexts: [context],
    usageCount: 0,
  };

  const memory: Memory = {
    id: `mem-word-${authoritativeNow()}`,
    timestamp: authoritativeNow(),
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
