import { authoritativeNow } from './authoritativeTime';
import {
  ContinuityState,
  GameState,
  Memory,
  OpenConversationLoop,
  UserFactKind,
} from '../types';
import { getRankedInterests } from './innerLifeSystem';
import { getLifePathTitle, migrateLifePathState } from './lifePathSystem';

const CHAPTER_INTERVAL = 8;
const MAX_CHAPTERS = 20;
const MAX_OPEN_LOOPS = 30;

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-ząćęłńóśźż0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
}

function cleanSubject(value: string) {
  return value.replace(/[.!?,;:]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function createContinuityState(): ContinuityState {
  return {
    chapters: [],
    openLoops: [],
    lastChapterMessageCount: 0,
    lastCompressedAt: 0,
  };
}

export function migrateContinuityState(value?: Partial<ContinuityState> | null): ContinuityState {
  const fallback = createContinuityState();
  if (!value) return fallback;
  return {
    chapters: Array.isArray(value.chapters) ? value.chapters.slice(-MAX_CHAPTERS) : [],
    openLoops: Array.isArray(value.openLoops) ? value.openLoops.slice(-MAX_OPEN_LOOPS) : [],
    lastChapterMessageCount: Math.max(0, value.lastChapterMessageCount ?? 0),
    lastCompressedAt: Math.max(0, value.lastCompressedAt ?? 0),
  };
}

function loopDelay(kind: OpenConversationLoop['kind']) {
  if (kind === 'feeling') return 4 * 60 * 60_000;
  if (kind === 'story') return 8 * 60 * 60_000;
  if (kind === 'goal') return 12 * 60 * 60_000;
  return 18 * 60 * 60_000;
}

function upsertLoop(state: GameState, kind: OpenConversationLoop['kind'], subject: string, now: number): GameState {
  const cleaned = cleanSubject(subject);
  if (cleaned.length < 2) return state;
  const key = normalize(cleaned);
  const existing = state.continuity.openLoops.find(loop => !loop.resolvedAt && loop.kind === kind && (
    normalize(loop.subject) === key || normalize(loop.subject).includes(key) || key.includes(normalize(loop.subject))
  ));
  if (existing) {
    return {
      ...state,
      continuity: {
        ...state.continuity,
        openLoops: state.continuity.openLoops.map(loop => loop.id === existing.id ? {
          ...loop,
          subject: cleaned.length > loop.subject.length ? cleaned : loop.subject,
          dueAt: Math.max(loop.dueAt, now + loopDelay(kind)),
          resolvedAt: null,
        } : loop),
      },
    };
  }
  const loop: OpenConversationLoop = {
    id: `loop-${kind}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    subject: cleaned,
    createdAt: now,
    dueAt: now + loopDelay(kind),
    lastAskedAt: 0,
    askCount: 0,
    resolvedAt: null,
  };
  return {
    ...state,
    continuity: {
      ...state.continuity,
      openLoops: [...state.continuity.openLoops, loop].slice(-MAX_OPEN_LOOPS),
    },
  };
}

function latestFact(state: GameState, kind: UserFactKind, now: number) {
  return [...state.conversation.facts].reverse().find(fact => fact.kind === kind && fact.lastMentioned === now);
}

function resolveLoopsFromText(state: GameState, text: string, now: number): GameState {
  const completed = /\b(?:done|finished|completed|managed to|it worked|udało się|udalo sie|zrobiłem|zrobilem|zrobiłam|zrobilam|skończyłem|skonczylem|gotowe)\b/i.test(text);
  const feelingBetter = /\b(?:feel better|feeling better|i'm okay|i am okay|już lepiej|juz lepiej|czuję się lepiej|czuje sie lepiej|jest okej|jestem spokojniejsz)\b/i.test(text);
  if (!completed && !feelingBetter) return state;
  const candidates = state.continuity.openLoops
    .filter(loop => !loop.resolvedAt && ((completed && (loop.kind === 'goal' || loop.kind === 'promise')) || (feelingBetter && loop.kind === 'feeling')))
    .sort((a, b) => b.createdAt - a.createdAt);
  const chosen = candidates.find(loop => {
    const words = normalize(loop.subject).split(' ').filter(word => word.length >= 5);
    return words.some(word => normalize(text).includes(word));
  }) ?? candidates[0];
  if (!chosen) return state;
  const memory: Memory = {
    id: `mem-loop-resolved-${now}`,
    timestamp: now,
    content: `came back to ${chosen.subject} and closed the loop`,
    importance: 7,
    emotionalValence: 0.65,
    tags: ['conversation', 'continuity', 'resolved', chosen.kind],
    mentioned: false,
    understood: true,
    compressed: false,
  };
  return {
    ...state,
    continuity: {
      ...state.continuity,
      openLoops: state.continuity.openLoops.map(loop => loop.id === chosen.id ? { ...loop, resolvedAt: now } : loop),
    },
    memories: [...state.memories, memory].slice(-200),
  };
}

function discoverLoops(state: GameState, text: string, now: number): GameState {
  let next = state;
  const goal = latestFact(next, 'goal', now);
  if (goal) next = upsertLoop(next, 'goal', goal.value, now);
  const feeling = latestFact(next, 'feeling', now);
  if (feeling && /(?:sad|bad|hurt|tired|stressed|angry|lonely|smut|źle|zle|zmęcz|zmecz|stres|wkurz|samot|boli)/i.test(feeling.value)) {
    next = upsertLoop(next, 'feeling', feeling.value, now);
  }
  const promise = text.match(/(?:\b(?:tomorrow|later today|next week)\s+(?:i will|i'll)|\b(?:jutro|później dziś|pozniej dzis|w przyszłym tygodniu|w przyszlym tygodniu)\s+)([^.!?]{3,100})/i);
  if (promise?.[1]) next = upsertLoop(next, 'promise', promise[1], now);
  const story = text.match(/(?:i(?:'ll| will) tell you (?:later|tomorrow) about|opowiem ci (?:później|pozniej|jutro) o)\s+([^.!?]{3,100})/i);
  if (story?.[1]) next = upsertLoop(next, 'story', story[1], now);
  return next;
}

function windowMemories(state: GameState, startedAt: number, now: number) {
  return [...state.memories]
    .filter(memory => (
      memory.timestamp >= startedAt
      && memory.timestamp <= now
      && !memory.compressed
      && memory.importance >= 5
      && (memory.tags.includes('outdoors')
        || memory.tags.includes('weather')
        || memory.tags.includes('creation')
        || memory.tags.includes('resolved')
        || memory.tags.includes('first'))
    ))
    .sort((a, b) => b.importance - a.importance || b.timestamp - a.timestamp);
}

function composeChapter(state: GameState, index: number, startedAt: number, now: number) {
  const polish = state.conversation.language === 'pl';
  const language = polish ? 'pl' : 'en';
  const facts = [...state.conversation.facts]
    .filter(fact => fact.lastMentioned >= startedAt)
    .sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)
    .slice(0, 3);
  const topics = getRankedInterests(state, 3, language)
    .filter(interest => interest.lastEngaged >= startedAt)
    .map(interest => interest.label);
  const pathState = migrateLifePathState(state.lifePath, state.personality, now);
  const pathTitle = pathState.primary ? getLifePathTitle(state, language) : null;
  const beats = windowMemories(state, startedAt, now);
  const outdoor = beats.find(memory => memory.tags.includes('outdoors'));
  const loops = state.continuity.openLoops.filter(loop => (
    (loop.createdAt >= startedAt && loop.createdAt <= now)
    || (loop.resolvedAt != null && loop.resolvedAt >= startedAt && loop.resolvedAt <= now)
  ));
  const resolved = loops.find(loop => loop.resolvedAt);
  const open = loops.find(loop => !loop.resolvedAt);
  const outdoorCondition = outdoor?.tags.find(tag => tag.startsWith('weather:') && tag !== 'weather:unknown')?.slice(8).replace(/_/g, ' ');

  const parts: string[] = [];
  if (facts.length) {
    const listed = facts.map(fact => fact.value).join(', ');
    parts.push(polish ? `Wracałeś do: ${listed}.` : `You kept returning to ${listed}.`);
  }
  if (outdoor) {
    parts.push(outdoorCondition
      ? (polish ? `Wyszedłem na dwór — ${outdoorCondition}.` : `I stepped outside into ${outdoorCondition}.`)
      : (polish ? 'Wyszedłem na dwór na chwilę.' : 'I stepped outside for a while.'));
  } else if (beats[0] && parts.length < 2) {
    parts.push(polish ? `Zostało we mnie: ${beats[0].content.slice(0, 80)}.` : `It stayed with me: ${beats[0].content.slice(0, 80)}.`);
  }
  if (resolved && parts.length < 2) {
    parts.push(polish ? `Domknęło się: ${resolved.subject}.` : `That stretch closed ${resolved.subject}.`);
  } else if (open && parts.length < 2 && !facts.some(fact => normalize(fact.value).includes(normalize(open.subject).slice(0, 12)))) {
    parts.push(polish ? `Wciąż trzymam ${open.subject}.` : `I am still holding ${open.subject}.`);
  } else if (pathTitle && parts.length < 2) {
    parts.push(polish ? `Ta część miała smak drogi „${pathTitle}”.` : `This stretch had the flavour of ${pathTitle}.`);
  }
  if (!parts.length) {
    parts.push(polish
      ? 'Małe rzeczy powtarzały się między nami, jeszcze bez twardej roli.'
      : 'Small things kept repeating between us, still without a settled role.');
  }

  const headline = topics[0]
    ?? (outdoor ? (polish ? 'na dworze' : 'outside') : null)
    ?? (open?.subject ?? resolved?.subject ?? facts[0]?.value)?.slice(0, 32)
    ?? (polish ? 'między nami' : 'between us');

  return {
    title: polish ? `Rozdział ${index}: ${headline}` : `Chapter ${index}: ${headline}`,
    summary: parts.slice(0, 2).join(' ').slice(0, 320),
    topics,
    factIds: facts.map(fact => fact.id),
  };
}

function buildChapter(state: GameState, now: number): GameState {
  const since = state.conversation.totalUserMessages - state.continuity.lastChapterMessageCount;
  if (since < CHAPTER_INTERVAL) return state;
  const index = state.continuity.chapters.length + 1;
  const startedAt = state.continuity.chapters[state.continuity.chapters.length - 1]?.endedAt ?? state.identity.birthTimestamp;
  const composed = composeChapter(state, index, startedAt, now);
  const chapter = {
    id: `chapter-${index}-${now}`,
    index,
    title: composed.title,
    summary: composed.summary,
    topics: composed.topics,
    factIds: composed.factIds,
    startedAt,
    endedAt: now,
  };
  const chapterMemory: Memory = {
    id: `mem-${chapter.id}`,
    timestamp: now,
    content: chapter.summary,
    importance: 8,
    emotionalValence: 0.3,
    tags: ['conversation', 'chapter', 'continuity'],
    mentioned: false,
    understood: true,
    compressed: false,
  };
  return {
    ...state,
    conversation: { ...state.conversation, messages: state.conversation.messages.slice(-80) },
    continuity: {
      ...state.continuity,
      chapters: [...state.continuity.chapters, chapter].slice(-MAX_CHAPTERS),
      lastChapterMessageCount: state.conversation.totalUserMessages,
      lastCompressedAt: now,
    },
    memories: [...state.memories.map(memory => (
      memory.timestamp < startedAt && memory.importance <= 4 ? { ...memory, compressed: true } : memory
    )), chapterMemory].slice(-200),
  };
}

export function evolveContinuity(state: GameState, text: string, now = authoritativeNow()): GameState {
  let next = { ...state, continuity: migrateContinuityState(state.continuity) };
  next = resolveLoopsFromText(next, text, now);
  next = discoverLoops(next, text, now);
  return buildChapter(next, now);
}

export function getDueOpenLoop(state: GameState, now = authoritativeNow()): OpenConversationLoop | null {
  return [...state.continuity.openLoops]
    .filter(loop => !loop.resolvedAt && loop.dueAt <= now && (loop.lastAskedAt === 0 || now - loop.lastAskedAt >= 6 * 60 * 60_000) && loop.askCount < 4)
    .sort((a, b) => {
      const priority = (kind: OpenConversationLoop['kind']) => kind === 'feeling' ? 4 : kind === 'goal' ? 3 : kind === 'promise' ? 2 : 1;
      return priority(b.kind) - priority(a.kind) || a.dueAt - b.dueAt;
    })[0] ?? null;
}

export function markOpenLoopAsked(state: GameState, loopId: string, now = authoritativeNow()): GameState {
  if (!state.continuity.openLoops.some(loop => loop.id === loopId)) return state;
  return {
    ...state,
    continuity: {
      ...state.continuity,
      openLoops: state.continuity.openLoops.map(loop => loop.id === loopId ? {
        ...loop,
        lastAskedAt: now,
        askCount: loop.askCount + 1,
      } : loop),
    },
  };
}

export function getOpenLoopPrompt(state: GameState, loop: OpenConversationLoop) {
  const polish = state.conversation.language === 'pl';
  if (polish) {
    if (loop.kind === 'feeling') return `Wcześniej mówiłeś, że jest ci ${loop.subject}. Jak jest teraz?`;
    if (loop.kind === 'goal') return `Pamiętam, że chciałeś ${loop.subject}. Zrobiłeś jakiś krok?`;
    if (loop.kind === 'promise') return `Mówiłeś, że później ${loop.subject}. Co z tego wyszło?`;
    return `Miałeś mi opowiedzieć o ${loop.subject}. Nadal chcę usłyszeć.`;
  }
  if (loop.kind === 'feeling') return `Earlier you said you felt ${loop.subject}. How is it now?`;
  if (loop.kind === 'goal') return `I remember you wanted to ${loop.subject}. Did you make a step?`;
  if (loop.kind === 'promise') return `You said you would ${loop.subject}. What happened with it?`;
  return `You meant to tell me about ${loop.subject}. I still want to hear it.`;
}

export function getContinuityReply(state: GameState, text: string): string | null {
  if (!/(?:what do you remember from our talks|what have we talked about|our conversations|co pamiętasz z naszych rozmów|co pamietasz z naszych rozmow|o czym rozmawialiśmy|o czym rozmawialismy)/i.test(text)) return null;
  const chapter = state.continuity.chapters[state.continuity.chapters.length - 1];
  if (!chapter) return state.conversation.language === 'pl'
    ? 'Pamiętam pojedyncze rzeczy, ale jeszcze nie ułożyły się w cały rozdział.'
    : 'I remember separate things, but they have not formed a whole chapter yet.';
  return chapter.summary;
}
