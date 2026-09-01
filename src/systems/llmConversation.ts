import { ChatMessage, GameState, LifePathId } from '../types';
import {
  getLifePathDescription,
  getLifePathTitle,
  getRestSchedule,
  isStablePath,
  isVisibleDirection,
  LIFE_PATHS,
  LIFE_PATH_IDS,
  migrateLifePathState,
} from './lifePathSystem';
import { getRankedInterests } from './innerLifeSystem';
import { getAbsenceSummary } from './presenceSystem';
import { getAdoptedSharedPhrases } from './sharedLanguageSystem';
import { wantsOutdoors } from './environmentSystem';
import { getTimeOfDay, isCreatureRestPhase } from './timeSystem';
import { getTurnstileToken } from './turnstile';

const API_URL = String((import.meta as { env?: { VITE_BECOMING_API_URL?: string } }).env?.VITE_BECOMING_API_URL ?? '').replace(/\/$/, '');
const CLIENT_ID_KEY = 'becoming-ai-client';
const ephemeralClientId = crypto.randomUUID().replace(/-/g, '');

function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{20,64}$/.test(existing)) return existing;
    localStorage.setItem(CLIENT_ID_KEY, ephemeralClientId);
  } catch { /* private browsing or blocked storage */ }
  return ephemeralClientId;
}
const MAX_CONTEXT_MESSAGES = 14;
const REQUEST_TIMEOUT_MS = 25_000;
const FLAWED_PATHS: LifePathId[] = ['stoner', 'party_animal', 'alcoholic', 'doomer', 'degen', 'rebel'];

type ApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ApiReply = {
  reply?: string;
  error?: string;
};

export type CreatureMindRequestKind = 'reply' | 'self';

export interface LifePathMindOverlay {
  layer: 'curiosity' | 'leaning' | 'identity' | 'rejection';
  id?: string;
  title?: string;
  description?: string;
  gift?: string;
  cost?: string;
  note?: string;
  primary?: string;
  secondary?: string;
  phase?: string;
  doesNotWant?: string[];
}

export interface CreatureClockOverlay {
  phase: string;
  schedule: 'diurnal' | 'nocturnal';
  rest: boolean;
  sleeping: boolean;
}

export interface CreatureMindRequest {
  creature: {
    name: string;
    ageDays: number;
    stage: string;
    mood: string;
    language: string;
    clock?: CreatureClockOverlay;
  };
  messages: ApiMessage[];
  promptKind?: 'self';
  lifePath?: LifePathMindOverlay;
  influence?: ReturnType<typeof influenceProfile>;
  innerLife?: Record<string, unknown>;
  continuity?: Record<string, unknown>;
  creations?: Array<Record<string, string>>;
  presence?: Record<string, unknown>;
  care?: ReturnType<typeof careContext>;
  sharedLanguage?: string[];
  facts?: Array<{ kind: string; value: string }>;
  habits?: Array<Record<string, unknown>>;
  weather?: {
    condition: string;
    affinity?: 'likes' | 'dislikes';
    wantOut?: boolean;
    place?: 'outdoors';
  };
}

function compactFacts(state: GameState) {
  return [...state.conversation.facts]
    .sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)
    .slice(0, 10)
    .map(fact => ({ kind: fact.kind, value: fact.value.slice(0, 80) }));
}

function compactHabits(state: GameState) {
  return [...state.socialLearning.observations]
    .sort((a, b) => b.exposureCount - a.exposureCount || b.timestamp - a.timestamp)
    .slice(0, 7)
    .map(item => ({
      action: item.action.slice(0, 48),
      target: item.target.slice(0, 48),
      frequency: item.frequency,
      reward: Number(item.perceivedReward.toFixed(1)),
      harm: Number(item.perceivedNegativeOutcome.toFixed(1)),
    }));
}

