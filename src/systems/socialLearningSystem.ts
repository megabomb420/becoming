import { GameState, ObservedBehaviour, BehaviourType, ImitatedBehaviour, SocialLearningState, Memory } from '../types';

// === PARSING ===

interface BehaviourPattern {
  regex: RegExp;
  behaviourType: BehaviourType;
  extractAction: (match: RegExpMatchArray) => { action: string; target: string; context: string };
  detectEmotion: (text: string) => 'positive' | 'negative' | 'neutral' | 'mixed';
  detectReward: (text: string) => number;
  detectNegative: (text: string) => number;
}

const BEHAVIOUR_PATTERNS: BehaviourPattern[] = [
  {
    regex: /(?:drink|drank|had|consume)\s+(?:some\s+)?(coffee|tea|water|juice|soda|beer|wine|alcohol|weed|cannabis|pot)/i,
    behaviourType: 'consumption',
    extractAction: (m) => ({ action: 'drink', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|love|nice|enjoy|delicious/.test(t) ? 'positive' : /bad|hate|awful|terrible|regret/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /good|great|love|enjoy|tasty|delicious|relax|calm/.test(t) ? 0.6 : /bad|hate|awful|regret/.test(t) ? -0.3 : 0,
    detectNegative: (t) => /too much|hangover|sick|regret|bad|problem|trouble/.test(t) ? 0.7 : 0,
  },
  {
    regex: /(?:smoke|smoked|vape|vaped)\s+(?:some\s+)?(weed|cannabis|pot|cigarettes?|tobacco)/i,
    behaviourType: 'substance',
    extractAction: (m) => ({ action: 'smoke', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|love|relax|chill/.test(t) ? 'positive' : /bad|regret|stupid/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /relax|chill|good|enjoy/.test(t) ? 0.5 : /regret|bad/.test(t) ? -0.2 : 0.1,
    detectNegative: (t) => /regret|bad|problem|addict|waste|money/.test(t) ? 0.6 : 0.2,
  },
  {
    regex: /(?:got|was)\s+(drunk|high|wasted|buzzed|tipsy)/i,
    behaviourType: 'substance',
    extractAction: (m) => ({ action: 'get', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /fun|great|good|amazing/.test(t) ? 'positive' : /bad|regret|awful|sick/.test(t) ? 'negative' : 'mixed',
    detectReward: (t) => /fun|great|good/.test(t) ? 0.5 : /regret|bad/.test(t) ? -0.3 : 0,
    detectNegative: (t) => /sick|hangover|regret|trouble|problem/.test(t) ? 0.8 : 0.3,
  },
  {
    regex: /(?:went|go|doing|did)\s+(running|jogging|walking|swimming|cycling|hiking|yoga|gym|exercise|workout)/i,
    behaviourType: 'activity',
    extractAction: (m) => ({ action: 'do', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|love|feel better|energy/.test(t) ? 'positive' : /hate|tired|exhausted|forced/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /good|great|energy|better|strong|fit/.test(t) ? 0.7 : /tired|exhausted/.test(t) ? -0.2 : 0.3,
    detectNegative: (t) => /injur|pain|exhausted|too much/.test(t) ? 0.5 : 0,
  },
  {
    regex: /(?:read|reading)\s+(?:a\s+)?(book|comic|novel|magazine|article|paper|poem)/i,
    behaviourType: 'activity',
    extractAction: (m) => ({ action: 'read', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|love|enjoy|interesting/.test(t) ? 'positive' : /boring|hate/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /good|love|enjoy|interesting|learn/.test(t) ? 0.6 : 0.2,
    detectNegative: (t) => /boring|waste|time/.test(t) ? 0.3 : 0,
  },
  {
    regex: /(?:listen|listened|play|played)\s+(?:to\s+)?(music|song|album|playlist|guitar|piano|instrument)/i,
    behaviourType: 'activity',
    extractAction: (m) => ({ action: 'play', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|love|relax|calm/.test(t) ? 'positive' : 'neutral',
    detectReward: (t) => /good|love|relax|calm|happy/.test(t) ? 0.7 : 0.4,
    detectNegative: () => 0,
  },
  {
    regex: /(?:stayed\s+up|slept|sleep|woke\s+up|woke)\s+(?:until|at|for|only)?\s*([^.,]+)/i,
    behaviourType: 'habit',
    extractAction: (m) => ({ action: 'sleep', target: m[1].trim().toLowerCase(), context: '' }),
    detectEmotion: (t) => /tired|exhausted|bad|regret/.test(t) ? 'negative' : /good|rested|great/.test(t) ? 'positive' : 'neutral',
    detectReward: (t) => /good|rested|great/.test(t) ? 0.5 : /tired|exhausted/.test(t) ? -0.5 : 0,
    detectNegative: (t) => /tired|exhausted|late|missed/.test(t) ? 0.6 : 0,
  },
  {
    regex: /(?:skip|skipped|missed|avoid|avoided)\s+(work|class|school|meeting|duty)/i,
    behaviourType: 'work',
    extractAction: (m) => ({ action: 'skip', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|relief|relax/.test(t) ? 'positive' : /guilty|bad|regret|worried/.test(t) ? 'negative' : 'mixed',
    detectReward: (t) => /relax|rest|relief|good/.test(t) ? 0.5 : /guilty|regret/.test(t) ? -0.3 : 0.2,
    detectNegative: (t) => /guilty|trouble|fired|fail/.test(t) ? 0.7 : 0.2,
  },
  {
    regex: /(?:help|helped|assist|assisted)\s+(someone|a\s+friend|them|him|her)/i,
    behaviourType: 'social',
    extractAction: (m) => ({ action: 'help', target: 'someone', context: '' }),
    detectEmotion: (t) => /good|great|happy|feel good/.test(t) ? 'positive' : 'neutral',
    detectReward: (t) => /good|happy|feel good|proud/.test(t) ? 0.8 : 0.5,
    detectNegative: (t) => /used|taken|advantage/.test(t) ? 0.4 : 0,
  },
  {
    regex: /(?:hang|hung|spent\s+time)\s+(?:out\s+)?(?:with\s+)?(friends?|them|him|her|someone|people)/i,
    behaviourType: 'social',
    extractAction: (m) => ({ action: 'spend time with', target: m[1].toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|great|fun|love/.test(t) ? 'positive' : /bad|boring|annoying/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /fun|good|great|love/.test(t) ? 0.7 : 0.3,
    detectNegative: (t) => /bad|annoying|fight|argue/.test(t) ? 0.5 : 0,
  },
  {
    regex: /(?:lied|lie|lying)\s+(?:to\s+)?([^.,]+)/i,
    behaviourType: 'emotional',
    extractAction: (m) => ({ action: 'lie', target: m[1].trim().toLowerCase(), context: '' }),
    detectEmotion: (t) => /guilty|bad|regret/.test(t) ? 'negative' : /necessary|had to|protect/.test(t) ? 'mixed' : 'neutral',
    detectReward: (t) => /worked|avoid|escape|protect/.test(t) ? 0.3 : /caught|trouble/.test(t) ? -0.5 : 0,
    detectNegative: (t) => /guilty|regret|caught|trust/.test(t) ? 0.7 : 0.3,
  },
  {
    regex: /(?:apologise|apologized|apologise|sorry)/i,
    behaviourType: 'emotional',
    extractAction: () => ({ action: 'apologise', target: '', context: '' }),
    detectEmotion: (t) => /better|good|right|feel/.test(t) ? 'positive' : /awkward|hard|difficult/.test(t) ? 'mixed' : 'neutral',
    detectReward: (t) => /better|good|forgive|understand/.test(t) ? 0.6 : 0.2,
    detectNegative: (t) => /reject|ignored|worse/.test(t) ? 0.5 : 0,
  },
  {
    regex: /(?:gave|give|donate|donated|share|shared)\s+(?:\w+\s+)?(?:to\s+)?([^.,]+)/i,
    behaviourType: 'value',
    extractAction: (m) => ({ action: 'give', target: m[1].trim().toLowerCase(), context: '' }),
    detectEmotion: (t) => /good|happy|feel good|proud/.test(t) ? 'positive' : /regret|too much/.test(t) ? 'mixed' : 'neutral',
    detectReward: (t) => /good|happy|feel good|proud|grateful/.test(t) ? 0.7 : 0.3,
    detectNegative: (t) => /regret|too much|used/.test(t) ? 0.4 : 0,
  },
  {
    regex: /(?:clean|cleaned|tidy|tidied|organize|organized)\s+(?:up\s+)?(?:my\s+)?([^.,]*)/i,
    behaviourType: 'habit',
    extractAction: (m) => ({ action: 'clean', target: m[1].trim().toLowerCase() || 'room', context: '' }),
    detectEmotion: (t) => /good|better|satisfied|nice/.test(t) ? 'positive' : /hate|boring|forced/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /good|better|nice|satisfied/.test(t) ? 0.5 : /hate|boring/.test(t) ? -0.2 : 0.2,
    detectNegative: () => 0,
  },
  {
    regex: /(?:bought|buy|shopping|shopped|purchase|purchased)\s+(?:\w+\s+)?([^.,]+)/i,
    behaviourType: 'activity',
    extractAction: (m) => ({ action: 'buy', target: m[1].trim().toLowerCase(), context: '' }),
    detectEmotion: (t) => /happy|excited|love|nice/.test(t) ? 'positive' : /regret|too much|waste/.test(t) ? 'negative' : 'neutral',
    detectReward: (t) => /happy|excited|love|nice/.test(t) ? 0.6 : /regret|waste/.test(t) ? -0.3 : 0.2,
    detectNegative: (t) => /regret|debt|too much|waste/.test(t) ? 0.5 : 0,
  },
  {
    regex: /(?:procrastinate|procrastinated|put\s+off|delay|delayed|avoid|avoided)\s+(?:doing\s+)?([^.,]+)/i,
    behaviourType: 'work',
    extractAction: (m) => ({ action: 'avoid', target: m[1].trim().toLowerCase(), context: '' }),
    detectEmotion: (t) => /relief|relax|good/.test(t) ? 'positive' : /guilty|stress|anxious|bad/.test(t) ? 'negative' : 'mixed',
    detectReward: (t) => /relief|relax/.test(t) ? 0.4 : /guilty|stress/.test(t) ? -0.4 : 0,
    detectNegative: (t) => /stress|guilty|late|rush|fail/.test(t) ? 0.7 : 0.2,
  },
  {
    regex: /(?:risk|dangerous|reckless|dare|dared|try|tried)\s+(?:something\s+)?([^.,]*)/i,
    behaviourType: 'emotional',
    extractAction: (m) => ({ action: 'try', target: m[1].trim().toLowerCase() || 'something risky', context: '' }),
    detectEmotion: (t) => /exciting|thrill|fun|alive/.test(t) ? 'positive' : /scared|regret|stupid/.test(t) ? 'negative' : 'mixed',
    detectReward: (t) => /exciting|thrill|fun/.test(t) ? 0.6 : /regret|scared/.test(t) ? -0.3 : 0.2,
    detectNegative: (t) => /hurt|injur|danger|regret|stupid/.test(t) ? 0.7 : 0.3,
  },
];

function extractContext(text: string): string {
  const contexts: string[] = [];
  if (/morning|breakfast|AM/.test(text)) contexts.push('morning');
  if (/afternoon|lunch|noon/.test(text)) contexts.push('afternoon');
  if (/evening|dinner|night|PM|bed/.test(text)) contexts.push('evening');
  if (/weekend|saturday|sunday/.test(text)) contexts.push('weekend');
  if (/alone|by myself/.test(text)) contexts.push('alone');
  if (/with (friends?|someone|them|him|her|people)/.test(text)) contexts.push('with others');
  if (/before bed|before sleep/.test(text)) contexts.push('before bed');
  if (/after work|after class/.test(text)) contexts.push('after work');
  if (/every day|always|usually|every morning|every night/.test(text)) contexts.push('routine');
  if (/first time|never before|tried/.test(text)) contexts.push('first time');
  return contexts.join(', ');
}

export function parseUserStatement(text: string): Partial<ObservedBehaviour> | null {
  for (const pattern of BEHAVIOUR_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const extracted = pattern.extractAction(match);
      const context = extractContext(text);
      return {
        behaviourType: pattern.behaviourType,
        action: extracted.action,
        target: extracted.target,
        context: context || extracted.context,
        perceivedUserEmotion: pattern.detectEmotion(text),
        perceivedReward: pattern.detectReward(text),
        perceivedNegativeOutcome: pattern.detectNegative(text),
        confidence: 0.5,
        userExplanation: text,
      };
    }
  }
  return null;
}

export function findExistingObservation(state: GameState, action: string, target: string): ObservedBehaviour | undefined {
  return state.socialLearning.observations.find(
    obs => obs.action === action && obs.target === target
  );
}

export function updateFrequency(obs: ObservedBehaviour): ObservedBehaviour {
  const count = obs.exposureCount + 1;
  let frequency: ObservedBehaviour['frequency'] = 'once';
  if (count >= 10) frequency = 'always';
  else if (count >= 5) frequency = 'often';
  else if (count >= 2) frequency = 'sometimes';
  const newConfidence = Math.min(1, obs.confidence + 0.1);
  return { ...obs, exposureCount: count, frequency, confidence: newConfidence };
}

export function recordObservation(state: GameState, userText: string): GameState {
  const parsed = parseUserStatement(userText);
  if (!parsed) return state;

  const existing = findExistingObservation(state, parsed.action!, parsed.target!);
  let observations = [...state.socialLearning.observations];
  let memories = [...state.memories];
  let activeCuriosities = [...state.socialLearning.activeCuriosities];

  if (existing) {
    const updated = updateFrequency(existing);
    observations = observations.map(o => o.id === existing.id ? updated : o);
    if (existing.frequency !== updated.frequency) {
      const memory: Memory = {
        id: `mem-pattern-${Date.now()}`,
        timestamp: Date.now(),
        content: `user ${updated.frequency} ${updated.action}s ${updated.target}`,
        importance: 5,
        emotionalValence: updated.perceivedReward > 0 ? 0.3 : -0.1,
        tags: ['observation', 'pattern', updated.behaviourType!],
        mentioned: false,
        understood: state.development.cognitiveLevel > 30,
        compressed: false,
      };
      memories = [...memories, memory].slice(-200);
    }
  } else {
    const newObs: ObservedBehaviour = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      behaviourType: parsed.behaviourType!,
      action: parsed.action!,
      target: parsed.target!,
      context: parsed.context!,
      frequency: 'once',
      exposureCount: 1,
      timestamp: Date.now(),
      perceivedUserEmotion: parsed.perceivedUserEmotion!,
      perceivedReward: parsed.perceivedReward!,
      perceivedNegativeOutcome: parsed.perceivedNegativeOutcome!,
      confidence: parsed.confidence!,
      userExplanation: parsed.userExplanation!,
      mentioned: false,
      imitated: false,
      creatureOpinion: null,
      lastThoughtAbout: Date.now(),
    };
    observations = [...observations, newObs];
    const memory: Memory = {
      id: `mem-obs-${Date.now()}`,
      timestamp: Date.now(),
      content: `user ${newObs.action}ed ${newObs.target}`,
      importance: 3,
      emotionalValence: newObs.perceivedReward > 0 ? 0.2 : -0.1,
      tags: ['observation', 'first', newObs.behaviourType],
      mentioned: false,
      understood: state.development.cognitiveLevel > 20,
      compressed: false,
    };
    memories = [...memories, memory].slice(-200);
    if (state.personality.curiosity > 40 && state.development.cognitiveLevel > 15) {
      activeCuriosities = [...activeCuriosities, newObs.target].slice(-10);
    }
  }

  return {
    ...state,
    socialLearning: { ...state.socialLearning, observations, activeCuriosities },
    memories,
  };
}

// === IMITATION ===

export interface ImitationDecision {
  shouldImitate: boolean;
  reason: string;
  strength: number;
}

export function evaluateImitation(state: GameState, obs: ObservedBehaviour): ImitationDecision {
  const { personality, development, relationship } = state;
  let score = 0;
  const reasons: string[] = [];

  if (development.cognitiveLevel < 20) {
    return { shouldImitate: false, reason: 'too young to understand', strength: 0 };
  }
  if (relationship.attachment > 50) { score += 15; reasons.push('trusts user'); }
  if (relationship.trust > 40) { score += 10; reasons.push('feels safe'); }
  if (personality.curiosity > 60) { score += 20; reasons.push('curious'); }
  if (personality.caution > 60 && obs.perceivedNegativeOutcome > 0.4) { score -= 25; reasons.push('cautious about risks'); }
  if (personality.independence > 60 && obs.exposureCount < 3) { score -= 10; reasons.push('independent'); }
  if (personality.impulsiveness > 60) { score += 15; reasons.push('impulsive'); }
  score += obs.perceivedReward * 30;
  if (obs.perceivedReward > 0.3) reasons.push('seems good');
  score -= obs.perceivedNegativeOutcome * 25;
  if (obs.perceivedNegativeOutcome > 0.3) reasons.push('seems risky');
  const freqBonus = { once: 0, sometimes: 10, often: 20, always: 30 }[obs.frequency];
  score += freqBonus;
  if (obs.frequency !== 'once') reasons.push('user does this a lot');
  score += obs.confidence * 15;
  if (state.emotionalState === 'happy') score += 5;
  if (state.emotionalState === 'sad') score -= 5;
  if (obs.behaviourType === 'emotional' && development.cognitiveLevel < 40) { score -= 20; reasons.push('too complex'); }
  if (obs.behaviourType === 'value' && development.cognitiveLevel < 50) { score -= 15; reasons.push('does not understand values yet'); }

  const strength = Math.max(0, Math.min(100, score));
  const shouldImitate = strength > 55 && obs.exposureCount >= 2;
  return { shouldImitate, reason: reasons.length > 0 ? reasons.join(', ') : 'unsure', strength };
}

export function attemptImitation(state: GameState, obsId: string): GameState {
  const obs = state.socialLearning.observations.find(o => o.id === obsId);
  if (!obs || obs.imitated) return state;
  const decision = evaluateImitation(state, obs);
  if (!decision.shouldImitate) return state;

  const rand = Math.random();
  const likeThreshold = 0.3 + (obs.perceivedReward * 0.3) + (state.personality.optimism / 200);
  let opinion: ObservedBehaviour['creatureOpinion'] = 'neutral';
  if (rand < likeThreshold) opinion = 'liked';
  else if (rand > likeThreshold + 0.4) opinion = 'disliked';

  const updatedObs = { ...obs, imitated: true, creatureOpinion: opinion, lastThoughtAbout: Date.now() };
  const imitated: ImitatedBehaviour = {
    observedId: obs.id,
    action: obs.action,
    target: obs.target,
    adoptedAt: Date.now(),
    adherence: decision.strength,
    reason: decision.reason,
    rejected: opinion === 'disliked',
  };
  const memory: Memory = {
    id: `mem-imitate-${Date.now()}`,
    timestamp: Date.now(),
    content: opinion === 'liked'
      ? `tried ${obs.action}ing ${obs.target} like user, liked it`
      : opinion === 'disliked'
      ? `tried ${obs.action}ing ${obs.target}, did not like it`
      : `tried ${obs.action}ing ${obs.target}`,
    importance: 7,
    emotionalValence: opinion === 'liked' ? 0.6 : opinion === 'disliked' ? -0.3 : 0,
    tags: ['imitation', 'learning', obs.behaviourType],
    mentioned: false,
    understood: true,
    compressed: false,
  };

  return {
    ...state,
    socialLearning: {
      ...state.socialLearning,
      observations: state.socialLearning.observations.map(o => o.id === obsId ? updatedObs : o),
      imitated: [...state.socialLearning.imitated, imitated],
    },
    memories: [...state.memories, memory].slice(-200),
  };
}

// === LANGUAGE INTEGRATION ===

export interface SocialSpeechContext {
  topic?: string;
  aboutUser?: boolean;
  askingWhy?: boolean;
  expressingOpinion?: boolean;
}

export function generateSocialSpeech(state: GameState, ctx: SocialSpeechContext): string | null {
  const { socialLearning, development } = state;
  if (development.stage === 'egg' || development.stage === 'newborn') return null;

  const unmentioned = socialLearning.observations.filter(
    obs => !obs.mentioned && obs.exposureCount >= 2 && development.cognitiveLevel > 20
  );
  if (unmentioned.length === 0 && socialLearning.imitated.length === 0) return null;

  if (ctx.aboutUser && unmentioned.length > 0 && Math.random() < 0.3) {
    const obs = unmentioned[Math.floor(Math.random() * unmentioned.length)];
    const stage = development.stage;
    if (stage === 'animal' || stage === 'communicating') return `${obs.target}?`;
    if (stage === 'first_words') {
      const templates = [`you ${obs.action} ${obs.target}`, `${obs.target} you`, `why ${obs.action}?`];
      return templates[Math.floor(Math.random() * templates.length)];
    }
    if (stage === 'combining') {
      const templates = [
        `you always ${obs.action} ${obs.target}`,
        `why you ${obs.action} ${obs.target}?`,
        `${obs.target} again?`,
        `you like ${obs.target}?`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }
    const templates = [
      `you always ${obs.action} ${obs.target}`,
      `why do you ${obs.action} ${obs.target}?`,
      `you said ${obs.target} helps`,
      `I noticed you ${obs.action} ${obs.target}`,
      `is ${obs.target} good?`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  const activeImitations = socialLearning.imitated.filter(i => !i.rejected);
  if (ctx.expressingOpinion && activeImitations.length > 0 && Math.random() < 0.25) {
    const im = activeImitations[Math.floor(Math.random() * activeImitations.length)];
    const obs = socialLearning.observations.find(o => o.id === im.observedId);
    if (obs && development.stage !== 'animal' && development.stage !== 'communicating') {
      const templates = development.stage === 'first_words'
        ? [`I ${im.action} ${im.target}`, `me too`, `like you`]
        : development.stage === 'combining'
        ? [`I ${im.action} ${im.target} too`, `like you`, `you do it`, `I wanted to try`]
        : [`I ${im.action} ${im.target} now too`, `that's what you do`, `I wanted to know why you like it`, `but that's what you do`];
      return templates[Math.floor(Math.random() * templates.length)];
    }
  }

  const rejected = socialLearning.imitated.filter(i => i.rejected);
  if (ctx.expressingOpinion && rejected.length > 0 && Math.random() < 0.15) {
    const im = rejected[Math.floor(Math.random() * rejected.length)];
    if (development.stage === 'combining' || development.stage === 'sentences' || development.stage === 'mature') {
      const templates = development.stage === 'combining'
        ? [`no ${im.target}`, `don't like ${im.target}`, `not for me`]
        : [`I tried ${im.target} but I don't like it`, `not for me`, `you like it but I don't`];
      return templates[Math.floor(Math.random() * templates.length)];
    }
  }

  return null;
}

export function shouldSpeakSocially(state: GameState): boolean {
  if (state.development.cognitiveLevel < 20) return false;
  const hasObservations = state.socialLearning.observations.length > 0;
  const hasImitations = state.socialLearning.imitated.length > 0;
  if (!hasObservations && !hasImitations) return false;
  const baseChance = state.personality.sociability / 300;
  const curiosityBonus = state.personality.curiosity / 400;
  return Math.random() < (baseChance + curiosityBonus + 0.05);
}

export function markObservationMentioned(state: GameState, obsId: string): GameState {
  return {
    ...state,
    socialLearning: {
      ...state.socialLearning,
      observations: state.socialLearning.observations.map(o =>
        o.id === obsId ? { ...o, mentioned: true, lastThoughtAbout: Date.now() } : o
      ),
    },
  };
}

export function getRelevantObservations(state: GameState): ObservedBehaviour[] {
  return state.socialLearning.observations
    .filter(obs => obs.exposureCount >= 2)
    .sort((a, b) => b.exposureCount - a.exposureCount)
    .slice(0, 5);
}

// === CREATURE-INITIATED CONVERSATION ===

export interface InitiatedTopic {
  observationId: string;
  openingLine: string;
  topic: string;
  urgency: number;
}

export function shouldInitiateConversation(state: GameState): boolean {
  const { development, personality, socialLearning, sleepState, emotionalState } = state;

  if (sleepState === 'sleeping') return false;
  if (development.cognitiveLevel < 25) return false;
  if (development.stage === 'egg' || development.stage === 'newborn' || development.stage === 'animal') return false;

  const timeSinceLast = Date.now() - socialLearning.lastBehaviourQuestion;
  if (timeSinceLast < 5 * 60 * 1000) return false;

  const askableObs = socialLearning.observations.filter(
    obs => obs.exposureCount >= 2 && !obs.mentioned && !obs.imitated
  );
  if (askableObs.length === 0) return false;

  const curiosityFactor = personality.curiosity / 100;
  const attachmentFactor = state.relationship.attachment / 200;
  const sociabilityFactor = personality.sociability / 200;
  const emotionalFactor = emotionalState === 'happy' ? 0.1 : emotionalState === 'curious' ? 0.15 : 0;
  const chance = curiosityFactor * 0.4 + attachmentFactor * 0.3 + sociabilityFactor * 0.2 + emotionalFactor;
  const devFactor = development.cognitiveLevel / 200;

  return Math.random() < (chance * 0.15 + devFactor * 0.1);
}

export function generateInitiatedTopic(state: GameState): InitiatedTopic | null {
  const { socialLearning, development } = state;

  const askableObs = socialLearning.observations.filter(
    obs => obs.exposureCount >= 2 && !obs.mentioned && !obs.imitated
  );
  if (askableObs.length === 0) return null;

  const scored = askableObs.map(obs => ({
    obs,
    score: obs.exposureCount * 10 + (obs.perceivedReward > 0 ? 5 : 0) + (Date.now() - obs.timestamp) / 86400000,
  }));
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].obs;

  const stage = development.stage;
  let openingLine = '';

  if (stage === 'communicating') {
    openingLine = `${chosen.target}?`;
  } else if (stage === 'first_words') {
    const templates = [`you ${chosen.action} ${chosen.target}`, `${chosen.target}?`, `what ${chosen.target}?`];
    openingLine = templates[Math.floor(Math.random() * templates.length)];
  } else if (stage === 'combining') {
    const templates = [
      `why you ${chosen.action} ${chosen.target}?`,
      `you always ${chosen.action} ${chosen.target}`,
      `${chosen.target} what?`,
      `you like ${chosen.target}?`,
    ];
    openingLine = templates[Math.floor(Math.random() * templates.length)];
  } else {
    const templates = [
      `why do you ${chosen.action} ${chosen.target}?`,
      `I keep seeing you ${chosen.action} ${chosen.target}`,
      `what is ${chosen.target}?`,
      `you always ${chosen.action} ${chosen.target}. why?`,
      `I wanted to ask about ${chosen.target}`,
      `does ${chosen.target} help?`,
    ];
    openingLine = templates[Math.floor(Math.random() * templates.length)];
  }

  return {
    observationId: chosen.id,
    openingLine,
    topic: chosen.target,
    urgency: Math.min(1, chosen.exposureCount / 10 + state.personality.curiosity / 200),
  };
}

export function clearInitiatedTopic(state: GameState): GameState {
  return {
    ...state,
    socialLearning: {
      ...state.socialLearning,
      lastBehaviourQuestion: Date.now(),
    },
  };
}
