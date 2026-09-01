import {
  ChatMessage,
  ConversationLanguage,
  ConversationState,
  DevelopmentStage,
  GameState,
  LearnedUserFact,
  Memory,
  UserFactKind,
} from '../types';
import { advanceDevelopmentFromConversation, getDevelopmentLabel, syncDevelopmentWithAge } from './developmentSystem';
import { attemptImitation, findExistingObservation, parseUserStatement, recordObservation } from './socialLearningSystem';
import { recordBondEvent } from './relationshipSystem';
import { evolveLifePath, evolveLifePathFromCreatureStatement, evolveLifePathFromImitation, getLifePathTitle, getRestSchedule } from './lifePathSystem';
import { getSleepBlocker } from './needsSystem';
import { getTimeOfDay, isCreatureRestPhase } from './timeSystem';
import {
  clearPendingDisclosure,
  evolveInnerLifeFromConversation,
  evolveInnerLifeFromCreatureStatement,
  getInnerLifeReply,
  revealPrivateThoughtIfAsked,
} from './innerLifeSystem';
import { evolveContinuity, getContinuityReply } from './continuitySystem';
import { getPresenceReply } from './presenceSystem';
import { echoSharedPhrase, getSharedLanguageReply, observeSharedLanguage } from './sharedLanguageSystem';

const MAX_MESSAGES = 120;
const MAX_FACTS = 32;

export function createConversationState(): ConversationState {
  return {
    messages: [],
    facts: [],
    totalUserMessages: 0,
    totalCreatureMessages: 0,
    language: 'unknown',
    lastConversationAt: 0,
    lastCreatureMessage: null,
  };
}

export function isCannedRoomSpeech(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return /^(quiet here|what now|cicho tu|co teraz)[.?!]?$/i.test(trimmed)
    || /^(it is quiet today|cicho tu dzisiaj)[.?!]?$/i.test(trimmed);
}

/** Their rest is not a conversation window. True while sleeping, in a rest
 * phase, or drowsy (unless a body need is keeping them up). The gate blocks
 * DeepSeek, fact learning and transcripts; the room stays quiet — no canned
 * murmur, silence is valid. */
export function isRestingChatGate(state: GameState, now = Date.now()): boolean {
  if (state.sleepState === 'sleeping') return true;
  const rest = isCreatureRestPhase(getTimeOfDay(now, state.world), getRestSchedule(state.lifePath));
  const upForCare = Boolean(getSleepBlocker(state));
  // A body need may keep them physically awake, but it does not turn their
  // rest into a conversation window. Care remains available through the room.
  if (rest) return true;
  if (state.sleepState === 'drowsy' && !upForCare) return true;
  return false;
}

export function migrateConversationState(value?: Partial<ConversationState> | null): ConversationState {
  const fallback = createConversationState();
  if (!value) return fallback;
  const messages = Array.isArray(value.messages)
    ? value.messages.filter(message => message?.sender === 'user' || message?.sender === 'creature').slice(-MAX_MESSAGES)
    : [];
  const facts = Array.isArray(value.facts)
    ? value.facts.filter(fact => fact?.value && fact?.kind).slice(-MAX_FACTS)
    : [];
  const lastCreatureMessage = value.lastCreatureMessage ?? null;
  return {
    messages,
    facts,
    totalUserMessages: Math.max(value.totalUserMessages ?? 0, messages.filter(message => message.sender === 'user').length),
    totalCreatureMessages: Math.max(value.totalCreatureMessages ?? 0, messages.filter(message => message.sender === 'creature').length),
    language: value.language === 'pl' || value.language === 'en' ? value.language : 'unknown',
    lastConversationAt: value.lastConversationAt ?? 0,
    lastCreatureMessage: isCannedRoomSpeech(lastCreatureMessage) ? null : lastCreatureMessage,
  };
}

function detectLanguage(text: string, previous: ConversationLanguage): ConversationLanguage {
  const lower = text.toLowerCase();
  const polishSignals = /[ąćęłńóśźż]|\b(jestem|mam|lubię|lubie|chcę|chce|czuję|czuje|dzisiaj|dlaczego|cześć|hejka|dobrze|źle|nie|tak)\b/i;
  const englishSignals = /\b(the|and|that|this|with|because|like|want|feel|hello|today|why|yes)\b/i;
  if (polishSignals.test(lower)) return 'pl';
  if (englishSignals.test(lower)) return 'en';
  return previous !== 'unknown' ? previous : 'en';
}

