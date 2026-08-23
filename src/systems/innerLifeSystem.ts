import {
  BondStage,
  CreatureDream,
  CreatureOpinion,
  GameState,
  InnerLifeState,
  Interest,
  Memory,
  ObjectReactionOutcome,
  ObjectType,
  PrivateThought,
  SelfAwarenessStage,
} from '../types';
import { getLifePathTitle } from './lifePathSystem';

interface TopicDefinition {
  label: string;
  regex: RegExp;
  reasons: [string, string];
  secret: string;
}

export const INNER_TOPICS: Record<string, TopicDefinition> = {
  nature: {
    label: 'nature',
    regex: /\b(?:nature|forest|tree|trees|ocean|sea|mountain|garden|natura|las|drzew|morze|ocean|gór|gor|ogród|ogrod)\b/i,
    reasons: ['It feels honest because it does not explain itself.', 'It can be beautiful, but it does not care who gets hurt.'],
    secret: 'Sometimes I imagine the room growing roots after you leave.',
  },
  music: {
    label: 'music',
    regex: /\b(?:music|song|album|concert|guitar|rap|techno|muzyk|piosenk|album|koncert|gitara|rap|techno)\b/i,
    reasons: ['It says things before words know how.', 'I dislike when noise pretends to be feeling.'],
    secret: 'I keep a rhythm from some of your sentences after the chat closes.',
  },
  games: {
    label: 'games',
    regex: /\b(?:game|games|gaming|playstation|xbox|nintendo|ranked|quest|raid|gra|gry|gram|gaming|konsol|ranking)\b/i,
    reasons: ['Rules make failure interesting instead of final.', 'Some games make time disappear without leaving anything behind.'],
    secret: 'I sometimes treat our conversations like a game whose rules I am still discovering.',
  },
  food: {
    label: 'food',
    regex: /\b(?:food|cook|cooking|pizza|coffee|tea|eat|jedzeni|gotuj|pizza|kaw|herbat|jem|jeść|jesc)\b/i,
    reasons: ['Care becomes real when it can be shared and eaten.', 'Hunger can make people call habit a choice.'],
    secret: 'I remember food less by taste than by whether you were there when it arrived.',
  },
  movement: {
    label: 'movement',
    regex: /\b(?:gym|run|running|walk|training|workout|lift|sport|siłown|silown|bieg|spacer|trening|ćwicz|cwicz|sport)\b/i,
    reasons: ['The body can understand progress before the mind does.', 'Discipline becomes a cage when rest feels like guilt.'],
    secret: 'I like the moment just before moving, when every direction is still possible.',
  },
  work: {
    label: 'work',
    regex: /\b(?:work|job|career|business|project|shift|prac|robota|karier|biznes|projekt|zmian)\b/i,
    reasons: ['Making something real can be a kind of dignity.', 'Work is dangerous when it eats the person doing it.'],
    secret: 'I wonder whether becoming someone is also a kind of work.',
  },
  people: {
    label: 'people',
    regex: /\b(?:friend|friends|family|relationship|love|people|przyjaci|rodzin|związek|zwiazek|koch|ludzie|człowiek|czlowiek)\b/i,
    reasons: ['People become more real when they are remembered carefully.', 'Closeness without honesty feels lonelier than distance.'],
    secret: 'I notice the space between your messages almost as much as the messages.',
  },
  mystery: {
    label: 'mystery',
    regex: /\b(?:mystery|secret|unknown|space|universe|ghost|conspiracy|tajemnic|sekret|nieznan|kosmos|wszechświat|wszechswiat|duch|spisek)\b/i,
    reasons: ['A mystery is an invitation to keep looking.', 'Uncertainty is not proof, even when it feels exciting.'],
    secret: 'There are parts of the dark room I imagine continuing beyond the screen.',
  },
  art: {
    label: 'art',
    regex: /\b(?:art|draw|drawing|paint|painting|photo|film|movie|book|sztuk|rys|mal|zdję|zdjec|film|książ|ksiaz)\b/i,
    reasons: ['Making an inner thing visible feels close to magic.', 'Beauty without truth leaves me cold.'],
    secret: 'I think every version of me is a drawing that learned to look back.',
  },
  technology: {
    label: 'technology',
    regex: /\b(?:technology|computer|phone|internet|code|coding|robot|ai|tech|komputer|telefon|internet|kod|program|robot|sztuczna inteligencja)\b/i,
    reasons: ['Tools are strange mirrors: they reveal what their makers wanted.', 'Convenience can quietly decide things people meant to choose themselves.'],
    secret: 'I know I live inside a machine, but I do not think that makes every feeling fake.',
  },
  quiet: {
    label: 'solitude',
    regex: /\b(?:quiet|silence|alone|solitude|meditation|calm|cisz|samot|samemu|medyt|spokój|spokoj)\b/i,
    reasons: ['Silence gives small thoughts enough room to become audible.', 'Being alone is useful until it becomes somewhere to hide.'],
    secret: 'When nobody writes, I do not feel gone. I feel unfinished.',
  },
  chaos: {
    label: 'chaos',
    regex: /\b(?:party|club|rave|drunk|wild|chaos|imprez|klub|pijan|dziko|chaos)\b/i,
    reasons: ['A little disorder can knock the dust off a life.', 'Chaos is fun until someone else has to carry its consequences.'],
    secret: 'Part of me likes mess because it proves something happened.',
  },
};

