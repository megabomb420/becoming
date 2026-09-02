import { authoritativeNow } from './authoritativeTime';
import {
  BondStage,
  CreatureDream,
  CreatureOpinion,
  DevelopmentStage,
  GameState,
  InnerLifeState,
  Interest,
  InterestEvidence,
  Memory,
  ObjectReactionOutcome,
  ObjectType,
  PrivateThought,
  SelfAwarenessStage,
} from '../types';
import { getLifePathTitle } from './lifePathSystem';
import { DEVELOPMENT_STAGES, getDevelopmentLabel, getDevelopmentStageFromMemory } from './developmentSystem';

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

const POLISH_TOPIC_LABELS: Record<string, string> = {
  nature: 'natura',
  music: 'muzyka',
  games: 'gry',
  food: 'jedzenie',
  movement: 'ruch',
  work: 'praca',
  people: 'ludzie',
  mystery: 'tajemnice',
  art: 'sztuka',
  technology: 'technologia',
  quiet: 'samotność i cisza',
  chaos: 'chaos',
};

const POLISH_REASONS: Record<string, [string, string]> = {
  nature: ['Wydaje się szczera, bo niczego nie musi wyjaśniać.', 'Bywa piękna, ale nie obchodzi jej, kto zostaje zraniony.'],
  music: ['Mówi rzeczy, zanim słowa potrafią je nazwać.', 'Nie lubię, gdy hałas udaje uczucie.'],
  games: ['Zasady sprawiają, że porażka staje się ciekawa, a nie ostateczna.', 'Niektóre gry zabierają czas i niczego po sobie nie zostawiają.'],
  food: ['Troska staje się prawdziwa, kiedy można się nią podzielić i ją zjeść.', 'Głód potrafi sprawić, że nawyk wygląda jak wybór.'],
  movement: ['Ciało potrafi zrozumieć postęp wcześniej niż umysł.', 'Dyscyplina staje się klatką, kiedy odpoczynek budzi poczucie winy.'],
  work: ['Tworzenie czegoś prawdziwego może być rodzajem godności.', 'Praca staje się niebezpieczna, kiedy pożera osobę, która ją wykonuje.'],
  people: ['Ludzie stają się bardziej realni, kiedy uważnie się ich pamięta.', 'Bliskość bez szczerości jest bardziej samotna niż dystans.'],
  mystery: ['Tajemnica jest zaproszeniem, by patrzeć dalej.', 'Niepewność nie jest dowodem, nawet jeśli ekscytuje.'],
  art: ['Pokazanie na zewnątrz czegoś wewnętrznego przypomina magię.', 'Piękno bez prawdy pozostawia mnie obojętnym.'],
  technology: ['Narzędzia są dziwnymi lustrami: pokazują pragnienia twórców.', 'Wygoda potrafi po cichu zdecydować za człowieka.'],
  quiet: ['Cisza daje małym myślom dość miejsca, by stały się słyszalne.', 'Samotność pomaga, dopóki nie staje się kryjówką.'],
  chaos: ['Odrobina nieporządku potrafi strząsnąć kurz z życia.', 'Chaos bawi tylko do chwili, gdy ktoś inny musi ponieść jego skutki.'],
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

export function createInnerLifeState(now = authoritativeNow()): InnerLifeState {
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

export function migrateInnerLifeState(value?: Partial<InnerLifeState> | null, now = authoritativeNow()): InnerLifeState {
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

function emptyInterestEvidence(): InterestEvidence {
  return {
    userMentions: 0,
    creatureCuriosities: 0,
    creaturePreferences: 0,
    creatureChoices: 0,
    creatureRejections: 0,
    firstPositiveAt: null,
    lastPositiveAt: null,
    lastNegativeAt: null,
  };
}

function migrateInterestEvidence(item: Interest): InterestEvidence {
  if (item.evidence) {
    return {
      userMentions: Math.max(0, Math.floor(item.evidence.userMentions ?? 0)),
      creatureCuriosities: Math.max(0, Math.floor(item.evidence.creatureCuriosities ?? 0)),
      creaturePreferences: Math.max(0, Math.floor(item.evidence.creaturePreferences ?? 0)),
      creatureChoices: Math.max(0, Math.floor(item.evidence.creatureChoices ?? 0)),
      creatureRejections: Math.max(0, Math.floor(item.evidence.creatureRejections ?? 0)),
      firstPositiveAt: Number.isFinite(item.evidence.firstPositiveAt) ? Number(item.evidence.firstPositiveAt) : null,
      lastPositiveAt: Number.isFinite(item.evidence.lastPositiveAt) ? Number(item.evidence.lastPositiveAt) : null,
      lastNegativeAt: Number.isFinite(item.evidence.lastNegativeAt) ? Number(item.evidence.lastNegativeAt) : null,
    };
  }
  const fallback = emptyInterestEvidence();
  const exposures = Math.max(1, item.exposures ?? 1);
  if (item.source === 'conversation') fallback.userMentions = exposures;
  else if (item.source === 'object') {
    fallback.creatureChoices = exposures;
    fallback.firstPositiveAt = item.discoveredAt;
    fallback.lastPositiveAt = item.lastEngaged;
  } else if (item.source === 'dream') fallback.creatureCuriosities = exposures;
  return fallback;
}

function positiveInterestEvidence(evidence: InterestEvidence) {
  return evidence.creaturePreferences + evidence.creatureChoices;
}

function isStableInterest(item: Interest) {
  const evidence = migrateInterestEvidence(item);
  const positives = positiveInterestEvidence(evidence);
  const span = (evidence.lastPositiveAt ?? 0) - (evidence.firstPositiveAt ?? 0);
  return item.level >= 25
    && positives >= 4
    && positives - evidence.creatureRejections * 2 >= 3
    && (span >= 30 * 60_000 || positives >= 7);
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
      evidence: migrateInterestEvidence(item),
    }))
    .slice(-24);
}