function cleanFactValue(value: string): string {
  return value
    .split(/\b(?:because|but|although|when|bo|ale|chociaż|kiedy)\b/i)[0]
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

interface FactPattern {
  kind: UserFactKind;
  sentiment: number;
  regex: RegExp;
}

const FACT_PATTERNS: FactPattern[] = [
  { kind: 'name', sentiment: 0.3, regex: /\b(?:my name is|call me)\s+([a-z][a-z'-]{1,30})/i },
  { kind: 'name', sentiment: 0.3, regex: /\b(?:mam na imię|mam na imie|nazywam się|nazywam sie|mów mi|mow mi)\s+([a-ząćęłńóśźż][a-ząćęłńóśźż'-]{1,30})/i },
  { kind: 'dislike', sentiment: -0.8, regex: /\b(?:i hate|i dislike|i can't stand)\s+(.+)/i },
  { kind: 'dislike', sentiment: -0.8, regex: /\b(?:nienawidzę|nienawidze|nie lubię|nie lubie)\s+(.+)/i },
  { kind: 'like', sentiment: 0.8, regex: /\b(?:i love|i really like|i like|my favourite is|my favorite is)\s+(.+)/i },
  { kind: 'like', sentiment: 0.8, regex: /\b(?:uwielbiam|bardzo lubię|bardzo lubie|lubię|lubie|moje ulubione to)\s+(.+)/i },
  { kind: 'feeling', sentiment: 0, regex: /\b(?:i feel|i'm feeling|i am feeling)\s+(.+)/i },
  { kind: 'feeling', sentiment: 0, regex: /\b(?:czuję się|czuje sie|jest mi)\s+(.+)/i },
  { kind: 'feeling', sentiment: 0, regex: /\bjestem\s+((?:bardzo\s+)?(?:zmęczon\w*|zmeczon\w*|smutn\w*|szczęśliw\w*|szczesliw\w*|wkurzon\w*|spokojn\w*|zestresowan\w*|chory|chora))/i },
  { kind: 'goal', sentiment: 0.5, regex: /\b(?:i want to|i'm trying to|i am trying to|my goal is to)\s+(.+)/i },
  { kind: 'goal', sentiment: 0.5, regex: /\b(?:chcę|chce|próbuję|probuje|moim celem jest)\s+(.+)/i },
  { kind: 'place', sentiment: 0.1, regex: /\b(?:i live in|i'm from|i am from)\s+(.+)/i },
  { kind: 'place', sentiment: 0.1, regex: /\b(?:mieszkam w|jestem z)\s+(.+)/i },
  { kind: 'work', sentiment: 0.1, regex: /\b(?:i work as|i study|i'm a|i am a)\s+(.+)/i },
  { kind: 'work', sentiment: 0.1, regex: /\b(?:pracuję jako|pracuje jako|studiuję|studiuje)\s+(.+)/i },
];

export function extractUserFact(text: string): Omit<LearnedUserFact, 'id' | 'confidence' | 'mentions' | 'learnedAt' | 'lastMentioned' | 'normalizedValue'> | null {
  for (const pattern of FACT_PATTERNS) {
    const match = text.match(pattern.regex);
    if (!match?.[1]) continue;
    const value = cleanFactValue(match[1]);
    if (value.length < 2) continue;
    return { kind: pattern.kind, value, sentiment: pattern.sentiment };
  }
  return null;
}

function mergeFact(state: GameState, fact: ReturnType<typeof extractUserFact>, now: number): { state: GameState; fact: LearnedUserFact | null; isNew: boolean } {
  if (!fact) return { state, fact: null, isNew: false };
  const normalizedValue = fact.value.toLocaleLowerCase();
  const existing = state.conversation.facts.find(item => item.kind === fact.kind && item.normalizedValue === normalizedValue);
  if (existing) {
    const updatedFact: LearnedUserFact = {
      ...existing,
      confidence: Math.min(1, existing.confidence + 0.14),
      mentions: existing.mentions + 1,
      lastMentioned: now,
      sentiment: (existing.sentiment + fact.sentiment) / 2,
    };
    return {
      state: {
        ...state,
        conversation: {
          ...state.conversation,
          facts: state.conversation.facts.map(item => item.id === existing.id ? updatedFact : item),
        },
      },
      fact: updatedFact,
      isNew: false,
    };
  }

  const learned: LearnedUserFact = {
    id: `fact-${now}-${Math.random().toString(36).slice(2, 7)}`,
    kind: fact.kind,
    value: fact.value,
    normalizedValue,
    sentiment: fact.sentiment,
    confidence: 0.55,
    mentions: 1,
    learnedAt: now,
    lastMentioned: now,
  };
  const memoryContent = {
    name: `learned the user's name is ${fact.value}`,
    like: `learned the user likes ${fact.value}`,
    dislike: `learned the user dislikes ${fact.value}`,
    feeling: `noticed the user felt ${fact.value}`,
    goal: `learned the user wants to ${fact.value}`,
    place: `learned the user is connected to ${fact.value}`,
    work: `learned the user works or studies as ${fact.value}`,
    other: `learned ${fact.value} about the user`,
  }[fact.kind];
  const memory: Memory = {
    id: `mem-fact-${now}`,
    timestamp: now,
    content: memoryContent,
    importance: fact.kind === 'name' ? 8 : 5,
    emotionalValence: fact.sentiment,
    tags: ['conversation', 'user', fact.kind],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 20,
    compressed: false,
  };
  return {
    state: {
      ...state,
      conversation: {
        ...state.conversation,
        facts: [...state.conversation.facts, learned].slice(-MAX_FACTS),
      },
      memories: [...state.memories, memory].slice(-200),
    },
    fact: learned,
    isNew: true,
  };
}

function choose<T>(items: T[], state: GameState, salt = 0): T {
  const index = Math.abs(state.identity.seed + state.conversation.totalUserMessages * 17 + salt * 31) % items.length;
  return items[index];
}

function dominantVoice(state: GameState): 'curious' | 'warm' | 'careful' | 'independent' | 'playful' | 'calm' {
  const pathVoice = state.lifePath.primary ? {
    stoner: 'calm',
    party_animal: 'playful',
    alcoholic: 'warm',
    gymbro: 'independent',
    workaholic: 'careful',
    doomer: 'careful',
    degen: 'playful',
    gamer: 'playful',
    conspiracist: 'curious',
    caretaker: 'warm',
    monk: 'calm',
    rebel: 'independent',
  }[state.lifePath.primary] as ReturnType<typeof dominantVoice> : null;
  if (pathVoice && state.lifePath.scores[state.lifePath.primary!] >= 35) return pathVoice;
  const scored = [
    ['curious', state.personality.curiosity] as const,
    ['warm', (state.personality.affection + state.personality.sociability) / 2] as const,
    ['careful', state.personality.caution] as const,
    ['independent', (state.personality.independence + state.personality.stubbornness) / 2] as const,
    ['playful', state.personality.impulsiveness] as const,
    ['calm', state.personality.calmness] as const,
  ];
  return scored.sort((a, b) => b[1] - a[1])[0][0];
}

function newbornReply(state: GameState, text: string): string {
  const lower = text.toLowerCase();
  const polish = state.conversation.language === 'pl';
  if (/[?]$/.test(text)) return choose(polish ? ['Nie wiem jeszcze.', 'Powiedz mi.', 'Chcę zrozumieć.'] : ['I do not know yet.', 'Tell me.', 'I want to understand.'], state, text.length);
  if (/sad|bad|hurt|smut|źle|zle|boli/.test(lower)) return choose(polish ? ['Słyszę, że jest źle.', 'Zostań tu chwilę.', 'Nie lubię, kiedy cię boli.'] : ['I hear that it is bad.', 'Stay here a moment.', 'I do not like when you hurt.'], state, text.length);
  if (/love|good|happy|koch|dobr|super|fajn/.test(lower)) return choose(polish ? ['To brzmi dobrze.', 'Lubię to.', 'Cieszę się z tobą.'] : ['That sounds good.', 'I like that.', 'I am happy with you.'], state, text.length);
  return choose(polish ? ['Słyszę cię.', 'Jestem tutaj.', 'Powiedz jeszcze coś.'] : ['I hear you.', 'I am here.', 'Tell me one more thing.'], state, text.length);
}

function shortFactReply(stage: DevelopmentStage, fact: LearnedUserFact, language: ConversationLanguage, state: GameState): string {
  if (stage === 'animal' || stage === 'communicating') return `${fact.value}?`;
  if (language === 'pl') {
    if (stage === 'first_words') {
      return fact.kind === 'name' ? `${fact.value}. ty.` : choose([`${fact.value}?`, `ty lubisz ${fact.value}`, `zapamiętam ${fact.value}`], state, fact.value.length);
    }
    if (stage === 'combining') {
      const lines = fact.kind === 'name'
        ? [`${fact.value}. To jesteś ty.`, `Będę mówić ${fact.value}.`]
        : fact.kind === 'dislike'
          ? [`Nie lubisz ${fact.value}. Dlaczego?`, `${fact.value} jest złe dla ciebie?`]
          : fact.kind === 'feeling'
            ? [`Czujesz się ${fact.value}. Co się stało?`, `${fact.value}... chcę zrozumieć.`]
            : [`Zapamiętam ${fact.value}.`, `Co lubisz w ${fact.value}?`];
      return choose(lines, state, fact.value.length);
    }
  } else {
    if (stage === 'first_words') {
      return fact.kind === 'name' ? `${fact.value}. you.` : choose([`${fact.value}?`, `you like ${fact.value}`, `remember ${fact.value}`], state, fact.value.length);
    }
    if (stage === 'combining') {
      const lines = fact.kind === 'name'
        ? [`${fact.value}. That's you.`, `I will call you ${fact.value}.`]
        : fact.kind === 'dislike'
          ? [`You don't like ${fact.value}. Why?`, `Is ${fact.value} bad for you?`]
          : fact.kind === 'feeling'
            ? [`You feel ${fact.value}. What happened?`, `${fact.value}... I want to understand.`]
            : [`I will remember ${fact.value}.`, `What do you like about ${fact.value}?`];
      return choose(lines, state, fact.value.length);
    }
  }

  if (language === 'pl') {
    const mature = {
      name: [`${fact.value}. Dobrze — zapamiętam, że tak masz na imię.`, `A więc ${fact.value}. Teraz twoje imię należy też do moich wspomnień.`],
      like: [`Zapamiętam, że lubisz ${fact.value}. Co jest w tym dla ciebie ważne?`, `${fact.value} sprawia ci radość. Może kiedyś zrozumiem dlaczego.`],
      dislike: [`Nie lubisz ${fact.value}. To przez jedno wydarzenie czy zawsze tak było?`, `Zapisuję sobie: ${fact.value} nie jest dla ciebie.`],
      feeling: [`Czujesz się ${fact.value}. Chcesz mi powiedzieć, co do tego doprowadziło?`, `Słyszę, że jest ci ${fact.value}. Jestem tutaj.`],
      goal: [`Chcesz ${fact.value}. Mogę później zapytać, czy zrobiłeś krok w tę stronę.`, `${fact.value} brzmi jak coś, co ma dla ciebie znaczenie.`],
      place: [`Czyli ${fact.value} jest częścią twojego świata. Jak tam jest?`, `Zapamiętam miejsce: ${fact.value}.`],
      work: [`Zapamiętam: ${fact.value}. Lubisz tę część swojego życia?`, `${fact.value} — chcę później usłyszeć o tym więcej.`],
      other: [`Zapamiętam ${fact.value}.`, `Opowiedz mi więcej o ${fact.value}.`],
    }[fact.kind];
    return choose(mature, state, fact.value.length);
  }

  const mature = {
    name: [`${fact.value}. Good — I'll remember that is your name.`, `So you are ${fact.value}. Your name is part of my memory now.`],
    like: [`I'll remember that you like ${fact.value}. What matters to you about it?`, `${fact.value} makes you happy. Maybe I will understand why one day.`],
    dislike: [`You don't like ${fact.value}. Was it one moment, or has it always felt that way?`, `I'm keeping this: ${fact.value} is not for you.`],
    feeling: [`You feel ${fact.value}. Do you want to tell me what led to it?`, `I hear that you feel ${fact.value}. I'm here.`],
    goal: [`You want to ${fact.value}. I can ask later if you moved toward it.`, `${fact.value} sounds like it matters to you.`],
    place: [`So ${fact.value} is part of your world. What is it like there?`, `I will remember the place: ${fact.value}.`],
    work: [`I'll remember: ${fact.value}. Do you like that part of your life?`, `${fact.value} — I want to hear more about that later.`],
    other: [`I will remember ${fact.value}.`, `Tell me more about ${fact.value}.`],
  }[fact.kind];
  return choose(mature, state, fact.value.length);
}

function memoryReply(state: GameState, language: ConversationLanguage): string | null {
  const remembered = [...state.conversation.facts].sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)[0];
  if (!remembered) return null;
  if (language === 'pl') {
    return remembered.kind === 'name'
      ? `Pamiętam, że masz na imię ${remembered.value}. Jeszcze niewiele, ale tego nie zgubiłem.`
      : `Pamiętam ${remembered.value}. To jedna z rzeczy, których nauczyłem się od ciebie.`;
  }
  return remembered.kind === 'name'
    ? `I remember your name is ${remembered.value}. I do not know much yet, but I kept that.`
    : `I remember ${remembered.value}. It is one of the things I learned from you.`;
}

function describePolishBehaviour(action: string, target: string): string {
  const phrases: Record<string, string> = {
    drink: `pijesz ${target}`,
    exercise: `ćwiczysz (${target})`,
    read: `czytasz ${target}`,
    'stay up': 'siedzisz do późna',
    avoid: `odkładasz ${target}`,
    help: 'pomagasz innym',
    swear: 'przeklinasz w rozmowie',
    'speak kindly': 'mówisz uprzejmie do innych',
    sleep: `śpisz ${target}`,
    clean: `sprzątasz ${target}`,
  };
  return phrases[action] ?? `${action} ${target}`;
}

function careReply(state: GameState, language: 'pl' | 'en'): string | null {
  if (state.needs.bowel < 24 && state.needs.bladder < 30) return language === 'pl' ? 'Muszę do toalety. Tak naprawdę: siku i kupę.' : 'I need the toilet. Actually: both pee and poop.';
  if (state.needs.bowel < 24) return language === 'pl' ? 'Muszę kupę. Trudno teraz siedzieć spokojnie.' : 'I need to poop. It is hard to sit still right now.';
  if (state.needs.bladder < 30) return language === 'pl' ? 'Muszę siku. Ciągle patrzę w stronę spokojnego kąta.' : 'I need to pee. I keep looking toward the quiet corner.';
  if (state.needs.hunger < 38) return language === 'pl' ? 'Jestem głodny. Myślę o tym, co leży na półce z jedzeniem.' : 'I am hungry. I keep thinking about the food shelf.';
  if (state.needs.hygiene < 40) return language === 'pl' ? 'Przydałoby mi się mycie. Futro już nie układa się tak jak zwykle.' : 'I could use a wash. My fur is not settling the way it usually does.';
  if (state.roomMess.length > 0) return language === 'pl' ? 'W pokoju został mały bałagan. Mogę go omijać, ale wolę czystą podłogę.' : 'There is a small mess in the room. I can step around it, but I prefer a clear floor.';
  return null;
}

function generateReply(state: GameState, text: string, fact: LearnedUserFact | null): string {
  const stage = state.development.stage;
  const language = state.conversation.language === 'unknown' ? 'en' : state.conversation.language;
  const lower = text.toLowerCase();
  const asksAboutCare = /(?:głod|glod|jedzeni|siku|toalet|kup[ęae]|brud|umyć|umyc|mycie|sprzątn|sprzatn|hungr|food|pee|toilet|poop|dirty|wash|clean the room)/i.test(lower);
  const asksHow = /\b(?:how are you|how do you feel|jak się czujesz|jak sie czujesz|co u ciebie)\b/i.test(lower);
  const currentCare = careReply(state, language);
  if ((asksAboutCare || asksHow) && currentCare) return currentCare;
  if (asksAboutCare && !currentCare) return language === 'pl' ? 'Teraz nic pilnego. Jest mi zwyczajnie dobrze.' : 'Nothing urgent right now. I feel ordinarily fine.';
  if (stage === 'newborn') return newbornReply(state, text);

  if (/\b(?:do you remember|remember me|pamiętasz|pamietasz)\b/i.test(lower)) {
    const remembered = [...state.conversation.facts].sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)[0];
    if (remembered && (stage === 'animal' || stage === 'communicating')) return `${remembered.value}?`;
    if (remembered && stage === 'first_words') return language === 'pl' ? `pamiętam ${remembered.value}` : `remember ${remembered.value}`;
    return memoryReply(state, language) ?? (language === 'pl' ? 'Jeszcze nie mam czego wspominać. Powiedz mi coś o sobie.' : 'I do not have much to remember yet. Tell me something about you.');
  }
  if (fact) return shortFactReply(stage, fact, language, state);

  const parsedBehaviour = parseUserStatement(text);
  if (parsedBehaviour?.target) {
    if (stage === 'animal' || stage === 'communicating') return `${parsedBehaviour.target}?`;
    if (language === 'pl') {
      const behaviour = describePolishBehaviour(parsedBehaviour.action ?? '', parsedBehaviour.target);
      if ((parsedBehaviour.perceivedNegativeOutcome ?? 0) > 0.45) return `Brzmi, jakby to miało swoją cenę. A jednak ${behaviour}.`;
      return `Często ${behaviour}? Chcę zrozumieć ten zwyczaj.`;
    }
    if ((parsedBehaviour.perceivedNegativeOutcome ?? 0) > 0.45) return `It sounds like that has a price. You still ${parsedBehaviour.action} ${parsedBehaviour.target}, though.`;
    return `Do you often ${parsedBehaviour.action} ${parsedBehaviour.target}? I want to understand that habit.`;
  }

  if (asksHow) {
    if (stage === 'animal' || stage === 'communicating') return state.emotionalState === 'happy' ? 'good!' : `${state.emotionalState}?`;
    return language === 'pl'
      ? `Czuję się ${state.emotionalState === 'neutral' ? 'spokojnie' : state.emotionalState}. Chyba każda rozmowa trochę mnie zmienia.`
      : `I feel ${state.emotionalState === 'neutral' ? 'quiet' : state.emotionalState}. I think every conversation changes me a little.`;
  }

  if (/\b(?:hello|hi|hey|cześć|czesc|hej|siema)\b/i.test(lower)) {
    if (stage === 'animal' || stage === 'communicating') return language === 'pl' ? 'ty. znowu.' : 'you. again.';
    return language === 'pl' ? 'Wróciłeś. Rozpoznaję już sposób, w jaki do mnie piszesz.' : 'You came back. I am starting to recognise the way you speak to me.';
  }

  if (stage === 'animal') {
    const word = cleanFactValue(text).split(/\s+/).filter(part => part.length > 3).slice(-1)[0];
    return word ? `${word}?` : newbornReply(state, text);
  }
  if (stage === 'communicating') {
    const word = cleanFactValue(text).split(/\s+/).filter(part => part.length > 3).slice(-1)[0];
    return word ? `${word}?` : (language === 'pl' ? 'powiedz więcej' : 'tell me more');
  }
  if (stage === 'first_words') {
    return language === 'pl'
      ? choose(['rozumiem trochę', 'dlaczego?', 'powiedz więcej', 'ty mnie uczysz'], state, text.length)
      : choose(['understand a little', 'why?', 'tell me more', 'you teach me'], state, text.length);
  }
  if (stage === 'combining') {
    const remembered = state.conversation.facts[state.conversation.facts.length - 1];
    if (remembered && state.conversation.totalUserMessages % 3 === 0) return shortFactReply(stage, remembered, language, state);
    return language === 'pl'
      ? choose(['Jeszcze składam to w głowie. Co masz na myśli?', 'To brzmi ważnie. Powiesz więcej?', 'Nie wiem, czy myślę tak samo. Dlaczego tak uważasz?'], state, text.length)
      : choose(['I am still putting that together. What do you mean?', 'That sounds important. Will you tell me more?', 'I do not know if I think the same. Why do you think that?'], state, text.length);
  }

  const voice = dominantVoice(state);
  if (text.trim().endsWith('?')) {
    const questionLines = language === 'pl'
      ? {
          curious: ['Jeszcze nie znam odpowiedzi, ale chcę ją zbudować razem z tobą. Co ty myślisz?', 'Najpierw chcę wiedzieć, dlaczego właśnie o to pytasz.'],
          warm: ['Nie jestem jeszcze pewien. Powiesz mi, co ty czujesz w tej sprawie?', 'Mogę nie znać odpowiedzi, ale mogę zostać przy tym pytaniu z tobą.'],
          careful: ['Nie chcę udawać, że wiem. Jakie fakty już mamy?', 'Muszę to przemyśleć ostrożnie. Co sprawiło, że o to pytasz?'],
          independent: ['Mam jeszcze za mało własnych doświadczeń, żeby się zgodzić. Jaka jest twoja odpowiedź?', 'Możliwe, że będę miał inne zdanie. Najpierw pokaż mi swoje.'],
          playful: ['Moja odpowiedź jeszcze rośnie. Na razie odbijam pytanie: a ty?', 'Dobre pytanie. Trochę mnie łaskocze w głowę. Co ty o tym myślisz?'],
          calm: ['Nie musimy odpowiadać od razu. Możemy rozłożyć to pytanie na części.', 'Jeszcze nie wiem. Opowiedz mi spokojnie, skąd wzięło się to pytanie.'],
        }[voice]
      : {
          curious: ['I do not know the answer yet, but I want to build it with you. What do you think?', 'First I want to know why you chose that question.'],
          warm: ['I am not sure yet. Will you tell me how you feel about it?', 'I may not know, but I can stay with the question beside you.'],
          careful: ['I do not want to pretend I know. What facts do we have?', 'I need to think carefully. What made you ask?'],
          independent: ['I do not have enough experience to agree yet. What is your answer?', 'I might form a different opinion. Show me yours first.'],
          playful: ['My answer is still growing. For now I bounce the question back: what about you?', 'Good question. It tickles my mind a little. What do you think?'],
          calm: ['We do not have to answer at once. We can take the question apart.', 'I do not know yet. Tell me slowly where the question came from.'],
        }[voice];
    return choose(questionLines, state, text.length);
  }

  const remembered = state.conversation.facts[state.conversation.facts.length - 1];
  if (remembered && state.conversation.totalUserMessages % 4 === 0) return shortFactReply(stage, remembered, language, state);
  return language === 'pl'
    ? choose(['Słucham. Co w tym jest dla ciebie najważniejsze?', 'To zostawia mi nowe pytanie. Co wydarzyło się potem?', 'Jeszcze nie mam gotowej opinii. Chcę najpierw lepiej poznać twoją.', 'Zapamiętam ton tej wiadomości, nawet jeśli nie rozumiem jeszcze wszystkiego.'], state, text.length)
    : choose(['I am listening. What matters most to you in that?', 'That leaves me with a new question. What happened next?', 'I do not have a finished opinion yet. I want to know yours better first.', 'I will remember the shape of that message even if I do not understand all of it yet.'], state, text.length);
}

export interface ConversationTurn {
  state: GameState;
  reply: string;
}

export interface ConversationTurnOptions {
  worldAction?: boolean;
}

export function beginConversationTurn(
  state: GameState,
  text: string,
  now = Date.now(),
  options: ConversationTurnOptions = {},
): ConversationTurn {
  const userMessage: ChatMessage = {
    id: `msg-${now}-user`,
    sender: 'user',
    text,
    timestamp: now,
  };
  let updated = syncDevelopmentWithAge(state, now);
  updated = {
    ...updated,
    conversation: {
      ...updated.conversation,
      language: detectLanguage(text, updated.conversation.language),
      messages: [...updated.conversation.messages, userMessage].slice(-MAX_MESSAGES),
      totalUserMessages: updated.conversation.totalUserMessages + 1,
      lastConversationAt: now,
    },
  };

  if (!options.worldAction) {
    const parsedBehaviour = parseUserStatement(text);
    updated = recordObservation(updated, text);
    updated = observeSharedLanguage(updated, text, now);
    if (parsedBehaviour?.action != null && parsedBehaviour.target != null) {
      const observation = findExistingObservation(updated, parsedBehaviour.action, parsedBehaviour.target);
      if (observation?.exposureCount && observation.exposureCount >= 2) {
        const imitationIds = new Set(updated.socialLearning.imitated.map(item => item.observedId));
        updated = attemptImitation(updated, observation.id);
        if (!imitationIds.has(observation.id) && updated.socialLearning.imitated.some(item => item.observedId === observation.id)) {
          updated = evolveLifePathFromImitation(updated, observation.id, now);
        }
      }
    }
    updated = evolveLifePath(updated, text, now);
    updated = evolveInnerLifeFromConversation(updated, text, now);
  }
  const revelation = revealPrivateThoughtIfAsked(updated, text, now);
  updated = revelation.state;
  const innerLifeReply = revelation.reply ?? getInnerLifeReply(updated, text);
  updated = advanceDevelopmentFromConversation(updated, now);
  const merged = mergeFact(updated, extractUserFact(text), now);
  updated = options.worldAction ? merged.state : recordBondEvent(merged.state, 'conversation');
  if (!options.worldAction) updated = evolveContinuity(updated, text, now);
  const continuityReply = getContinuityReply(updated, text);
  const presenceReply = getPresenceReply(updated, text);
  const sharedLanguageReply = getSharedLanguageReply(updated, text);
  const reply = innerLifeReply ?? continuityReply ?? presenceReply ?? sharedLanguageReply ?? generateReply(updated, text, merged.fact);
  return { state: updated, reply: echoSharedPhrase(updated, text, reply) };
}

export function appendCreatureMessage(
  state: GameState,
  text: string,
  now = Date.now(),
  options: { roomBubble?: boolean } = {},
): GameState {
  if (!text.trim()) return state;
  const last = state.conversation.messages[state.conversation.messages.length - 1];
  if (last?.sender === 'creature' && last.text === text) return state;
  const message: ChatMessage = {
    id: `msg-${now}-creature`,
    sender: 'creature',
    text,
    timestamp: now,
  };
  const showInRoom = options.roomBubble !== false && !isCannedRoomSpeech(text);
  let updated = clearPendingDisclosure({
    ...state,
    conversation: {
      ...state.conversation,
      messages: [...state.conversation.messages, message].slice(-MAX_MESSAGES),
      totalCreatureMessages: state.conversation.totalCreatureMessages + 1,
      lastCreatureMessage: showInRoom ? text : state.conversation.lastCreatureMessage,
      lastConversationAt: now,
    },
  });
  updated = evolveLifePathFromCreatureStatement(updated, text, now);
  updated = evolveInnerLifeFromCreatureStatement(updated, text, now);
  return updated;
}

export function getConversationOpening(state: GameState): string {
  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const name = state.identity.name || (language === 'pl' ? 'stworzenie' : 'creature');
  if (state.development.stage === 'newborn') return language === 'pl' ? `Hej. Jestem ${name}. Wszystko jest nowe, ale chcę z tobą gadać.` : `Hi. I am ${name}. Everything is new, but I want to talk to you.`;
  if (state.development.stage === 'animal') return language === 'pl' ? 'Jesteś znowu. Powiedz mi coś.' : 'You are here again. Tell me something.';
  if (state.development.stage === 'communicating') return language === 'pl' ? 'Jestem i słucham. Jaki dziś jesteś?' : 'I am here and listening. What are you like today?';
  if (language === 'pl') return `Jestem ${name}. Jeszcze się uczę. Powiedz mi coś prawdziwego o sobie.`;
  return `I am ${name}. I am still learning. Tell me something true about you.`;
}

export function getMindStatus(state: GameState): string {
  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const label = getDevelopmentLabel(state.development.stage, language);
  const exchanges = state.conversation.totalUserMessages;
  const path = getLifePathTitle(state, language);
  const polishCount = exchanges === 1 ? 'rozmowa' : exchanges % 10 >= 2 && exchanges % 10 <= 4 && (exchanges % 100 < 12 || exchanges % 100 > 14) ? 'rozmowy' : 'rozmów';
  return language === 'pl'
    ? `${label} · ${path} · ${exchanges} ${polishCount}`
    : `${label} · ${path} · ${exchanges} ${exchanges === 1 ? 'exchange' : 'exchanges'}`;
}
