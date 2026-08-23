import { CreationStage, CreatureCreation, GameState, Memory, ObjectType } from '../types';
import { getRankedInterests } from './innerLifeSystem';
import { getLifePathTitle } from './lifePathSystem';

const STAGES: Array<{ stage: CreationStage; threshold: number; cognitive: number; language: number }> = [
  { stage: 'mark', threshold: 1, cognitive: 8, language: 0 },
  { stage: 'shape', threshold: 4, cognitive: 15, language: 0 },
  { stage: 'picture', threshold: 8, cognitive: 28, language: 0 },
  { stage: 'message', threshold: 12, cognitive: 38, language: 32 },
];

const GLYPHS: Record<CreationStage, string[]> = {
  mark: ['∿', '〰', '⌁', '◜'],
  shape: ['△ ○', '□ ◌', '◇ ·', '○—○'],
  picture: ['☾ ⋆', '⌂ ♡', '☁ ◡', '♧ ☀'],
  message: ['♡', '→ home', 'you + me', 'still here'],
};

function stableIndex(state: GameState, stage: CreationStage, length: number): number {
  const stageIndex = STAGES.findIndex(item => item.stage === stage);
  return Math.abs((state.identity.seed * 31 + stageIndex * 17 + state.creations.length * 13) % length);
}

function inspiration(state: GameState, language: 'en' | 'pl'): string {
  const topInterest = getRankedInterests(state, 1, language)[0]?.label;
  if (topInterest) return topInterest;
  if (state.lifePath.primary) return getLifePathTitle(state, language);
  return language === 'pl' ? 'pokój' : 'the room';
}

function copy(stage: CreationStage, source: string, polish: boolean): { title: string; description: string } {
  if (polish) {
    if (stage === 'mark') return { title: 'Pierwszy ślad', description: 'Krzywa linia zrobiona celowo. Stworek długo sprawdzał, czy nadal tam jest.' };
    if (stage === 'shape') return { title: 'Coś, co wraca', description: `Kilka znaków zaczęło tworzyć własny rytm. Inspiracją było: ${source}.` };
    if (stage === 'picture') return { title: 'Widok z naszego pokoju', description: `Pierwszy obrazek, który miał przedstawiać coś więcej niż ruch ołówka: ${source}.` };
    return { title: 'Wiadomość dla ciebie', description: 'Nie jest równa ani idealna, ale została napisana świadomie: „jesteś tutaj ze mną”.' };
  }
  if (stage === 'mark') return { title: 'The first mark', description: 'A crooked line made on purpose. The creature kept checking that it was still there.' };
  if (stage === 'shape') return { title: 'Something that repeats', description: `A few marks found their own rhythm, inspired by ${source}.` };
  if (stage === 'picture') return { title: 'A view from our room', description: `The first picture meant to hold more than the movement of a pencil: ${source}.` };
  return { title: 'A message for you', description: 'It is uneven and imperfect, but written deliberately: “you are here with me”.' };
}

export function migrateCreations(value: Partial<CreatureCreation>[] | null | undefined): CreatureCreation[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<CreationStage>(['mark', 'shape', 'picture', 'message']);
  return value.slice(-40).flatMap(item => {
    if (!item || !allowed.has(item.stage as CreationStage)) return [];
    return [{
      id: typeof item.id === 'string' ? item.id.slice(0, 80) : `creation-${item.stage}-${Number(item.createdAt) || Date.now()}`,
      stage: item.stage as CreationStage,
      title: typeof item.title === 'string' ? item.title.slice(0, 80) : String(item.stage),
      description: typeof item.description === 'string' ? item.description.slice(0, 320) : '',
      glyph: typeof item.glyph === 'string' ? item.glyph.slice(0, 32) : '·',
      inspiration: typeof item.inspiration === 'string' ? item.inspiration.slice(0, 48) : 'the room',
      createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
    }];
  });
}

function eligibleStage(state: GameState): CreationStage | null {
  const mastery = state.objectPreferences.paper.interactions + state.objectPreferences.pencil.interactions;
  return STAGES.find(item => (
    mastery >= item.threshold
    && state.development.cognitiveLevel >= item.cognitive
    && state.development.languageLevel >= item.language
    && !state.creations.some(creation => creation.stage === item.stage)
  ))?.stage ?? null;
}

export function evolveCreationFromObject(state: GameState, type: ObjectType, now = Date.now()): GameState {
  if (type !== 'paper' && type !== 'pencil') return state;
  const hasPaper = state.roomObjects.some(object => object.type === 'paper');
  const hasPencil = state.roomObjects.some(object => object.type === 'pencil');
  if (!hasPaper || !hasPencil) return state;
  const stage = eligibleStage(state);
  if (!stage) return state;

  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const source = inspiration(state, language);
  const words = copy(stage, source, state.conversation.language === 'pl');
  const glyphs = GLYPHS[stage];
  const creation: CreatureCreation = {
    id: `creation-${stage}-${now}`,
    stage,
    title: words.title,
    description: words.description,
    glyph: glyphs[stableIndex(state, stage, glyphs.length)],
    inspiration: source,
    createdAt: now,
  };
  const memory: Memory = {
    id: `mem-${creation.id}`,
    timestamp: now,
    content: `made “${creation.title}” with paper and pencil`,
    importance: stage === 'message' ? 9 : stage === 'picture' ? 8 : stage === 'shape' ? 7 : 6,
    emotionalValence: 0.75,
    tags: ['creation', stage, source],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 25,
    compressed: false,
  };

  return {
    ...state,
    creations: [...state.creations, creation].slice(-40),
    memories: [...state.memories, memory].slice(-200),
    roomObjects: state.roomObjects.map(object => object.type === 'paper'
      ? { ...object, state: { ...object.state, status: stage === 'message' ? 'written' : 'drawn', creationId: creation.id } }
      : object),
  };
}

export function getCreationMastery(state: GameState, language: 'en' | 'pl' = 'en'): string {
  const stages = new Set(state.creations.map(creation => creation.stage));
  if (stages.has('message')) return language === 'pl' ? 'pisze krótkie wiadomości' : 'writes small messages';
  if (stages.has('picture')) return language === 'pl' ? 'tworzy obrazki' : 'makes pictures';
  if (stages.has('shape')) return language === 'pl' ? 'łączy kształty' : 'connects shapes';
  if (stages.has('mark')) return language === 'pl' ? 'stawia celowe znaki' : 'makes deliberate marks';
  return language === 'pl' ? 'nie zostawił jeszcze własnego śladu' : 'has not made a mark yet';
}
