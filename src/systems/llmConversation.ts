import { ChatMessage, GameState, LifePathId } from '../types';
import { getLifePathTitle, getRankedLifePaths } from './lifePathSystem';
import { getRankedInterests } from './innerLifeSystem';
import { getAbsenceSummary } from './presenceSystem';
import { getAdoptedSharedPhrases } from './sharedLanguageSystem';

const API_URL = (import.meta.env.VITE_BECOMING_API_URL || '').replace(/\/$/, '');
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

function strongestTraits(state: GameState) {
  return Object.entries(state.personality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([trait, value]) => ({ trait, value: Math.round(value) }));
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
    .map(id => ({ id, score: state.lifePath.scores[id] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const rewardedRiskExposure = state.socialLearning.observations.reduce((total, item) => {
    if (!['substance', 'habit', 'language'].includes(item.behaviourType)) return total;
    const reward = Math.max(0, item.perceivedReward);
    return total + Math.min(8, item.exposureCount) * reward;
  }, 0);
  const viceDrift = Math.max(0, Math.min(100, strongest.score + rewardedRiskExposure * 1.8));
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
    strongestTemptation: strongest.score >= 8 ? strongest.id : null,
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

function requestBody(state: GameState) {
  return {
    creature: {
      name: (state.identity.name || 'the creature').slice(0, 40),
      ageDays: Number((Math.max(0, Date.now() - state.identity.birthTimestamp) / 86_400_000).toFixed(1)),
      stage: state.development.stage,
      cognitiveLevel: Math.round(state.development.cognitiveLevel),
      languageLevel: Math.round(state.development.languageLevel),
      emotionalLevel: Math.round(state.development.emotionalLevel),
      mood: state.emotionalState.slice(0, 32),
      bondStage: state.bond.stage,
      bondScore: Math.round(state.bond.score),
      language: state.conversation.language,
      traits: strongestTraits(state),
    },
    lifePath: {
      title: getLifePathTitle(state),
      primary: state.lifePath.primary,
      secondary: state.lifePath.secondary,
      phase: state.lifePath.phase,
      recovery: Math.round(state.lifePath.recovery),
      tendencies: getRankedLifePaths(state, 4).map(path => ({ id: path.id, score: Math.round(path.score) })),
      recentTurns: state.lifePath.history.slice(-4).map(item => ({ title: item.title, detail: item.detail })),
    },
    influence: influenceProfile(state),
    innerLife: {
      interests: getRankedInterests(state, 5).map(item => ({ topic: item.type, level: Math.round(item.level), polarity: Number((item.polarity ?? 0).toFixed(2)) })),
      opinions: [...state.innerLife.opinions]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6)
        .map(item => ({ topic: item.topic, stance: Number(item.stance.toFixed(2)), confidence: Math.round(item.confidence), reason: item.reason.slice(0, 140) })),
      recentDreams: state.innerLife.dreams.slice(-2).map(item => ({ title: item.title.slice(0, 60), fragment: item.fragment.slice(0, 220), mood: item.mood })),
      preoccupation: state.innerLife.currentPreoccupation,
      pendingDisclosure: state.innerLife.pendingDisclosure,
      selfAwareness: {
        stage: state.innerLife.selfAwareness.stage,
        reflection: state.innerLife.selfAwareness.lastReflection?.slice(0, 220) ?? '',
      },
    },
    continuity: {
      chapters: state.continuity.chapters.slice(-3).map(chapter => ({ title: chapter.title.slice(0, 80), summary: chapter.summary.slice(0, 320), topics: chapter.topics.slice(0, 4) })),
      openThreads: state.continuity.openLoops.filter(loop => !loop.resolvedAt).slice(-3).map(loop => ({ kind: loop.kind, subject: loop.subject.slice(0, 100), askCount: loop.askCount })),
      unresolvedCount: state.continuity.openLoops.filter(loop => !loop.resolvedAt).length,
    },
    creations: state.creations.slice(-3).map(creation => ({
      stage: creation.stage,
      title: creation.title.slice(0, 80),
      description: creation.description.slice(0, 240),
      inspiration: creation.inspiration.slice(0, 48),
    })),
    presence: {
      returns: state.presence.returnCount,
      currentStreak: state.presence.currentStreak,
      recentAbsences: state.presence.absenceEpisodes.slice(-2).map(episode => ({
        durationHours: Number((episode.durationMs / 3_600_000).toFixed(1)),
        summary: (getAbsenceSummary(state, episode) || '').slice(0, 180),
      })),
    },
    sharedLanguage: getAdoptedSharedPhrases(state).slice(0, 4).map(phrase => phrase.text.slice(0, 48)),
    facts: compactFacts(state),
    habits: compactHabits(state),
    messages: toModelHistory(state.conversation.messages),
  };
}

export function isLlmAvailable(): boolean {
  return API_URL.length > 0;
}

export async function requestCreatureReply(state: GameState): Promise<string> {
  if (!API_URL) throw new Error('The private AI endpoint is not configured.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody(state)),
      signal: controller.signal,
    });
    const result = await response.json() as ApiReply;
    if (!response.ok) throw new Error(result.error || `AI endpoint returned ${response.status}.`);
    const reply = result.reply?.trim();
    if (!reply) throw new Error('The AI returned an empty reply.');
    return reply.slice(0, 1200);
  } finally {
    window.clearTimeout(timeout);
  }
}