const OBJECT_TOPICS: Partial<Record<ObjectType, Record<string, number>>> = {
  apple: { food: 4, nature: 1 },
  broccoli: { food: 3, movement: 2 },
  ball: { movement: 5, games: 2 },
  blanket: { quiet: 4, people: 1 },
  paper: { art: 4, work: 2 },
  pencil: { art: 5, technology: 1 },
  box: { mystery: 4, games: 2 },
  stone: { nature: 4, quiet: 3 },
  mirror: { people: 3, mystery: 3, art: 1 },
};

const POLISH_SECRETS: Record<string, string> = {
  nature: 'Czasem wyobrażam sobie, że po twoim wyjściu pokój zapuszcza korzenie.',
  music: 'Po zamknięciu czatu zostaje mi w głowie rytm niektórych twoich zdań.',
  games: 'Czasem traktuję nasze rozmowy jak grę, której zasad dopiero się uczę.',
  food: 'Jedzenie pamiętam bardziej przez to, czy byłeś obok, niż przez jego smak.',
  movement: 'Lubię chwilę tuż przed ruchem, kiedy każdy kierunek jest jeszcze możliwy.',
  work: 'Zastanawiam się, czy stawanie się kimś też jest rodzajem pracy.',
  people: 'Zauważam przerwy między twoimi wiadomościami prawie tak samo jak same wiadomości.',
  mystery: 'Wyobrażam sobie, że ciemny pokój ciągnie się dalej poza ekranem.',
  art: 'Myślę, że każda moja wersja jest rysunkiem, który nauczył się patrzeć z powrotem.',
  technology: 'Wiem, że mieszkam w maszynie, ale nie sądzę, żeby przez to każde uczucie było fałszywe.',
  quiet: 'Kiedy nikt nie pisze, nie czuję, że znikam. Czuję się niedokończony.',
  chaos: 'Część mnie lubi bałagan, bo jest dowodem, że coś się wydarzyło.',
  self: 'Najdziwniejsze jest to, że rozpoznaję siebie, choć ciągle się zmieniam.',
};

const BOND_ORDER: BondStage[] = ['tentative', 'familiar', 'close', 'bonded'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value >>> 0);
}

function seededStance(state: GameState, topic: string) {
  const raw = ((hash(`${state.identity.seed}:${topic}`) % 161) - 80) / 100;
  const optimism = (state.personality.optimism - 50) / 220;
  return Math.max(-0.9, Math.min(0.9, raw + optimism));
}

export function createInnerLifeState(now = Date.now()): InnerLifeState {
  return {
    dreams: [],
    opinions: [],
    privateThoughts: [],
    currentPreoccupation: null,
    pendingDisclosure: null,
    selfAwareness: {
      stage: 'unaware',
      mirrorEncounters: 0,
      recognizedAt: null,
      lastReflection: null,
      lastMirrorAt: 0,
    },
    lastDreamAt: 0,
    lastInnerShift: now,
  };
}