function influenceProfile(state: GameState) {
  const ranked = FLAWED_PATHS
    .map(id => {
      const evidence = state.lifePath.evidence?.[id];
      const positive = (evidence?.creaturePreferences ?? 0) + (evidence?.creatureChoices ?? 0);
      const rejection = evidence?.creatureRejections ?? 0;
      const selfWeight = Math.min(1, positive / 6);
      const score = Math.max(0, (state.lifePath.scores[id] ?? 0) * selfWeight - rejection * 8);
      return { id, score, positive, rejection };
    })
    .sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const viceDrift = Math.max(0, Math.min(100, strongest.score));
  const susceptibility = Math.max(0, Math.min(100,
    18
    + state.personality.impulsiveness * 0.3
    + state.personality.sociability * 0.08
    + state.personality.confidence * 0.08
    + state.bond.score * 0.14
    + viceDrift * 0.2
    - state.personality.caution * 0.2
    - state.personality.stubbornness * 0.12,
  ));

  return {
    susceptibility: Math.round(susceptibility),
    viceDrift: Math.round(viceDrift),
    strongestTemptation: strongest.score >= 8 && strongest.positive >= 2 && strongest.positive - strongest.rejection * 2 > 0 ? strongest.id : null,
    strongestTemptationScore: Math.round(strongest.score),
    recovery: Math.round(state.lifePath.recovery),
  };
}

function toModelHistory(messages: ChatMessage[]): ApiMessage[] {
  return messages.slice(-MAX_CONTEXT_MESSAGES).map(message => ({
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: message.text.slice(0, 1200),
  }));
}

function careContext(state: GameState) {
  const hunger = state.needs.hunger < 24 ? 'very_hungry' : state.needs.hunger < 42 ? 'hungry' : state.needs.hunger > 82 ? 'full' : 'comfortable';
  const hygiene = state.needs.hygiene < 24 ? 'very_dirty' : state.needs.hygiene < 45 ? 'needs_washing' : 'clean';
  const bathroom = state.needs.bowel < 24 && state.needs.bladder < 30
    ? 'needs_both'
    : state.needs.bowel < 24
      ? 'needs_to_poop'
      : state.needs.bladder < 30
        ? 'needs_to_pee'
        : 'comfortable';
  return { hunger, hygiene, bathroom, roomMess: Math.min(6, state.roomMess.length) };
}

function careIsNeeded(care: ReturnType<typeof careContext>) {
  return care.hunger === 'hungry'
    || care.hunger === 'very_hungry'
    || care.hygiene !== 'clean'
    || care.bathroom !== 'comfortable'
    || care.roomMess > 0;
}

function pathLabel(id: LifePathId, language: 'en' | 'pl') {
  return language === 'pl' ? LIFE_PATHS[id].labelPl : LIFE_PATHS[id].label;
}

function buildPathOverlay(state: GameState): LifePathMindOverlay | undefined {
  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const path = migrateLifePathState(state.lifePath, state.personality);
  const rejected = LIFE_PATH_IDS.filter(id => {
    const evidence = path.evidence[id];
    const positives = (evidence.creaturePreferences ?? 0) + (evidence.creatureChoices ?? 0);
    return evidence.creatureRejections > 0 && positives - evidence.creatureRejections * 2 < 1;
  });

  if (path.primary && isStablePath(path.scores[path.primary], path.evidence[path.primary])) {
    const overlay: LifePathMindOverlay = {
      layer: 'identity',
      id: path.primary,
      title: getLifePathTitle(state, language),
      description: getLifePathDescription(state, language),
      primary: path.primary,
      phase: path.phase,
    };
    if (path.secondary && isStablePath(path.scores[path.secondary], path.evidence[path.secondary])) {
      overlay.secondary = path.secondary;
    }
    if (path.phase === 'committed' || path.phase === 'embodied') {
      overlay.cost = language === 'pl' ? LIFE_PATHS[path.primary].costPl : LIFE_PATHS[path.primary].cost;
    }
    if (rejected.length) overlay.doesNotWant = rejected.map(id => pathLabel(id, language));
    return overlay;
  }

  const leaning = LIFE_PATH_IDS
    .map(id => ({ id, score: path.scores[id], evidence: path.evidence[id] }))
    .filter(item => {
      const positives = item.evidence.creaturePreferences + item.evidence.creatureChoices;
      return positives > 0 || isVisibleDirection(item.score, item.evidence);
    })
    .sort((a, b) => b.score - a.score)[0];

  if (leaning && !rejected.includes(leaning.id)) {
    const overlay: LifePathMindOverlay = { layer: 'leaning', id: leaning.id };
    if (isVisibleDirection(leaning.score, leaning.evidence)) {
      overlay.gift = language === 'pl' ? LIFE_PATHS[leaning.id].giftPl : LIFE_PATHS[leaning.id].gift;
    }
    if (rejected.length) overlay.doesNotWant = rejected.map(id => pathLabel(id, language));
    return overlay;
  }

  if (rejected.length) {
    return { layer: 'rejection', doesNotWant: rejected.map(id => pathLabel(id, language)) };
  }

  const curious = LIFE_PATH_IDS
    .map(id => ({ id, evidence: path.evidence[id] }))
    .filter(item => item.evidence.creatureCuriosities > 0 && item.evidence.creaturePreferences + item.evidence.creatureChoices === 0)
    .sort((a, b) => b.evidence.creatureCuriosities - a.evidence.creatureCuriosities)[0];

  if (curious) {
    return {
      layer: 'curiosity',
      id: curious.id,
      note: language === 'pl' ? 'ciekawość, nie kostium' : 'curious, not a costume',
    };
  }

  return undefined;
}

