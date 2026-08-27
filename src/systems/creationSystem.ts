import { CreationStage, CreatureCreation, GameState, Memory, ObjectType } from '../types';
import { getRankedInterests } from './innerLifeSystem';
import { getLifePathTitle } from './lifePathSystem';

const DRAWING_STAGES: Array<{ stage: CreationStage; threshold: number; cognitive: number; language: number }> = [
  { stage: 'mark', threshold: 1, cognitive: 8, language: 0 },
  { stage: 'shape', threshold: 4, cognitive: 15, language: 0 },
  { stage: 'picture', threshold: 8, cognitive: 28, language: 0 },
  { stage: 'message', threshold: 12, cognitive: 38, language: 32 },
];

const BOX_STAGES: Array<{ stage: CreationStage; threshold: number; cognitive: number }> = [
  { stage: 'hideaway', threshold: 3, cognitive: 12 },
  { stage: 'den', threshold: 7, cognitive: 24 },
];

const GLYPHS: Record<CreationStage, string[]> = {
  mark: ['∿', '〰', '⌁', '◜'],
  shape: ['△ ○', '□ ◌', '◇ ·', '○—○'],
  picture: ['☾ ⋆', '⌂ ♡', '☁ ◡', '♧ ☀'],
  message: ['♡', '→ home', 'you + me', 'still here'],
  hideaway: ['⌂ ·', '⊏⊐', '//tail'],
  den: ['⌂ ♡', '⊏ · ⊐', 'our corner'],
  keepsake: ['◉', 'stone', 'kept'],
  shared_game: ['○ → ○', 'again', 'your turn'],
};

function stableIndex(state: GameState, stage: CreationStage, length: number): number {
  const stageIndex = Object.keys(GLYPHS).indexOf(stage);
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
    if (stage === 'message') return { title: 'Wiadomość dla ciebie', description: 'Nie jest równa ani idealna, ale została napisana świadomie: „jesteś tutaj ze mną”.' };
    if (stage === 'hideaway') return { title: 'Schowek', description: 'Pudełko przestało być obce. Zostawia tam ogon, jak zakładkę.' };
    if (stage === 'den') return { title: 'Nasze gniazdo', description: `Pudełko stało się miejscem, do którego wraca. Inspiracją było: ${source}.` };
    if (stage === 'keepsake') return { title: 'Mój kamień', description: 'Leży w wybranym miejscu i nie jest już tylko ciężki. Jest jego.' };
    return { title: 'Nasza gra', description: 'Piłka wraca, kiedy ktoś ją toczy. To już nie jest przypadek.' };
  }
  if (stage === 'mark') return { title: 'The first mark', description: 'A crooked line made on purpose. The creature kept checking that it was still there.' };
  if (stage === 'shape') return { title: 'Something that repeats', description: `A few marks found their own rhythm, inspired by ${source}.` };
  if (stage === 'picture') return { title: 'A view from our room', description: `The first picture meant to hold more than the movement of a pencil: ${source}.` };
  if (stage === 'message') return { title: 'A message for you', description: 'It is uneven and imperfect, but written deliberately: “you are here with me”.' };
  if (stage === 'hideaway') return { title: 'A hiding place', description: 'The box is no longer a stranger. A tail stays out like a bookmark.' };
  if (stage === 'den') return { title: 'Our den', description: `The box became a place to return to, inspired by ${source}.` };
  if (stage === 'keepsake') return { title: 'My stone', description: 'It sits in a chosen spot. It is not only heavy now. It is theirs.' };
  return { title: 'Our game', description: 'The ball comes back when someone rolls it. That is no longer an accident.' };
}