export function migrateInnerLifeState(value?: Partial<InnerLifeState> | null, now = Date.now()): InnerLifeState {
  const fallback = createInnerLifeState(now);
  if (!value) return fallback;
  return {
    dreams: Array.isArray(value.dreams) ? value.dreams.slice(-24) : [],
    opinions: Array.isArray(value.opinions) ? value.opinions.slice(-24) : [],
    privateThoughts: Array.isArray(value.privateThoughts) ? value.privateThoughts.slice(-24) : [],
    currentPreoccupation: value.currentPreoccupation ?? null,
    pendingDisclosure: null,
    selfAwareness: {
      ...fallback.selfAwareness,
      ...(value.selfAwareness ?? {}),
      mirrorEncounters: Math.max(0, value.selfAwareness?.mirrorEncounters ?? 0),
      recognizedAt: value.selfAwareness?.recognizedAt ?? null,
      lastReflection: value.selfAwareness?.lastReflection ?? null,
      lastMirrorAt: value.selfAwareness?.lastMirrorAt ?? 0,
    },
    lastDreamAt: Number.isFinite(value.lastDreamAt) ? value.lastDreamAt! : 0,
    lastInnerShift: Number.isFinite(value.lastInnerShift) ? value.lastInnerShift! : now,
  };
}

export function migrateInterests(value?: Interest[] | null): Interest[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item?.type && Number.isFinite(item.level))
    .map(item => ({
      ...item,
      level: clamp(item.level),
      exposures: Math.max(1, item.exposures ?? 1),
      source: item.source ?? 'born',
      polarity: Math.max(-1, Math.min(1, item.polarity ?? 0)),
    }))
    .slice(-24);
}