function buildInfluenceOverlay(state: GameState) {
  const path = migrateLifePathState(state.lifePath, state.personality);
  const flawed = (id: LifePathId | null) => Boolean(
    id
    && FLAWED_PATHS.includes(id)
    && isStablePath(path.scores[id], path.evidence[id]),
  );
  if (!flawed(path.primary) && !flawed(path.secondary)) return undefined;
  const profile = influenceProfile(state);
  if (profile.viceDrift < 20 && !profile.strongestTemptation) return undefined;
  return profile;
}

function buildInnerLifeOverlay(state: GameState) {
  const interests = getRankedInterests(state, 5).map(item => ({
    topic: item.type,
    level: Math.round(item.level),
    polarity: Number((item.polarity ?? 0).toFixed(2)),
  }));
  const opinions = [...state.innerLife.opinions]
    .filter(item => item.confidence >= 12)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
    .map(item => ({
      topic: item.topic,
      stance: Number(item.stance.toFixed(2)),
      confidence: Math.round(item.confidence),
      reason: item.reason.slice(0, 140),
    }));
  const recentDreams = state.innerLife.dreams.slice(-2).map(item => ({
    title: item.title.slice(0, 60),
    fragment: item.fragment.slice(0, 220),
    mood: item.mood,
  }));
  const overlay: Record<string, unknown> = {};
  if (interests.length) overlay.interests = interests;
  if (opinions.length) overlay.opinions = opinions;
  if (recentDreams.length) overlay.recentDreams = recentDreams;
  if (state.innerLife.currentPreoccupation) overlay.preoccupation = state.innerLife.currentPreoccupation;
  if (state.innerLife.pendingDisclosure) overlay.pendingDisclosure = state.innerLife.pendingDisclosure;
  if (state.innerLife.selfAwareness.stage !== 'unaware') {
    overlay.selfAwareness = {
      stage: state.innerLife.selfAwareness.stage,
      reflection: state.innerLife.selfAwareness.lastReflection?.slice(0, 220) ?? '',
    };
  }
  return Object.keys(overlay).length ? overlay : undefined;
}

function buildContinuityOverlay(state: GameState) {
  const chapters = state.continuity.chapters.slice(-3).map(chapter => ({
    title: chapter.title.slice(0, 80),
    summary: chapter.summary.slice(0, 320),
    topics: chapter.topics.slice(0, 4),
  }));
  const openThreads = state.continuity.openLoops
    .filter(loop => !loop.resolvedAt)
    .slice(-3)
    .map(loop => ({ kind: loop.kind, subject: loop.subject.slice(0, 100), askCount: loop.askCount }));
  if (!chapters.length && !openThreads.length) return undefined;
  const overlay: Record<string, unknown> = {};
  if (chapters.length) overlay.chapters = chapters;
  if (openThreads.length) {
    overlay.openThreads = openThreads;
    overlay.unresolvedCount = state.continuity.openLoops.filter(loop => !loop.resolvedAt).length;
  }
  return overlay;
}

function weatherAffinity(state: GameState) {
  const current = state.world.current;
  const mode = state.world.settings.mode;
  if (!current || mode === 'disabled' || mode === 'unconfigured') return undefined;
  const preference = state.world.preferences[current.condition];
  if (!preference || preference.exposures < 2 || Math.abs(preference.affinity) < 3) return undefined;
  return preference.affinity > 0 ? 'likes' as const : 'dislikes' as const;
}

function creatureClock(state: GameState, now: number): CreatureClockOverlay {
  const time = getTimeOfDay(now, state.world);
  const schedule = getRestSchedule(state.lifePath);
  return {
    phase: time.phase,
    schedule,
    rest: isCreatureRestPhase(time, schedule),
    sleeping: state.sleepState === 'sleeping',
  };
}

