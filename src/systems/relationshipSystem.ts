import {
  BondEventType,
  BondStage,
  BondState,
  CreatureBehavior,
  GameState,
  Needs,
  ObjectPreference,
  ObjectReactionOutcome,
  ObjectType,
  PersonalityTraits,
  RelationshipModel,
} from '../types';

export const ALL_OBJECT_TYPES: ObjectType[] = [
  'food_bowl',
  'apple',
  'broccoli',
  'ball',
  'blanket',
  'paper',
  'pencil',
  'box',
  'stone',
  'mirror',
];

export interface ObjectReaction {
  id: string;
  outcome: ObjectReactionOutcome;
  icon: string;
  label: string;
  activity: string;
  emotion: string;
  behavior: CreatureBehavior;
  duration: number;
  consumes?: boolean;
  objectStatus: string;
  secondaryObjectType?: ObjectType;
  secondaryStatus?: string;
  moveObjectBy?: number;
  needDelta: Partial<Needs>;
  developmentGain: number;
  bondEvent: BondEventType;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function seededWobble(seed: number, index: number) {
  const raw = Math.sin(seed * 0.0001 + index * 91.73) * 10000;
  return ((raw - Math.floor(raw)) * 2 - 1) * 8;
}

function startingAffinity(type: ObjectType, personality: PersonalityTraits, seed: number) {
  const baseByType: Record<ObjectType, number> = {
    food_bowl: (personality.caution + personality.calmness - 100) * 0.12,
    apple: (personality.optimism + personality.affection - 100) * 0.16,
    broccoli: (personality.curiosity + personality.calmness - personality.stubbornness - 50) * 0.18,
    ball: (personality.impulsiveness + personality.curiosity + personality.confidence - 145) * 0.16,
    blanket: (personality.affection + personality.calmness - personality.independence - 35) * 0.16,
    paper: (personality.curiosity + personality.calmness - 90) * 0.18,
    pencil: (personality.curiosity + personality.confidence - 90) * 0.17,
    box: (personality.curiosity + personality.caution - 100) * 0.15,
    stone: (personality.calmness + personality.stubbornness - 100) * 0.14,
    mirror: (personality.curiosity + personality.confidence - personality.caution - 45) * 0.16,
  };
  return clamp(baseByType[type] + seededWobble(seed, ALL_OBJECT_TYPES.indexOf(type)), -30, 30);
}

export function createObjectPreferences(personality: PersonalityTraits, seed: number): Record<ObjectType, ObjectPreference> {
  return Object.fromEntries(ALL_OBJECT_TYPES.map(type => [type, {
    affinity: startingAffinity(type, personality, seed),
    interactions: 0,
    positiveExperiences: 0,
    refusals: 0,
    lastOutcome: null,
    lastReaction: null,
    lastInteracted: 0,
  }])) as Record<ObjectType, ObjectPreference>;
}

export function migrateObjectPreferences(
  existing: Partial<Record<ObjectType, ObjectPreference>> | undefined,
  personality: PersonalityTraits,
  seed: number,
): Record<ObjectType, ObjectPreference> {
  const defaults = createObjectPreferences(personality, seed);
  return Object.fromEntries(ALL_OBJECT_TYPES.map(type => {
    const saved = existing?.[type];
    return [type, saved ? { ...defaults[type], ...saved } : defaults[type]];
  })) as Record<ObjectType, ObjectPreference>;
}

export function getBondStage(score: number): BondStage {
  if (score >= 70) return 'bonded';
  if (score >= 45) return 'close';
  if (score >= 22) return 'familiar';
  return 'tentative';
}

export function createBondState(relationship?: RelationshipModel): BondState {
  const score = relationship
    ? relationship.trust * 0.35 + relationship.attachment * 0.4 + relationship.familiarity * 0.25
    : 10;
  return {
    stage: getBondStage(score),
    score,
    totalInteractions: 0,
    careActions: 0,
    playActions: 0,
    conversations: 0,
    lastInteraction: 0,
    history: [],
  };
}

export function migrateBondState(existing: BondState | undefined, relationship: RelationshipModel): BondState {
  const defaults = createBondState(relationship);
  if (!existing) return defaults;
  const score = Number.isFinite(existing.score) ? clamp(existing.score) : defaults.score;
  return {
    ...defaults,
    ...existing,
    score,
    stage: getBondStage(score),
    history: Array.isArray(existing.history) ? existing.history.slice(-30) : [],
  };
}

const eventEffects: Record<BondEventType, {
  trust: number;
  attachment: number;
  familiarity: number;
  traits: Partial<PersonalityTraits>;
}> = {
  tap: { trust: 0.15, attachment: 0.2, familiarity: 0.35, traits: { sociability: 0.08, caution: -0.04 } },
  stroke: { trust: 0.45, attachment: 0.7, familiarity: 0.35, traits: { affection: 0.28, calmness: 0.18 } },
  hold: { trust: 0.55, attachment: 0.85, familiarity: 0.4, traits: { affection: 0.34, confidence: 0.12, caution: -0.08 } },
  care: { trust: 0.7, attachment: 0.45, familiarity: 0.35, traits: { optimism: 0.16, affection: 0.12 } },
  play: { trust: 0.35, attachment: 0.35, familiarity: 0.65, traits: { curiosity: 0.2, confidence: 0.2, impulsiveness: 0.12 } },
  comfort: { trust: 0.55, attachment: 0.65, familiarity: 0.35, traits: { calmness: 0.3, affection: 0.18 } },
  discover: { trust: 0.15, attachment: 0.1, familiarity: 0.3, traits: { curiosity: 0.24, confidence: 0.08 } },
  conversation: { trust: 0.45, attachment: 0.35, familiarity: 0.7, traits: { sociability: 0.28, confidence: 0.12, curiosity: 0.08 } },
};

export function recordBondEvent(state: GameState, type: BondEventType): GameState {
  const effect = eventEffects[type];
  const relationship = {
    ...state.relationship,
    trust: clamp(state.relationship.trust + effect.trust),
    attachment: clamp(state.relationship.attachment + effect.attachment),
    familiarity: clamp(state.relationship.familiarity + effect.familiarity),
  };
  const score = relationship.trust * 0.35 + relationship.attachment * 0.4 + relationship.familiarity * 0.25;
  const previousStage = state.bond.stage;
  const stage = getBondStage(score);
  const personality = { ...state.personality };
  (Object.keys(effect.traits) as Array<keyof PersonalityTraits>).forEach(trait => {
    const delta = effect.traits[trait] ?? 0;
    const resistance = 0.45 + (100 - personality[trait]) / 180;
    personality[trait] = clamp(personality[trait] + delta * resistance);
  });

  const now = Date.now();
  const bond: BondState = {
    ...state.bond,
    stage,
    score,
    totalInteractions: state.bond.totalInteractions + 1,
    careActions: state.bond.careActions + (type === 'care' || type === 'comfort' ? 1 : 0),
    playActions: state.bond.playActions + (type === 'play' ? 1 : 0),
    conversations: state.bond.conversations + (type === 'conversation' ? 1 : 0),
    lastInteraction: now,
    history: [...state.bond.history, { type, timestamp: now }].slice(-30),
  };

  const stageMemory = stage !== previousStage
    ? [{
        id: `mem-bond-${stage}-${now}`,
        timestamp: now,
        content: stage === 'bonded'
          ? 'understood that the user is home'
          : stage === 'close'
            ? 'began seeking the user out'
            : 'started recognizing the user as familiar',
        importance: 8,
        emotionalValence: 0.8,
        tags: ['bond', stage],
        mentioned: false,
        understood: state.development.cognitiveLevel > 20,
        compressed: false,
      }]
    : [];

  return {
    ...state,
    personality,
    relationship,
    bond,
    memories: [...state.memories, ...stageMemory].slice(-200),
  };
}

function reactionFor(
  id: string,
  outcome: ObjectReactionOutcome,
  label: string,
  options: Partial<Omit<ObjectReaction, 'id' | 'outcome' | 'label'>> = {},
): ObjectReaction {
  return {
    id,
    outcome,
    icon: outcome === 'love' ? '♥' : outcome === 'enjoy' ? '✦' : outcome === 'avoid' ? '…' : '?',
    label,
    activity: label,
    emotion: outcome === 'love' || outcome === 'enjoy' ? 'happy' : outcome === 'avoid' ? 'uncertain' : 'curious',
    behavior: 'investigating',
    duration: 3300,
    objectStatus: 'inspected',
    needDelta: {},
    developmentGain: 0.55,
    bondEvent: 'discover',
    ...options,
  };
}

export function chooseObjectReaction(state: GameState, type: ObjectType): ObjectReaction {
  const preference = state.objectPreferences[type];
  const seen = preference.interactions;
  const affinity = preference.affinity;
  const { needs, personality } = state;

  if (type === 'apple' || type === 'broccoli') {
    const isFull = needs.hunger > 84;
    const dislikesBroccoli = type === 'broccoli' && affinity < -8 && personality.stubbornness > 45;
    if (isFull || (dislikesBroccoli && needs.hunger > 42)) {
      return reactionFor(`${type}-save`, 'avoid', `sniffs the ${type}, then saves it for later`, {
        icon: '…',
        emotion: 'uncertain',
        behavior: 'observing',
        duration: 2900,
        objectStatus: 'saved',
        developmentGain: 0.35,
        bondEvent: 'care',
      });
    }
    const favorite = affinity > 14 || (type === 'apple' && personality.optimism > 65);
    const label = seen >= 3 && favorite
      ? `recognizes the ${type} and eats it eagerly`
      : type === 'broccoli' && seen === 0
        ? 'takes one cautious green crunch'
        : `settles down to eat the ${type}`;
    return reactionFor(`${type}-${favorite ? 'favorite' : 'eat'}`, favorite ? 'love' : 'enjoy', label, {
      icon: favorite ? '♥' : '✦',
      behavior: 'eating',
      duration: 3400,
      consumes: true,
      objectStatus: 'eaten',
      developmentGain: 0.8,
      bondEvent: 'care',
    });
  }

  if (type === 'ball') {
    if (needs.energy < 28) {
      return reactionFor('ball-too-tired', 'neutral', 'watches the ball roll past', {
        icon: '~', behavior: 'observing', duration: 2700, objectStatus: 'watched', needDelta: { stimulation: 3 }, bondEvent: 'play',
      });
    }
    const delighted = affinity > 12 || needs.stimulation < 50 || personality.impulsiveness > 62;
    const labels = seen >= 4
      ? ['knows this game — and brings the ball back', 'feints left, then pounces on the ball']
      : ['pounces after the ball', 'chases the ball in a crooked circle'];
    return reactionFor(`ball-play-${seen >= 4 ? 'learned' : 'new'}`, delighted ? 'love' : 'enjoy', labels[seen % labels.length], {
      icon: '✦', behavior: 'playing', duration: 4000, objectStatus: 'played', moveObjectBy: 12,
      needDelta: { stimulation: delighted ? 30 : 20, comfort: 4, energy: -4 }, developmentGain: 0.85, bondEvent: 'play',
    });
  }

  if (type === 'blanket') {
    if (personality.independence > 74 && needs.comfort > 65 && seen < 2) {
      return reactionFor('blanket-not-now', 'neutral', 'pats the blanket, but stays nearby', {
        icon: '·', behavior: 'observing', duration: 2800, objectStatus: 'tested', needDelta: { comfort: 3 }, bondEvent: 'comfort',
      });
    }
    const needsRest = needs.energy < 48 || needs.comfort < 58;
    return reactionFor(`blanket-${needsRest ? 'nest' : 'knead'}`, needsRest ? 'love' : 'enjoy', needsRest
      ? 'circles twice and makes a small nest'
      : 'kneads the soft blanket with both paws', {
      icon: needsRest ? '♥' : '~', behavior: 'reacting', duration: 3900, objectStatus: 'nested',
      needDelta: { comfort: needsRest ? 26 : 16, energy: needsRest ? 8 : 3 }, developmentGain: 0.65, bondEvent: 'comfort',
    });
  }

  if (type === 'paper' || type === 'pencil') {
    const partner: ObjectType = type === 'paper' ? 'pencil' : 'paper';
    const hasPartner = state.roomObjects.some(object => object.type === partner);
    const mastery = state.objectPreferences.paper.interactions + state.objectPreferences.pencil.interactions;
    if (hasPartner && (seen > 0 || state.development.cognitiveLevel > 10)) {
      const makingMessage = mastery >= 11 && state.development.languageLevel >= 32;
      const makingPicture = mastery >= 7 && state.development.cognitiveLevel >= 28;
      const makingShape = mastery >= 3;
      const label = makingMessage
        ? 'writes something slowly, hiding it with one paw until the end'
        : makingPicture
          ? 'draws from memory, stopping often to look around the room'
          : makingShape
            ? 'connects the marks into a shape that seems intentional'
            : 'makes a crooked little mark — then stares at it';
      return reactionFor(`paper-${makingMessage ? 'message' : makingPicture ? 'picture' : makingShape ? 'shape' : 'first-mark'}`, 'love', label, {
        icon: makingMessage ? '♡' : '✦', behavior: 'reacting', duration: makingMessage ? 4800 : 4100,
        objectStatus: makingMessage ? 'written' : makingPicture || makingShape ? 'drawn' : 'scribbled', secondaryObjectType: partner,
        secondaryStatus: 'used', needDelta: { stimulation: 16, comfort: 3 }, developmentGain: 1.1, bondEvent: 'discover',
      });
    }
    return reactionFor(`${type}-inspect-${seen % 2}`, 'curious', type === 'paper'
      ? (seen === 0 ? 'tests the paper with one paw' : 'folds one corner, very carefully')
      : (seen === 0 ? 'follows the pencil with wide eyes' : 'rolls the pencil back and forth'), {
      behavior: 'investigating', objectStatus: type === 'paper' ? 'creased' : 'rolled', needDelta: { stimulation: 9 }, bondEvent: 'discover',
    });
  }

  if (type === 'box') {
    if (seen === 0 && personality.caution > 58) {
      return reactionFor('box-cautious', 'curious', 'peeks inside from a very safe distance', {
        icon: '?', behavior: 'observing', duration: 3200, objectStatus: 'opened', needDelta: { stimulation: 6 }, bondEvent: 'discover',
      });
    }
    return reactionFor(`box-${seen >= 2 ? 'hide' : 'peek'}`, affinity > 8 ? 'love' : 'enjoy', seen >= 2
      ? 'vanishes into the box, leaving only a tail outside'
      : 'climbs halfway into the box', {
      icon: seen >= 2 ? '♥' : '!', behavior: 'playing', duration: 3900, objectStatus: seen >= 2 ? 'hiding' : 'opened',
      needDelta: { stimulation: 13, comfort: 7 }, developmentGain: 0.75, bondEvent: 'play',
    });
  }

  if (type === 'mirror') {
    const selfStage = state.innerLife.selfAwareness.stage;
    if (selfStage === 'reflective') {
      return reactionFor('mirror-reflection', 'love', 'meets its own eyes and stays there, thinking', {
        icon: '◌', behavior: 'reacting', duration: 4600, objectStatus: 'reflected',
        needDelta: { stimulation: 9, comfort: 5 }, developmentGain: 1.1, bondEvent: 'discover',
      });
    }
    if (selfStage === 'recognized') {
      return reactionFor('mirror-recognized-self', 'love', 'checks one cheek, then smiles when the glass agrees', {
        icon: '✦', behavior: 'reacting', duration: 4300, objectStatus: 'recognized',
        needDelta: { stimulation: 12, comfort: 3 }, developmentGain: 1.2, bondEvent: 'discover',
      });
    }
    if (seen === 0) {
      return reactionFor('mirror-first', personality.confidence < 45 ? 'neutral' : 'curious', personality.confidence < 45
        ? 'startles at the creature in the glass'
        : 'leans closer when the reflection does', {
        icon: '!', behavior: 'observing', duration: 3600, objectStatus: 'noticed', needDelta: { stimulation: 7 }, bondEvent: 'discover',
      });
    }
    return reactionFor(`mirror-${seen >= 3 ? 'recognition' : 'copy'}`, seen >= 3 ? 'love' : 'curious', seen >= 3
      ? 'touches its own face, then the reflection'
      : 'tilts its head and waits for the other creature', {
      icon: seen >= 3 ? '✦' : '?', behavior: 'reacting', duration: 4200,
      objectStatus: seen >= 3 ? 'recognized' : 'studied', needDelta: { stimulation: 12 }, developmentGain: seen >= 3 ? 1.2 : 0.7, bondEvent: 'discover',
    });
  }

  if (type === 'stone') {
    const treasured = affinity > 10 || (personality.calmness + personality.stubbornness > 125 && seen > 1);
    return reactionFor(`stone-${treasured ? 'treasure' : 'inspect'}`, treasured ? 'love' : 'curious', treasured
      ? 'chooses a careful place for the favorite stone'
      : 'turns the stone over and checks underneath', {
      icon: treasured ? '♥' : '·', behavior: 'investigating', duration: 3400,
      objectStatus: treasured ? 'treasured' : 'inspected', needDelta: { stimulation: 5, comfort: treasured ? 6 : 1 }, bondEvent: 'discover',
    });
  }

  return reactionFor('bowl-check', 'neutral', 'checks the bowl for forgotten crumbs', {
    icon: '·', behavior: 'investigating', duration: 2600, objectStatus: 'checked', bondEvent: 'care',
  });
}

const preferenceDelta: Record<ObjectReactionOutcome, number> = {
  love: 5,
  enjoy: 3,
  curious: 1.5,
  neutral: 0.25,
  avoid: -2,
};

export function recordObjectExperience(
  state: GameState,
  type: ObjectType,
  reaction: ObjectReaction,
  connectToUser = true,
): GameState {
  const previous = state.objectPreferences[type];
  const preference: ObjectPreference = {
    ...previous,
    affinity: clamp(previous.affinity + preferenceDelta[reaction.outcome], -100, 100),
    interactions: previous.interactions + 1,
    positiveExperiences: previous.positiveExperiences + (reaction.outcome === 'love' || reaction.outcome === 'enjoy' ? 1 : 0),
    refusals: previous.refusals + (reaction.outcome === 'avoid' ? 1 : 0),
    lastOutcome: reaction.outcome,
    lastReaction: reaction.id,
    lastInteracted: Date.now(),
  };
  const withPreference = {
    ...state,
    objectPreferences: { ...state.objectPreferences, [type]: preference },
  };
  return connectToUser ? recordBondEvent(withPreference, reaction.bondEvent) : withPreference;
}

const traitLabels: Record<keyof PersonalityTraits, string> = {
  curiosity: 'curious',
  caution: 'careful',
  affection: 'affectionate',
  independence: 'independent',
  calmness: 'gentle',
  impulsiveness: 'playful',
  optimism: 'bright',
  stubbornness: 'determined',
  confidence: 'brave',
  sociability: 'social',
};

export function getEmergingTraitLabels(personality: PersonalityTraits, count = 2): string[] {
  return (Object.entries(personality) as Array<[keyof PersonalityTraits, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([trait]) => traitLabels[trait]);
}

export function getBondDescription(stage: BondStage, creatureName: string | null) {
  const name = creatureName || 'The creature';
  const descriptions: Record<BondStage, string> = {
    tentative: `${name} is still learning the shape of your presence.`,
    familiar: `${name} recognizes your routines and relaxes when you return.`,
    close: `${name} seeks you out and expects you to understand.`,
    bonded: `To ${name}, your presence feels like home.`,
  };
  return descriptions[stage];
}