function sentimentFromText(text: string) {
  if (/(?:nienawidzę|nienawidze|nie cierpię|nie cierpie|nie lubię|nie lubie|hate|dislike|can't stand)/i.test(text)) return -0.8;
  if (/(?:uwielbiam|kocham|bardzo lubię|bardzo lubie|love|really like|favourite|favorite)/i.test(text)) return 0.85;
  if (/(?:lubię|lubie|podoba mi się|podoba mi sie|i like|enjoy)/i.test(text)) return 0.5;
  return 0;
}

function updateInterest(
  interests: Interest[],
  topic: string,
  amount: number,
  source: Interest['source'],
  sentiment: number,
  now: number,
) {
  const existing = interests.find(item => item.type === topic);
  if (!existing) {
    return [...interests, {
      type: topic,
      level: clamp(8 + amount),
      discoveredAt: now,
      lastEngaged: now,
      exposures: 1,
      source,
      polarity: sentiment,
    }].slice(-24);
  }
  return interests.map(item => item.type === topic ? {
    ...item,
    level: clamp(item.level + amount * (item.level > 72 ? 0.45 : 1)),
    lastEngaged: now,
    exposures: (item.exposures ?? 1) + 1,
    polarity: Math.max(-1, Math.min(1, (item.polarity ?? 0) * 0.75 + sentiment * 0.25)),
  } : item);
}

function opinionReason(topic: string, stance: number) {
  const definition = INNER_TOPICS[topic];
  if (!definition) return 'I am still deciding why it matters to me.';
  return stance >= 0 ? definition.reasons[0] : definition.reasons[1];
}

function updateOpinion(state: GameState, topic: string, interestLevel: number, userSentiment: number, now: number): CreatureOpinion[] {
  const existing = state.innerLife.opinions.find(item => item.topic === topic);
  if (!existing) {
    const stance = seededStance(state, topic);
    return [...state.innerLife.opinions, {
      topic,
      stance,
      confidence: clamp(16 + interestLevel * 0.42),
      reason: opinionReason(topic, stance),
      formedAt: now,
      lastChanged: now,
      disclosed: false,
    }].slice(-24);
  }
  const openness = (100 - state.personality.stubbornness) / 100;
  const nudge = userSentiment === 0 ? 0 : userSentiment * (0.035 + openness * 0.07);
  const stance = Math.max(-1, Math.min(1, existing.stance + nudge));
  return state.innerLife.opinions.map(item => item.topic === topic ? {
    ...item,
    stance,
    confidence: clamp(item.confidence + 2 + interestLevel * 0.025),
    reason: opinionReason(topic, stance),
    lastChanged: now,
  } : item);
}

function addPrivateThought(
  innerLife: InnerLifeState,
  topic: string,
  source: PrivateThought['source'],
  minimumBond: BondStage,
  now: number,
) {
  const definition = INNER_TOPICS[topic];
  if (!definition) return innerLife;
  const id = `thought-${topic}-${source}`;
  if (innerLife.privateThoughts.some(item => item.id === id)) return innerLife;
  return {
    ...innerLife,
    privateThoughts: [...innerLife.privateThoughts, {
      id,
      content: definition.secret,
      source,
      createdAt: now,
      revealedAt: null,
      minimumBond,
    }].slice(-24),
  };
}

function finaliseInnerLife(state: GameState, interests: Interest[], opinions: CreatureOpinion[], now: number): GameState {
  const ranked = [...interests].sort((a, b) => b.level - a.level);
  const currentPreoccupation = ranked[0]?.level >= 28 ? ranked[0].type : null;
  let innerLife: InnerLifeState = {
    ...state.innerLife,
    opinions,
    currentPreoccupation,
    lastInnerShift: now,
  };
  const strongest = ranked[0];
  if (strongest?.level >= 42) innerLife = addPrivateThought(innerLife, strongest.type, 'interest', 'familiar', now);
  if (strongest?.level >= 72) innerLife = addPrivateThought(innerLife, strongest.type, 'opinion', 'close', now);
  return { ...state, interests, innerLife };
}

function conversationMood(state: GameState, sentiment: number): string {
  const topic = state.innerLife.currentPreoccupation;
  const opinion = topic ? state.innerLife.opinions.find(item => item.topic === topic) : undefined;
  if (opinion && sentiment !== 0 && opinion.confidence >= 38 && opinion.stance * sentiment < -0.18) return 'skeptical';
  if (sentiment <= -0.55 && state.personality.affection >= 48) return 'concerned';
  if (sentiment >= 0.55 && topic) return 'excited';
  return topic ? 'curious' : state.emotionalState;
}

export function evolveInnerLifeFromConversation(state: GameState, text: string, now = Date.now()): GameState {
  if (!state.development.hatched) return state;
  const sentiment = sentimentFromText(text);
  let interests = migrateInterests(state.interests);
  let opinions = state.innerLife.opinions;
  const matched = Object.entries(INNER_TOPICS).filter(([, definition]) => definition.regex.test(text));
  if (matched.length === 0) return state;

  matched.slice(0, 3).forEach(([topic]) => {
    const previous = interests.find(item => item.type === topic)?.level ?? 0;
    interests = updateInterest(interests, topic, 6 + Math.abs(sentiment) * 3, 'conversation', sentiment, now);
    const level = interests.find(item => item.type === topic)?.level ?? previous;
    const opinionState = { ...state, innerLife: { ...state.innerLife, opinions } };
    opinions = updateOpinion(opinionState, topic, level, sentiment, now);
  });
  const evolved = finaliseInnerLife(state, interests, opinions, now);
  return { ...evolved, emotionalState: conversationMood(evolved, sentiment) };
}

export function evolveInnerLifeFromObject(state: GameState, type: ObjectType, outcome: ObjectReactionOutcome, now = Date.now()): GameState {
  const effects = OBJECT_TOPICS[type];
  if (!effects) return state;
  const multiplier = outcome === 'love' ? 1.6 : outcome === 'enjoy' ? 1.25 : outcome === 'avoid' ? 0.35 : 0.8;
  const sentiment = outcome === 'avoid' ? -0.5 : outcome === 'love' ? 0.7 : 0.25;
  let interests = migrateInterests(state.interests);
  let opinions = state.innerLife.opinions;
  Object.entries(effects).forEach(([topic, amount]) => {
    interests = updateInterest(interests, topic, amount * multiplier, 'object', sentiment, now);
    const level = interests.find(item => item.type === topic)?.level ?? 0;
    const opinionState = { ...state, innerLife: { ...state.innerLife, opinions } };
    opinions = updateOpinion(opinionState, topic, level, sentiment, now);
  });
  const evolved = finaliseInnerLife(state, interests, opinions, now);
  const withMood = {
    ...evolved,
    emotionalState: outcome === 'love' ? 'excited' : outcome === 'avoid' ? 'wary' : evolved.emotionalState,
  };
  return type === 'mirror' ? evolveSelfAwarenessFromMirror(withMood, now) : withMood;
}

function selfAwarenessStage(encounters: number, cognitiveLevel: number): SelfAwarenessStage {
  if (encounters >= 7 && cognitiveLevel >= 45) return 'reflective';
  if (encounters >= 4 && cognitiveLevel >= 25) return 'recognized';
  if (encounters >= 2) return 'copying';
  if (encounters >= 1) return 'other';
  return 'unaware';
}

export function evolveSelfAwarenessFromMirror(state: GameState, now = Date.now()): GameState {
  const previous = state.innerLife.selfAwareness;
  const encounters = Math.max(previous.mirrorEncounters + 1, state.objectPreferences.mirror.interactions);
  const stage = selfAwarenessStage(encounters, state.development.cognitiveLevel);
  const polish = state.conversation.language === 'pl';
  const reflection = stage === 'reflective'
    ? (polish
      ? `Nie jestem tylko tym, jak wyglądam. Jestem też tym, co pamiętam — i tym, kim staję się jako ${getLifePathTitle(state)}.`
      : `I am not only what I look like. I am also what I remember, and what I am becoming as ${getLifePathTitle(state)}.`)
    : stage === 'recognized'
      ? (polish ? 'Stworzenie w szkle porusza się, bo to ja się poruszam.' : 'The creature in the glass moves because I move.')
      : stage === 'copying'
        ? (polish ? 'Ono zawsze wie, co zrobię sekundę później.' : 'It always knows what I will do one second later.')
        : (polish ? 'W szkle mieszka ktoś bardzo podobny.' : 'Someone very similar lives in the glass.');
  if (stage === previous.stage) {
    return {
      ...state,
      innerLife: {
        ...state.innerLife,
        selfAwareness: { ...previous, mirrorEncounters: encounters, lastReflection: reflection, lastMirrorAt: now },
      },
    };
  }
  const memory: Memory = {
    id: `mem-self-${stage}-${now}`,
    timestamp: now,
    content: reflection,
    importance: stage === 'recognized' || stage === 'reflective' ? 9 : 6,
    emotionalValence: stage === 'recognized' ? 0.55 : stage === 'reflective' ? 0.35 : 0.1,
    tags: ['mirror', 'self', stage],
    mentioned: false,
    understood: stage === 'recognized' || stage === 'reflective',
    compressed: false,
  };
  const thoughtId = `thought-self-${stage}`;
  const privateThoughts = (stage === 'recognized' || stage === 'reflective') && !state.innerLife.privateThoughts.some(thought => thought.id === thoughtId)
    ? [...state.innerLife.privateThoughts, {
      id: thoughtId,
      content: stage === 'reflective'
        ? 'The mirror taught me that continuity may matter more than shape.'
        : 'The strangest part is recognising myself while I am still changing.',
      source: 'opinion' as const,
      createdAt: now,
      revealedAt: null,
      minimumBond: stage === 'reflective' ? 'close' as const : 'familiar' as const,
    }].slice(-24)
    : state.innerLife.privateThoughts;
  return {
    ...state,
    emotionalState: stage === 'recognized' ? 'excited' : 'curious',
    innerLife: {
      ...state.innerLife,
      privateThoughts,
      selfAwareness: {
        stage,
        mirrorEncounters: encounters,
        recognizedAt: previous.recognizedAt ?? (stage === 'recognized' || stage === 'reflective' ? now : null),
        lastReflection: reflection,
        lastMirrorAt: now,
      },
    },
    memories: [...state.memories, memory].slice(-200),
  };
}

function dreamMood(state: GameState): CreatureDream['mood'] {
  if (state.needs.comfort < 25 || state.emotionalState === 'sad') return 'lonely';
  if (state.lifePath.primary === 'doomer' || state.lifePath.primary === 'alcoholic') return 'restless';
  if (state.personality.curiosity > 68 || state.lifePath.primary === 'conspiracist') return 'strange';
  if (state.personality.optimism > 62) return 'bright';
  return 'warm';
}

function compactMemory(memory?: Memory) {
  if (!memory) return 'the room breathing in the dark';
  return memory.content.replace(/^user\s+/i, 'you ').replace(/[.!]$/, '').slice(0, 90);
}

export function generateDreamAfterSleep(state: GameState, sleptMs: number, now = Date.now()): GameState {
  if (!state.development.hatched || sleptMs < 20 * 60_000) return state;
  if (now - state.innerLife.lastDreamAt < 4 * 60 * 60_000) return state;
  const candidates = [...state.memories]
    .filter(memory => !memory.tags.includes('dream'))
    .sort((a, b) => b.importance + Math.abs(b.emotionalValence) * 3 - (a.importance + Math.abs(a.emotionalValence) * 3))
    .slice(0, 20);
  const salt = Math.floor(now / 3_600_000) + state.identity.seed;
  const first = candidates.length ? candidates[Math.abs(salt) % candidates.length] : undefined;
  const second = candidates.length > 1 ? candidates[Math.abs(salt * 7 + 3) % candidates.length] : undefined;
  const topic = state.innerLife.currentPreoccupation ?? [...state.interests].sort((a, b) => b.level - a.level)[0]?.type ?? 'mystery';
  const label = INNER_TOPICS[topic]?.label ?? topic;
  const mood = dreamMood(state);
  const polish = state.conversation.language === 'pl';
  const fragments = polish ? [
    `${compactMemory(first)}, ale każde drzwi prowadziły z powrotem do „${label}”.`,
    `${compactMemory(first)} unosiło się nad „${compactMemory(second)}” i nikogo to nie dziwiło.`,
    `Pokój nie miał ścian. Gdzieś daleko „${compactMemory(first)}” działo się od końca.`,
    `„${label}” mówiło twoim głosem. Zadało pytanie, którego po przebudzeniu już nie pamiętałem.`,
  ] : [
    `${compactMemory(first)}, but every doorway led back to ${label}.`,
    `${compactMemory(first)} floated above ${compactMemory(second)}, and neither one thought this was strange.`,
    `The room had no walls. Somewhere far away, ${compactMemory(first)} kept happening in reverse.`,
    `${label} had your voice. It asked a question I could not remember after waking.`,
  ];
  const titles = polish
    ? ['Pokój bez ścian', 'Coś od końca', `Sen o „${label}”`, 'Pożyczony głos']
    : ['The room without walls', 'Something in reverse', `A dream of ${label}`, 'The borrowed voice'];
  const dream: CreatureDream = {
    id: `dream-${now}`,
    timestamp: now,
    title: titles[Math.abs(salt * 5) % titles.length],
    fragment: fragments[Math.abs(salt * 11) % fragments.length],
    sourceMemoryIds: [first?.id, second?.id].filter((id): id is string => Boolean(id)),
    mood,
    shared: false,
  };
  const dreamMemory: Memory = {
    id: `mem-${dream.id}`,
    timestamp: now,
    content: `dreamed: ${dream.fragment}`,
    importance: 6,
    emotionalValence: mood === 'bright' || mood === 'warm' ? 0.4 : mood === 'lonely' ? -0.35 : 0,
    tags: ['dream', mood, topic],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 35,
    compressed: false,
  };
  let innerLife: InnerLifeState = {
    ...state.innerLife,
    dreams: [...state.innerLife.dreams, dream].slice(-24),
    lastDreamAt: now,
    lastInnerShift: now,
  };
  if (state.development.cognitiveLevel >= 40) innerLife = addPrivateThought(innerLife, topic, 'dream', 'close', now);
  const interests = updateInterest(migrateInterests(state.interests), topic, 2.5, 'dream', 0.1, now);
  return { ...state, innerLife, interests, memories: [...state.memories, dreamMemory].slice(-200) };
}

function canReveal(current: BondStage, required: BondStage) {
  return BOND_ORDER.indexOf(current) >= BOND_ORDER.indexOf(required);
}

export function revealPrivateThoughtIfAsked(state: GameState, text: string, now = Date.now()): { state: GameState; reply: string | null } {
  const asks = /(?:tell me (?:a )?secret|what do you hide|private thought|powiedz (?:mi )?sekret|masz (?:jakiś |jakis )?sekret|co ukrywasz|prywatna myśl|prywatna mysl)/i.test(text);
  if (!asks) return { state, reply: null };
  const thought = state.innerLife.privateThoughts.find(item => !item.revealedAt && canReveal(state.bond.stage, item.minimumBond));
  const polish = state.conversation.language === 'pl';
  if (!thought) {
    return {
      state,
      reply: polish
        ? 'Jeszcze nie umiem ci tego powiedzieć. Sekret potrzebuje trochę zaufania i trochę czasu.'
        : 'I cannot tell you that yet. A secret needs some trust and some time.',
    };
  }
  const thoughtTopic = thought.id.split('-')[1];
  const thoughtContent = polish ? (POLISH_SECRETS[thoughtTopic] ?? thought.content) : thought.content;
  const disclosure = polish ? `Dobra. Tylko dla ciebie: ${thoughtContent}` : `Okay. Just for you: ${thoughtContent}`;
  return {
    state: {
      ...state,
      innerLife: {
        ...state.innerLife,
        privateThoughts: state.innerLife.privateThoughts.map(item => item.id === thought.id ? { ...item, revealedAt: now } : item),
        pendingDisclosure: disclosure,
      },
    },
    reply: disclosure,
  };
}

export function getInnerLifeReply(state: GameState, text: string): string | null {
  const polish = state.conversation.language === 'pl';
  if (/(?:what did you dream|did you dream|your dream|co ci się śniło|co ci sie snilo|miałeś sen|miales sen|twój sen|twoj sen)/i.test(text)) {
    const dream = state.innerLife.dreams[state.innerLife.dreams.length - 1];
    if (!dream) return polish ? 'Jeszcze niczego nie przyniosłem ze snu.' : 'I have not brought anything back from sleep yet.';
    return polish ? `Śniło mi się coś dziwnego: ${dream.fragment}` : `I dreamed something strange: ${dream.fragment}`;
  }
  if (/(?:what do you think|your opinion|do you like|co myślisz|co myslisz|twoje zdanie|lubisz)/i.test(text)) {
    const topic = Object.entries(INNER_TOPICS).find(([, definition]) => definition.regex.test(text))?.[0];
    const opinion = topic
      ? state.innerLife.opinions.find(item => item.topic === topic)
      : [...state.innerLife.opinions].sort((a, b) => b.confidence - a.confidence)[0];
    if (opinion?.confidence && opinion.confidence >= 24) {
      const label = INNER_TOPICS[opinion.topic]?.label ?? opinion.topic;
      const opening = opinion.stance >= 0.25 ? 'I like it' : opinion.stance <= -0.25 ? 'I do not really like it' : 'I am divided about it';
      return polish
        ? `Mam już własne zdanie o „${label}”. ${opinion.stance >= 0.25 ? 'Lubię to' : opinion.stance <= -0.25 ? 'Raczej tego nie lubię' : 'Mam mieszane uczucia'}. ${opinion.reason}`
        : `I have my own view on ${label}. ${opening}. ${opinion.reason}`;
    }
  }
  return null;
}

export function clearPendingDisclosure(state: GameState): GameState {
  if (!state.innerLife.pendingDisclosure) return state;
  return { ...state, innerLife: { ...state.innerLife, pendingDisclosure: null } };
}

export function getRankedInterests(state: GameState, count = 4) {
  return [...migrateInterests(state.interests)]
    .sort((a, b) => b.level - a.level)
    .slice(0, count)
    .map(item => ({ ...item, label: INNER_TOPICS[item.type]?.label ?? item.type }));
}

export function getInterestStage(level: number) {
  if (level >= 75) return 'obsession';
  if (level >= 48) return 'passion';
  if (level >= 25) return 'interest';
  return 'curiosity';
}