function buildWeatherOverlay(state: GameState, now: number) {
  const current = state.world.current;
  const affinity = weatherAffinity(state);
  const clock = creatureClock(state, now);
  const wantOut = wantsOutdoors(state, clock.rest, clock.schedule === 'nocturnal');
  const outdoors = state.world.place === 'outdoors';
  if (!affinity && !wantOut && !outdoors) return undefined;
  const overlay: NonNullable<CreatureMindRequest['weather']> = {
    condition: current?.condition ?? 'unknown',
  };
  if (affinity) overlay.affinity = affinity;
  if (wantOut && !outdoors) overlay.wantOut = true;
  if (outdoors) overlay.place = 'outdoors';
  return overlay;
}

export function shouldCreatureSelfSpeak(state: GameState, now = Date.now()): boolean {
  if (state.sleepState === 'sleeping' || state.development.stage === 'egg') return false;
  const clock = creatureClock(state, now);
  if (clock.rest) return false;
  if (careIsNeeded(careContext(state))) return true;
  return Boolean(buildWeatherOverlay(state, now));
}

export function buildCreatureMindRequest(
  state: GameState,
  options: { kind?: CreatureMindRequestKind; now?: number } = {},
): CreatureMindRequest {
  const now = options.now ?? Date.now();
  const care = careContext(state);
  const facts = compactFacts(state);
  const habits = compactHabits(state);
  const sharedLanguage = getAdoptedSharedPhrases(state).slice(0, 4).map(phrase => phrase.text.slice(0, 48));
  const creations = state.creations.slice(-3).map(creation => ({
    stage: creation.stage,
    title: creation.title.slice(0, 80),
    description: creation.description.slice(0, 240),
    inspiration: creation.inspiration.slice(0, 48),
  }));
  const recentAbsences = state.presence.absenceEpisodes.slice(-2).map(episode => ({
    durationHours: Number((episode.durationMs / 3_600_000).toFixed(1)),
    summary: (getAbsenceSummary(state, episode) || '').slice(0, 180),
  })).filter(item => item.summary);

  const body: CreatureMindRequest = {
    creature: {
      name: (state.identity.name || 'the creature').slice(0, 40),
      ageDays: Number((Math.max(0, now - state.identity.birthTimestamp) / 86_400_000).toFixed(1)),
      stage: state.development.stage,
      mood: state.sleepState === 'sleeping'
        ? 'asleep'
        : state.sleepState === 'drowsy'
          ? 'sleepy'
          : state.emotionalState.slice(0, 32),
      language: state.conversation.language,
      clock: creatureClock(state, now),
    },
    messages: toModelHistory(state.conversation.messages),
  };

  if (options.kind === 'self') body.promptKind = 'self';
  const lifePath = buildPathOverlay(state);
  if (lifePath) body.lifePath = lifePath;
  const influence = buildInfluenceOverlay(state);
  if (influence) body.influence = influence;
  const innerLife = buildInnerLifeOverlay(state);
  if (innerLife) body.innerLife = innerLife;
  const continuity = buildContinuityOverlay(state);
  if (continuity) body.continuity = continuity;
  if (creations.length) body.creations = creations;
  if (recentAbsences.length) body.presence = { recentAbsences };
  if (careIsNeeded(care)) body.care = care;
  if (sharedLanguage.length) body.sharedLanguage = sharedLanguage;
  if (facts.length) body.facts = facts;
  if (habits.length) body.habits = habits;
  const weather = buildWeatherOverlay(state, now);
  if (weather) body.weather = weather;
  return body;
}

export function isLlmAvailable(): boolean {
  return API_URL.length > 0;
}

export async function requestCreatureReply(
  state: GameState,
  options: { kind?: CreatureMindRequestKind } = {},
): Promise<string> {
  if (!API_URL) throw new Error('The private AI endpoint is not configured.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const turnstileToken = await getTurnstileToken();
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Becoming-Client': getClientId(),
        ...(turnstileToken ? { 'CF-Turnstile-Response': turnstileToken } : {}),
      },
      body: JSON.stringify(buildCreatureMindRequest(state, options)),
      signal: controller.signal,
    });
    const result = await response.json() as ApiReply;
    if (!response.ok) throw new Error(result.error || `AI endpoint returned ${response.status}.`);
    const reply = result.reply?.trim() ?? '';
    if (options.kind === 'self') return reply.slice(0, 1200);
    if (!reply) throw new Error('The AI returned an empty reply.');
    return reply.slice(0, 1200);
  } finally {
    window.clearTimeout(timeout);
  }
}