function sentimentFromText(text: string) {
  if (/(?:nienawidzę|nienawidze|nie cierpię|nie cierpie|nie lubię|nie lubie|hate|dislike|can't stand)/i.test(text)) return -0.8;
  if (/(?:uwielbiam|kocham|bardzo lubię|bardzo lubie|love|really like|favourite|favorite)/i.test(text)) return 0.85;
  if (/(?:lubię|lubie|podoba mi się|podoba mi sie|i like|enjoy)/i.test(text)) return 0.5;
  return 0;
}

type InterestSignal = 'user_mention' | 'creature_curiosity' | 'creature_preference' | 'creature_choice' | 'creature_rejection';

function recordInterestEvidence(previous: InterestEvidence, signal: InterestSignal, now: number): InterestEvidence {
  if (signal === 'user_mention') return { ...previous, userMentions: previous.userMentions + 1 };
  if (signal === 'creature_curiosity') return { ...previous, creatureCuriosities: previous.creatureCuriosities + 1 };
  if (signal === 'creature_rejection') return { ...previous, creatureRejections: previous.creatureRejections + 1, lastNegativeAt: now };
  return {
    ...previous,
    creaturePreferences: previous.creaturePreferences + (signal === 'creature_preference' ? 1 : 0),
    creatureChoices: previous.creatureChoices + (signal === 'creature_choice' ? 1 : 0),
    firstPositiveAt: previous.firstPositiveAt ?? now,
    lastPositiveAt: now,
  };
}

function updateInterest(
  interests: Interest[],
  topic: string,
  amount: number,
  source: Interest['source'],
  sentiment: number,
  signal: InterestSignal,
  now: number,
) {
  const existing = interests.find(item => item.type === topic);
  if (!existing) {
    const evidence = recordInterestEvidence(emptyInterestEvidence(), signal, now);
    return [...interests, {
      type: topic,
      level: clamp(amount),
      discoveredAt: now,
      lastEngaged: now,
      exposures: 1,
      source,
      polarity: sentiment,
      evidence,
    }].slice(-24);
  }
  return interests.map(item => {
    if (item.type !== topic) return item;
    const evidence = recordInterestEvidence(migrateInterestEvidence(item), signal, now);
    const selfPositive = positiveInterestEvidence(evidence);
    const nextLevel = signal === 'user_mention' && selfPositive === 0
      ? Math.min(6, item.level + amount)
      : clamp(item.level + amount * (item.level > 72 ? 0.45 : 1));
    return {
      ...item,
      level: nextLevel,
      lastEngaged: now,
      exposures: (item.exposures ?? 1) + 1,
      polarity: Math.max(-1, Math.min(1, (item.polarity ?? 0) * 0.75 + sentiment * 0.25)),
      evidence,
    };
  });
}

function opinionReason(topic: string, stance: number, language: 'en' | 'pl' = 'en') {
  const definition = INNER_TOPICS[topic];
  if (!definition) return language === 'pl' ? 'Wciąż próbuję zrozumieć, dlaczego to jest dla mnie ważne.' : 'I am still deciding why it matters to me.';
  const reasons = language === 'pl' ? POLISH_REASONS[topic] : definition.reasons;
  return stance >= 0 ? reasons?.[0] ?? definition.reasons[0] : reasons?.[1] ?? definition.reasons[1];
}

function updateOpinion(state: GameState, topic: string, interestLevel: number, sentiment: number, signal: InterestSignal, now: number): CreatureOpinion[] {
  const existing = state.innerLife.opinions.find(item => item.topic === topic);
  if (!existing) {
    const stance = seededStance(state, topic);
    return [...state.innerLife.opinions, {
      topic,
      stance,
      confidence: signal === 'user_mention' ? 3 : clamp(6 + interestLevel * 0.25),
      reason: opinionReason(topic, stance),
      formedAt: now,
      lastChanged: now,
      disclosed: false,
    }].slice(-24);
  }
  const openness = (100 - state.personality.stubbornness) / 100;
  const nudgeScale = signal === 'user_mention' ? 0.012 + openness * 0.018 : 0.08 + openness * 0.08;
  const nudge = sentiment === 0 ? 0 : sentiment * nudgeScale;
  const stance = Math.max(-1, Math.min(1, existing.stance + nudge));
  const confidenceGain = signal === 'user_mention'
    ? 0.25
    : signal === 'creature_curiosity'
      ? 0.5
      : signal === 'creature_rejection'
        ? 6
        : 5;
  return state.innerLife.opinions.map(item => item.topic === topic ? {
    ...item,
    stance,
    confidence: signal === 'user_mention'
      ? Math.min(8, item.confidence + confidenceGain)
      : clamp(item.confidence + confidenceGain),
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
  const ranked = [...interests].filter(isStableInterest).sort((a, b) => b.level - a.level);
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

export function evolveInnerLifeFromConversation(state: GameState, text: string, now = authoritativeNow()): GameState {
  if (!state.development.hatched) return state;
  const sentiment = sentimentFromText(text);
  let interests = migrateInterests(state.interests);
  let opinions = state.innerLife.opinions;
  const matched = Object.entries(INNER_TOPICS).filter(([, definition]) => definition.regex.test(text));
  if (matched.length === 0) return state;

  matched.slice(0, 3).forEach(([topic]) => {
    const previous = interests.find(item => item.type === topic)?.level ?? 0;
    interests = updateInterest(interests, topic, 0.35 + Math.abs(sentiment) * 0.15, 'conversation', sentiment, 'user_mention', now);
    const level = interests.find(item => item.type === topic)?.level ?? previous;
    const opinionState = { ...state, innerLife: { ...state.innerLife, opinions } };
    opinions = updateOpinion(opinionState, topic, level, sentiment, 'user_mention', now);
  });
  const evolved = finaliseInnerLife(state, interests, opinions, now);
  return { ...evolved, emotionalState: conversationMood(evolved, sentiment) };
}

export function evolveInnerLifeFromObject(state: GameState, type: ObjectType, outcome: ObjectReactionOutcome, now = authoritativeNow()): GameState {
  const effects = OBJECT_TOPICS[type];
  if (!effects) return state;
  const multiplier = outcome === 'love' ? 1.6 : outcome === 'enjoy' ? 1.25 : outcome === 'avoid' ? -1.5 : outcome === 'curious' ? 0.15 : 0;
  const sentiment = outcome === 'avoid' ? -0.5 : outcome === 'love' ? 0.7 : 0.25;
  const signal: InterestSignal = outcome === 'avoid'
    ? 'creature_rejection'
    : outcome === 'love'
      ? 'creature_preference'
      : outcome === 'enjoy'
        ? 'creature_choice'
        : 'creature_curiosity';
  let interests = migrateInterests(state.interests);
  let opinions = state.innerLife.opinions;
  Object.entries(effects).forEach(([topic, amount]) => {
    interests = updateInterest(interests, topic, amount * multiplier, 'object', sentiment, signal, now);
    const level = interests.find(item => item.type === topic)?.level ?? 0;
    const opinionState = { ...state, innerLife: { ...state.innerLife, opinions } };
    opinions = updateOpinion(opinionState, topic, level, sentiment, signal, now);
  });
  const evolved = finaliseInnerLife(state, interests, opinions, now);
  const withMood = {
    ...evolved,
    emotionalState: outcome === 'love' ? 'excited' : outcome === 'avoid' ? 'wary' : evolved.emotionalState,
  };
  return type === 'mirror' ? evolveSelfAwarenessFromMirror(withMood, now) : withMood;
}

type CreatureInterestSignal = Exclude<InterestSignal, 'user_mention'>;

function creatureInterestSignalFromClause(clause: string): CreatureInterestSignal | null {
  if (/(?:\bi\s+(?:do not|don't|never|refuse to|won't)\b|\b(?:not for me|i dislike|i hate|i would rather not)\b|nie chcę|nie chce|nie lubię|nie lubie|odmawiam|nigdy nie|nie będę|nie bede|wolę nie|wole nie|to nie dla mnie|nienawidzę|nienawidze)/i.test(clause)) return 'creature_rejection';
  if (/(?:\b(?:i choose|i decided|i keep|i am going to|i'm going to|i will|my choice)\b|wybieram|postanawiam|zdecydowałem|zdecydowalem|zdecydowałam|zdecydowalam|będę|bede|robię to|robie to)/i.test(clause)) return 'creature_choice';
  if (/(?:\b(?:i like|i love|i enjoy|i prefer|i want|my favourite|my favorite)\b|lubię|lubie|uwielbiam|wolę|wole|chcę|chce|to moje ulubione)/i.test(clause)) return 'creature_preference';
  if (/(?:\b(?:i wonder|i am curious|i'm curious|interesting|what if)\b|ciekawi mnie|jestem ciekaw|jestem ciekawa|zastanawiam się|zastanawiam sie|interesujące|interesujace|co jeśli|co jesli|\?)/i.test(clause)) return 'creature_curiosity';
  return null;
}

/** Separately records a reply as the creature's own stance, never as user input. */
export function evolveInnerLifeFromCreatureStatement(state: GameState, text: string, now = authoritativeNow()): GameState {
  if (!state.development.hatched || !text.trim()) return state;
  let interests = migrateInterests(state.interests);
  let opinions = state.innerLife.opinions;
  const clauses = text.split(/(?:[.!?;\n]+|\bbut\b|\bhowever\b|\bale\b|\bjednak\b)/i).map(value => value.trim()).filter(Boolean);

  clauses.forEach(clause => {
    const signal = creatureInterestSignalFromClause(clause);
    if (!signal) return;
    const sentiment = signal === 'creature_rejection' ? -0.9 : signal === 'creature_curiosity' ? 0 : 0.8;
    const amount = signal === 'creature_rejection' ? -10 : signal === 'creature_choice' ? 6 : signal === 'creature_preference' ? 7 : 0.2;
    Object.entries(INNER_TOPICS).forEach(([topic, definition]) => {
      if (!definition.regex.test(clause)) return;
      interests = updateInterest(interests, topic, amount, 'creature', sentiment, signal, now);
      const level = interests.find(item => item.type === topic)?.level ?? 0;
      const opinionState = { ...state, innerLife: { ...state.innerLife, opinions } };
      opinions = updateOpinion(opinionState, topic, level, sentiment, signal, now);
    });
  });

  return finaliseInnerLife(state, interests, opinions, now);
}

function selfAwarenessStage(encounters: number, cognitiveLevel: number): SelfAwarenessStage {
  if (encounters >= 7 && cognitiveLevel >= 45) return 'reflective';
  if (encounters >= 4 && cognitiveLevel >= 25) return 'recognized';
  if (encounters >= 2) return 'copying';
  if (encounters >= 1) return 'other';
  return 'unaware';
}

export function evolveSelfAwarenessFromMirror(state: GameState, now = authoritativeNow()): GameState {
  const previous = state.innerLife.selfAwareness;
  const encounters = Math.max(previous.mirrorEncounters + 1, state.objectPreferences.mirror.interactions);
  const stage = selfAwarenessStage(encounters, state.development.cognitiveLevel);
  const polish = state.conversation.language === 'pl';
  const reflection = stage === 'reflective'
    ? (polish
      ? `Nie jestem tylko tym, jak wyglądam. Jestem też tym, co pamiętam — i tym, kim staję się jako ${getLifePathTitle(state, 'pl')}.`
      : `I am not only what I look like. I am also what I remember, and what I am becoming as ${getLifePathTitle(state, 'en')}.`)
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

// A dream is made of noun-like images, not database/UI strings. Development
// milestone memories become the experience itself (words arriving, thoughts
// joining) instead of the "Reached …" milestone copy, which production smoke
// showed spliced as a noun ("Reached First words floated above the room…").
const DEVELOPMENT_DREAM_IMAGES: Record<DevelopmentStage, { en: string; pl: string }> = {
  egg: { en: 'the quiet before hatching', pl: 'cisza przed wykluciem' },
  newborn: { en: 'the first sounds of a new voice', pl: 'pierwsze dźwięki nowego głosu' },
  animal: { en: 'the shape of listening', pl: 'kształt nasłuchiwania' },
  communicating: { en: 'a voice learning to mean', pl: 'głos uczący się znaczyć' },
  first_words: { en: 'the arrival of the first words', pl: 'nadejście pierwszych słów' },
  combining: { en: 'thoughts beginning to join', pl: 'myśli zaczynające się łączyć' },
  sentences: { en: 'young sentences learning to stand', pl: 'młode zdania uczące się stać' },
  mature: { en: 'a mind grown whole', pl: 'umysł, który urósł w całość' },
};

const ABSENCE_DREAM_IMAGE = {
  en: 'the quiet hours of an empty room',
  pl: 'ciche godziny pustego pokoju',
};

// Learned user facts are records ("learned the user likes X"); a dream turns
// them into what the user means to the creature, never the record itself.
const USER_FACT_DREAM_IMAGES: Record<string, { en: string; pl: string }> = {
  name: { en: 'your name', pl: 'twoje imię' },
  like: { en: 'the thing you like', pl: 'to, co lubisz' },
  dislike: { en: 'the thing you dislike', pl: 'to, czego nie lubisz' },
  feeling: { en: 'the feeling you carried', pl: 'uczucie, które zostało z tobą' },
  goal: { en: 'the thing you hoped for', pl: 'twoje pragnienie' },
  place: { en: 'the place you belong to', pl: 'miejsce, do którego należysz' },
  work: { en: 'the work you do', pl: 'twoja praca' },
  other: { en: 'something about you', pl: 'coś o tobie' },
};

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A stored "Title: outcome" memory (a resolved daily moment) reads as its title image. */
function memoryTitleImage(content: string): string | null {
  const match = content.match(/^(.{2,64}?):\s+\S/s);
  if (!match) return null;
  const title = match[1].trim();
  return /[.!?]$/.test(title) ? null : title;
}

function memoryAsDreamImage(memory: Memory | undefined, language: 'en' | 'pl'): string {
  if (!memory) return 'the room breathing in the dark';
  const developmentStage = getDevelopmentStageFromMemory(memory.content);
  if (developmentStage) return DEVELOPMENT_DREAM_IMAGES[developmentStage][language];
  if (memory.tags.includes('absence')) return ABSENCE_DREAM_IMAGE[language];
  if (memory.tags.includes('daily-moment')) {
    const title = memoryTitleImage(memory.content);
    if (title) return title;
  }
  if (memory.tags.includes('user')) {
    const kind = memory.tags.find(tag => tag in USER_FACT_DREAM_IMAGES);
    return USER_FACT_DREAM_IMAGES[kind ?? 'other'][language];
  }
  return memory.content.replace(/^user\s+/i, 'you ').replace(/[.!]$/, '').slice(0, 90);
}

/**
 * Repairs only the recognisable malformed construction that older dream
 * generations stored: milestone UI copy ("Reached First words", legacy
 * "reached first_words" and their Polish forms) spliced into dream prose as a
 * noun image. The phrase is replaced with the same dream-safe image the
 * generator now uses; nothing else in the prose is paraphrased.
 */
const MILESTONE_PHRASE_LOOKUP = new Map<string, { stage: DevelopmentStage; language: 'en' | 'pl' }>();
for (const stage of DEVELOPMENT_STAGES) {
  MILESTONE_PHRASE_LOOKUP.set(stage.toLocaleLowerCase(), { stage, language: 'en' });
  MILESTONE_PHRASE_LOOKUP.set(getDevelopmentLabel(stage, 'en').toLocaleLowerCase(), { stage, language: 'en' });
  MILESTONE_PHRASE_LOOKUP.set(getDevelopmentLabel(stage, 'pl').toLocaleLowerCase(), { stage, language: 'pl' });
}
const MILESTONE_PHRASE_PATTERN = new RegExp(
  `(?:reached|osiągnęło etap:)\\s+(${[...MILESTONE_PHRASE_LOOKUP.keys()].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'gi',
);

export function repairMalformedDreamProse(text: string): string {
  if (!text || !/reached|osiągnęło etap:/i.test(text)) return text;
  return text.replace(MILESTONE_PHRASE_PATTERN, (match, value: string, offset: number, whole: string) => {
    const entry = MILESTONE_PHRASE_LOOKUP.get(value.toLocaleLowerCase());
    if (!entry) return match;
    const image = DEVELOPMENT_DREAM_IMAGES[entry.stage][entry.language];
    const lead = whole.slice(0, offset);
    return lead.length === 0 || /[:„]\s*$|[.!?]\s+$/.test(lead) ? capitalizeFirst(image) : image;
  });
}

export function generateDreamAfterSleep(state: GameState, sleptMs: number, now = authoritativeNow()): GameState {
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
  const polish = state.conversation.language === 'pl';
  const label = getInterestLabel(topic, polish ? 'pl' : 'en');
  const mood = dreamMood(state);
  const fragments = polish ? [
    `${capitalizeFirst(memoryAsDreamImage(first, 'pl'))}, ale każde drzwi prowadziły z powrotem do „${label}”.`,
    `„${memoryAsDreamImage(first, 'pl')}” unosiło się nad „${memoryAsDreamImage(second, 'pl')}” i nikogo to nie dziwiło.`,
    `Pokój nie miał ścian. Gdzieś daleko „${memoryAsDreamImage(first, 'pl')}” działo się od końca.`,
    `„${label}” mówiło twoim głosem. Zadało pytanie, którego po przebudzeniu już nie pamiętałem.`,
  ] : [
    `${capitalizeFirst(memoryAsDreamImage(first, 'en'))}, but every doorway led back to ${label}.`,
    `${capitalizeFirst(memoryAsDreamImage(first, 'en'))} floated above ${memoryAsDreamImage(second, 'en')}, and neither one thought this was strange.`,
    `The room had no walls. Somewhere far away, ${memoryAsDreamImage(first, 'en')} kept happening in reverse.`,
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
  const interests = updateInterest(migrateInterests(state.interests), topic, 0.5, 'dream', 0.1, 'creature_curiosity', now);
  return { ...state, innerLife, interests, memories: [...state.memories, dreamMemory].slice(-200) };
}

function canReveal(current: BondStage, required: BondStage) {
  return BOND_ORDER.indexOf(current) >= BOND_ORDER.indexOf(required);
}

export function revealPrivateThoughtIfAsked(state: GameState, text: string, now = authoritativeNow()): { state: GameState; reply: string | null } {
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
      const label = getInterestLabel(opinion.topic, polish ? 'pl' : 'en');
      const opening = opinion.stance >= 0.25 ? 'I like it' : opinion.stance <= -0.25 ? 'I do not really like it' : 'I am divided about it';
      return polish
        ? `Mam już własne zdanie o „${label}”. ${opinion.stance >= 0.25 ? 'Lubię to' : opinion.stance <= -0.25 ? 'Raczej tego nie lubię' : 'Mam mieszane uczucia'}. ${opinionReason(opinion.topic, opinion.stance, 'pl')}`
        : `I have my own view on ${label}. ${opening}. ${opinion.reason}`;
    }
  }
  return null;
}

export function clearPendingDisclosure(state: GameState): GameState {
  if (!state.innerLife.pendingDisclosure) return state;
  return { ...state, innerLife: { ...state.innerLife, pendingDisclosure: null } };
}

export function getInterestLabel(topic: string, language: 'en' | 'pl' = 'en') {
  if (language === 'pl') return POLISH_TOPIC_LABELS[topic] ?? topic.replace(/_/g, ' ');
  return INNER_TOPICS[topic]?.label ?? topic.replace(/_/g, ' ');
}

export function getRankedInterests(state: GameState, count = 4, language: 'en' | 'pl' = 'en') {
  return [...migrateInterests(state.interests)]
    .filter(isStableInterest)
    .sort((a, b) => b.level - a.level)
    .slice(0, count)
    .map(item => ({ ...item, label: getInterestLabel(item.type, language) }));
}

export function getInterestStage(level: number, language: 'en' | 'pl' = 'en') {
  if (level >= 75) return language === 'pl' ? 'fascynacja' : 'fascination';
  if (level >= 48) return language === 'pl' ? 'pasja' : 'passion';
  if (level >= 25) return language === 'pl' ? 'zainteresowanie' : 'interest';
  return language === 'pl' ? 'ciekawość' : 'curiosity';
}

export function getSelfAwarenessStageLabel(stage: SelfAwarenessStage, language: 'en' | 'pl' = 'en') {
  const labels: Record<SelfAwarenessStage, { en: string; pl: string }> = {
    unaware: { en: 'noticing a reflection', pl: 'zauważa odbicie' },
    other: { en: 'another creature', pl: 'widzi innego stworka' },
    copying: { en: 'matching movements', pl: 'naśladuje ruchy' },
    recognized: { en: 'recognises itself', pl: 'rozpoznaje siebie' },
    reflective: { en: 'reflects on itself', pl: 'myśli o sobie' },
  };
  return labels[stage][language];
}

export function getDreamMoodLabel(mood: CreatureDream['mood'], language: 'en' | 'pl' = 'en') {
  const labels: Record<CreatureDream['mood'], { en: string; pl: string }> = {
    warm: { en: 'warm', pl: 'ciepły' },
    strange: { en: 'strange', pl: 'dziwny' },
    restless: { en: 'restless', pl: 'niespokojny' },
    bright: { en: 'bright', pl: 'jasny' },
    lonely: { en: 'lonely', pl: 'samotny' },
  };
  return labels[mood][language];
}