export function migrateCreations(value: Partial<CreatureCreation>[] | null | undefined): CreatureCreation[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<CreationStage>(['mark', 'shape', 'picture', 'message', 'hideaway', 'den', 'keepsake', 'shared_game']);
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

function nextStage(
  state: GameState,
  stages: Array<{ stage: CreationStage; threshold: number; cognitive: number; language?: number }>,
  interactions: number,
): CreationStage | null {
  return stages.find(item => (
    interactions >= item.threshold
    && state.development.cognitiveLevel >= item.cognitive
    && state.development.languageLevel >= (item.language ?? 0)
    && !state.creations.some(creation => creation.stage === item.stage)
  ))?.stage ?? null;
}

function drawingStage(state: GameState): CreationStage | null {
  const mastery = state.objectPreferences.paper.interactions + state.objectPreferences.pencil.interactions;
  return nextStage(state, DRAWING_STAGES, mastery);
}

function hostType(stage: CreationStage): ObjectType {
  if (stage === 'hideaway' || stage === 'den') return 'box';
  if (stage === 'keepsake') return 'stone';
  if (stage === 'shared_game') return 'ball';
  return 'paper';
}

function objectStatusFor(stage: CreationStage): string {
  if (stage === 'message') return 'written';
  if (stage === 'picture' || stage === 'shape') return 'drawn';
  if (stage === 'hideaway') return 'hiding';
  if (stage === 'den') return 'den';
  if (stage === 'keepsake') return 'treasured';
  if (stage === 'shared_game') return 'shared';
  return 'scribbled';
}

function memoryContent(creation: CreatureCreation): string {
  if (creation.stage === 'hideaway' || creation.stage === 'den') return `made “${creation.title}” from a box`;
  if (creation.stage === 'keepsake') return `kept “${creation.title}” as a stone of its own`;
  if (creation.stage === 'shared_game') return `made “${creation.title}” as a game you play together`;
  return `made “${creation.title}” with paper and pencil`;
}

function addCreation(state: GameState, stage: CreationStage, now: number): GameState {
  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const source = inspiration(state, language);
  const words = copy(stage, source, language === 'pl');
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
    content: memoryContent(creation),
    importance: stage === 'message' || stage === 'shared_game' || stage === 'den' ? 9 : stage === 'picture' || stage === 'keepsake' ? 8 : 6,
    emotionalValence: 0.75,
    tags: ['creation', stage, source],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 25,
    compressed: false,
  };
  const host = hostType(stage);
  return {
    ...state,
    creations: [...state.creations, creation].slice(-40),
    memories: [...state.memories, memory].slice(-200),
    roomObjects: state.roomObjects.map(object => object.type === host
      ? { ...object, state: { ...object.state, status: objectStatusFor(stage), creationId: creation.id } }
      : object),
  };
}

export function evolveCreationFromObject(
  state: GameState,
  type: ObjectType,
  now = Date.now(),
  initiatedByUser = false,
): GameState {
  if (type === 'paper' || type === 'pencil') {
    const hasPaper = state.roomObjects.some(object => object.type === 'paper');
    const hasPencil = state.roomObjects.some(object => object.type === 'pencil');
    if (!hasPaper || !hasPencil) return state;
    const stage = drawingStage(state);
    return stage ? addCreation(state, stage, now) : state;
  }

  if (type === 'box') {
    if (!state.roomObjects.some(object => object.type === 'box')) return state;
    const stage = nextStage(state, BOX_STAGES, state.objectPreferences.box.interactions);
    return stage ? addCreation(state, stage, now) : state;
  }

  if (type === 'stone') {
    if (!state.roomObjects.some(object => object.type === 'stone')) return state;
    const preference = state.objectPreferences.stone;
    if (preference.interactions < 4 || (preference.affinity < 8 && preference.lastOutcome !== 'love')) return state;
    const stage = nextStage(state, [{ stage: 'keepsake', threshold: 4, cognitive: 14 }], preference.interactions);
    return stage ? addCreation(state, stage, now) : state;
  }

  if (type === 'ball') {
    if (!initiatedByUser || !state.roomObjects.some(object => object.type === 'ball')) return state;
    const stage = nextStage(state, [{ stage: 'shared_game', threshold: 6, cognitive: 16 }], state.objectPreferences.ball.interactions);
    return stage ? addCreation(state, stage, now) : state;
  }

  return state;
}

export function getCreationMastery(state: GameState, language: 'en' | 'pl' = 'en'): string {
  const stages = new Set(state.creations.map(creation => creation.stage));
  const polish = language === 'pl';
  const bits: string[] = [];
  if (stages.has('message')) bits.push(polish ? 'pisze krótkie wiadomości' : 'writes small messages');
  else if (stages.has('picture')) bits.push(polish ? 'tworzy obrazki' : 'makes pictures');
  else if (stages.has('shape')) bits.push(polish ? 'łączy kształty' : 'connects shapes');
  else if (stages.has('mark')) bits.push(polish ? 'stawia celowe znaki' : 'makes deliberate marks');
  if (stages.has('den')) bits.push(polish ? 'ma swoje gniazdo' : 'has a den');
  else if (stages.has('hideaway')) bits.push(polish ? 'chowa się w pudełku' : 'hides in a box');
  if (stages.has('keepsake')) bits.push(polish ? 'trzyma swój kamień' : 'keeps a stone');
  if (stages.has('shared_game')) bits.push(polish ? 'gra w naszą grę' : 'plays a return game');
  if (bits.length) return bits.join(polish ? ' · ' : ' · ');
  return polish ? 'nie zostawił jeszcze własnego śladu' : 'has not made a mark yet';
}
