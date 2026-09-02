import { authoritativeNow } from './authoritativeTime';
import {
  AutonomousMomentId,
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
import { getRestSchedule } from './lifePathSystem';
import { getTimeOfDay, isCreatureRestPhase } from './timeSystem';

export const ALL_OBJECT_TYPES: ObjectType[] = [
  'food_bowl',
  'water_bowl',
  'litter_box',
  'wash_basin',
  'apple',
  'broccoli',
  'ball',
  'blanket',
  'cushion',
  'brush',
  'jingle_toy',
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
    water_bowl: (personality.calmness + personality.optimism - 100) * 0.08,
    litter_box: (personality.independence + personality.calmness - 100) * 0.08,
    wash_basin: (personality.calmness + personality.caution - personality.stubbornness - 40) * 0.1,
    apple: (personality.optimism + personality.affection - 100) * 0.16,
    broccoli: (personality.curiosity + personality.calmness - personality.stubbornness - 50) * 0.18,
    ball: (personality.impulsiveness + personality.curiosity + personality.confidence - 145) * 0.16,
    blanket: (personality.affection + personality.calmness - personality.independence - 35) * 0.16,
    cushion: (personality.affection + personality.calmness - personality.independence - 40) * 0.16,
    brush: (personality.affection + personality.calmness - personality.stubbornness - 45) * 0.15,
    jingle_toy: (personality.impulsiveness + personality.curiosity + personality.confidence - 150) * 0.16,
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

  const now = authoritativeNow();
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

  if (type === 'water_bowl') {
    const thirsty = needs.hydration < 72;
    return reactionFor(thirsty ? 'water-drink' : 'water-small-sip', thirsty ? 'love' : 'neutral', thirsty
      ? 'drinks slowly, then looks relieved'
      : 'takes one small sip', {
      icon: thirsty ? '◇' : '·', behavior: 'eating', duration: 3000, objectStatus: 'used',
      developmentGain: 0.35, bondEvent: 'care',
    });
  }

  if (type === 'litter_box') {
    const needsToilet = needs.bladder < 72 || needs.bowel < 72;
    return reactionFor(needsToilet ? 'litter-use' : 'litter-not-needed', needsToilet ? 'enjoy' : 'avoid', needsToilet
      ? 'uses the private corner, then carefully covers it'
      : 'checks the private corner, but does not need it yet', {
      icon: needsToilet ? '·' : '…', behavior: 'reacting', duration: 3200,
      objectStatus: needsToilet ? 'used' : 'checked', developmentGain: 0.3, bondEvent: 'care',
    });
  }

  if (type === 'wash_basin') {
    const needsWash = needs.hygiene < 76;
    return reactionFor(needsWash ? 'wash-clean' : 'wash-not-now', needsWash ? 'enjoy' : 'neutral', needsWash
      ? 'washes the smudges away, one paw at a time'
      : 'dabs one paw in the water and decides that is enough', {
      icon: needsWash ? '✦' : '·', behavior: 'reacting', duration: 3600,
      objectStatus: needsWash ? 'used' : 'tested', developmentGain: 0.4, bondEvent: 'care',
    });
  }

  if (type === 'apple' || type === 'broccoli') {
    const isFull = needs.hunger > 84;
    const dislikesFood = affinity < -10 && personality.stubbornness > 45;
    const cautiousFirstTaste = seen === 0
      && needs.hunger > 52
      && personality.caution > 62
      && state.bond.stage === 'tentative';
    const occupiedByOwnChoice = Boolean(state.currentActivity)
      && state.creatureBehavior !== 'idle'
      && state.creatureBehavior !== 'observing'
      && personality.independence > 62
      && needs.hunger > 48;
    const tooYoungAndUnsure = (state.development.stage === 'newborn' || state.development.stage === 'animal')
      && seen === 0
      && needs.hunger > 64
      && personality.caution > personality.curiosity;
    if (isFull || (dislikesFood && needs.hunger > 38) || cautiousFirstTaste || occupiedByOwnChoice || tooYoungAndUnsure) {
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
    if (needs.hydration < 25 || needs.hunger < 25 || needs.bladder < 25 || needs.bowel < 25) {
      return reactionFor('ball-care-first', 'avoid', 'starts toward the ball, then stops — something else needs attention first', {
        icon: '…', behavior: 'reacting', duration: 2800, objectStatus: 'watched', bondEvent: 'care',
      });
    }
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

  if (type === 'cushion') {
    if (needs.hunger < 25 || needs.hydration < 25 || needs.bladder < 25 || needs.bowel < 25) {
      return reactionFor('cushion-care-first', 'avoid', 'sinks toward the cushion, then stops — the body needs something else first', {
        icon: '…', behavior: 'reacting', duration: 2800, objectStatus: 'checked', bondEvent: 'care',
      });
    }
    const needsNest = needs.energy < 55 || needs.comfort < 62;
    return reactionFor(`cushion-${needsNest ? 'nest' : 'lean'}`, needsNest ? 'love' : 'enjoy', needsNest
      ? 'pulls the cushion into a small nest and sinks into it'
      : 'leans against the cushion and lets out a long breath', {
      icon: needsNest ? '♥' : '~', behavior: needsNest ? 'reacting' : 'settling', duration: 4000,
      objectStatus: needsNest ? 'nested' : 'rested', needDelta: { comfort: needsNest ? 28 : 18, energy: needsNest ? 10 : 4 }, developmentGain: 0.6, bondEvent: 'comfort',
    });
  }

  if (type === 'brush') {
    const needsGroom = needs.hygiene < 70;
    return reactionFor(`brush-${needsGroom ? 'groom' : 'tuft'}`, needsGroom ? 'enjoy' : 'neutral', needsGroom
      ? 'works the brush through its fur until it lies flat'
      : 'smoothes one small tuft and decides that is enough', {
      icon: needsGroom ? '✦' : '·', behavior: 'reacting', duration: 3400,
      objectStatus: needsGroom ? 'groomed' : 'tested', needDelta: { hygiene: needsGroom ? 26 : 6, comfort: needsGroom ? 8 : 4 }, developmentGain: 0.5, bondEvent: 'care',
    });
  }

  if (type === 'jingle_toy') {
    if (needs.hydration < 25 || needs.hunger < 25 || needs.bladder < 25 || needs.bowel < 25) {
      return reactionFor('jingle-care-first', 'avoid', 'reaches for the jingle toy, then stops — something else needs attention first', {
        icon: '…', behavior: 'reacting', duration: 2800, objectStatus: 'watched', bondEvent: 'care',
      });
    }
    if (needs.energy < 28) {
      return reactionFor('jingle-tired', 'neutral', 'watches the little bell glint without chasing it', {
        icon: '~', behavior: 'observing', duration: 2700, objectStatus: 'watched', needDelta: { stimulation: 3 }, bondEvent: 'play',
      });
    }
    const delighted = affinity > 12 || needs.stimulation < 50 || personality.impulsiveness > 62;
    return reactionFor(`jingle-play-${seen >= 4 ? 'learned' : 'new'}`, delighted ? 'love' : 'enjoy', seen >= 4
      ? 'knows the jingle and sends the bell rolling with a happy rattle'
      : 'pounces and makes the bell ring in a bright jingle', {
      icon: '✦', behavior: 'playing', duration: 4000, objectStatus: 'played', moveObjectBy: 10,
      needDelta: { stimulation: delighted ? 30 : 20, comfort: 4, energy: -4 }, developmentGain: 0.8, bondEvent: 'play',
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
    lastInteracted: authoritativeNow(),
  };
  const withPreference = {
    ...state,
    objectPreferences: { ...state.objectPreferences, [type]: preference },
  };
  return connectToUser ? recordBondEvent(withPreference, reaction.bondEvent) : withPreference;
}

const traitLabels: Record<keyof PersonalityTraits, { en: string; pl: string }> = {
  curiosity: { en: 'curious', pl: 'ciekawski' },
  caution: { en: 'careful', pl: 'ostrożny' },
  affection: { en: 'affectionate', pl: 'czuły' },
  independence: { en: 'independent', pl: 'niezależny' },
  calmness: { en: 'gentle', pl: 'łagodny' },
  impulsiveness: { en: 'playful', pl: 'spontaniczny' },
  optimism: { en: 'bright', pl: 'pogodny' },
  stubbornness: { en: 'determined', pl: 'uparty' },
  confidence: { en: 'brave', pl: 'odważny' },
  sociability: { en: 'social', pl: 'towarzyski' },
};

export function getEmergingTraitLabels(personality: PersonalityTraits, count = 2, language: 'en' | 'pl' = 'en'): string[] {
  return (Object.entries(personality) as Array<[keyof PersonalityTraits, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([trait]) => traitLabels[trait][language]);
}

export function getBondDescription(stage: BondStage, creatureName: string | null, language: 'en' | 'pl' = 'en') {
  const name = creatureName || (language === 'pl' ? 'Stworek' : 'The creature');
  if (language === 'pl') {
    const descriptions: Record<BondStage, string> = {
      tentative: `${name} wciąż uczy się kształtu twojej obecności.`,
      familiar: `${name} rozpoznaje twoje zwyczaje i uspokaja się, gdy wracasz.`,
      close: `${name} szuka cię i spodziewa się, że go zrozumiesz.`,
      bonded: `Dla ${name} twoja obecność przypomina dom.`,
    };
    return descriptions[stage];
  }
  const descriptions: Record<BondStage, string> = {
    tentative: `${name} is still learning the shape of your presence.`,
    familiar: `${name} recognizes your routines and relaxes when you return.`,
    close: `${name} seeks you out and expects you to understand.`,
    bonded: `To ${name}, your presence feels like home.`,
  };
  return descriptions[stage];
}

export interface VisiblePersonalitySignature {
  id: string;
  titleEn: string;
  titlePl: string;
  descriptionEn: string;
  descriptionPl: string;
}

export interface AutonomousChoice {
  id: AutonomousMomentId;
  labelEn: string;
  labelPl: string;
  behavior: CreatureBehavior;
  emotion: string;
  duration: number;
  action: 'ambient' | 'walk' | 'use_object';
  objectId?: string;
  objectType?: ObjectType;
  target?: { x: number; y: number };
  utterance?: string;
  rare?: boolean;
}

/** A combination, not a single dominant slider, shapes possible behaviour. */
function getTemperamentSignature(p: PersonalityTraits): VisiblePersonalitySignature {
  if (p.curiosity >= 55 && p.caution >= 55) {
    return {
      id: 'careful_explorer',
      titleEn: 'A careful explorer',
      titlePl: 'Ostrożny odkrywca',
      descriptionEn: 'Curiosity pulls it forward; caution makes every approach a small negotiation.',
      descriptionPl: 'Ciekawość ciągnie je naprzód, a ostrożność zmienia każde podejście w małą negocjację.',
    };
  }
  if (p.curiosity >= 55 && p.caution < 45 && (p.confidence >= 42 || p.impulsiveness >= 58)) {
    return {
      id: 'bold_tinkerer',
      titleEn: 'A bold tinkerer',
      titlePl: 'Śmiały eksperymentator',
      descriptionEn: 'It learns by touching first and deciding what it thinks afterward.',
      descriptionPl: 'Uczy się, najpierw dotykając, a dopiero potem decydując, co o tym myśli.',
    };
  }
  if (p.affection >= 58 && p.independence >= 55) {
    return {
      id: 'nearby_not_held',
      titleEn: 'Close on its own terms',
      titlePl: 'Blisko, ale po swojemu',
      descriptionEn: 'It chooses the same room and an easy line of sight without always choosing touch.',
      descriptionPl: 'Wybiera ten sam pokój i miejsce, z którego cię widzi, choć nie zawsze wybiera dotyk.',
    };
  }
  if (p.calmness >= 60 && p.stubbornness >= 52) {
    return {
      id: 'quietly_steadfast',
      titleEn: 'Quietly steadfast',
      titlePl: 'Cicho nieustępliwy',
      descriptionEn: 'It forms small rituals, returns to chosen places and rarely changes its mind quickly.',
      descriptionPl: 'Tworzy małe rytuały, wraca w wybrane miejsca i rzadko szybko zmienia zdanie.',
    };
  }
  if (p.sociability >= 62 && p.confidence >= 45) {
    return {
      id: 'social_initiator',
      titleEn: 'A social initiator',
      titlePl: 'Towarzyski inicjator',
      descriptionEn: 'It looks for a response and increasingly starts the first move itself.',
      descriptionPl: 'Szuka odpowiedzi i coraz częściej samo wykonuje pierwszy ruch.',
    };
  }
  if (p.impulsiveness >= 62 && p.optimism >= 58) {
    return {
      id: 'bright_impulse',
      titleEn: 'Bright impulse',
      titlePl: 'Jasny impuls',
      descriptionEn: 'Its attention changes quickly, but delight leaves a clear trace.',
      descriptionPl: 'Jego uwaga szybko się zmienia, ale zachwyt zostawia wyraźny ślad.',
    };
  }
  const strongest = getEmergingTraitLabels(p, 2, 'en').join(' and ');
  return {
    id: 'still_forming',
    titleEn: 'Still taking shape',
    titlePl: 'Wciąż nabiera kształtu',
    descriptionEn: `For now, ${strongest} tendencies are the easiest to notice.`,
    descriptionPl: 'Na razie najłatwiej zauważyć dwie powracające skłonności.',
  };
}

type SignatureState = Pick<GameState, 'personality'> & Partial<Pick<GameState, 'development' | 'objectPreferences'>>;

function repeatedSignatureEvidence(state: SignatureState, signatureId: string) {
  const autonomy = state.development?.experience?.recentAutonomy ?? [];
  const ids: Partial<Record<string, AutonomousMomentId[]>> = {
    careful_explorer: ['cautious_probe', 'mirror_check'],
    bold_tinkerer: ['bold_test'],
    nearby_not_held: ['independent_nearby', 'seek_user'],
    quietly_steadfast: ['steadfast_rest', 'favorite_return'],
    social_initiator: ['seek_user', 'imitate_user'],
    bright_impulse: ['bold_test', 'favorite_return', 'continue_creation'],
  };
  const matching = new Set(ids[signatureId] ?? []);
  let count = autonomy.filter(item => matching.has(item.id)).length;
  if (state.objectPreferences) {
    const preferences = Object.values(state.objectPreferences);
    if (signatureId === 'careful_explorer') count += preferences.reduce((total, item) => total + item.refusals, 0);
    if (signatureId === 'bold_tinkerer' || signatureId === 'bright_impulse') count += preferences.reduce((total, item) => total + item.positiveExperiences, 0);
  }
  return count;
}

/** A strong visible trait name needs repeated creature-owned behaviour. */
export function getVisiblePersonalitySignature(state: SignatureState): VisiblePersonalitySignature {
  const candidate = getTemperamentSignature(state.personality);
  if (candidate.id === 'still_forming' || repeatedSignatureEvidence(state, candidate.id) >= 3) return candidate;
  return {
    id: 'still_forming',
    titleEn: 'Still taking shape',
    titlePl: 'Wciąż nabiera kształtu',
    descriptionEn: 'Temperament appears in small reactions, but no pattern has repeated enough to name yet.',
    descriptionPl: 'Temperament widać w drobnych reakcjach, ale żaden wzorzec nie powtórzył się jeszcze dość razy, by go nazwać.',
  };
}

function deterministicUnit(seed: number, salt: number): number {
  const raw = Math.sin(seed * 0.00017 + salt * 19.913) * 10000;
  return raw - Math.floor(raw);
}

interface WeightedAutonomy extends AutonomousChoice {
  weight: number;
  cooldown: number;
}

/**
 * One state-aware selector replaces the previous uniform cute-moment roll.
 * It uses the existing Room heartbeat, so this adds no timer, render loop,
 * model call or persistence cadence.
 */
export function chooseAutonomousMoment(state: GameState, now = authoritativeNow()): AutonomousChoice | null {
  const p = state.personality;
  const signature = getTemperamentSignature(state.personality);
  const experience = state.development.experience;
  const favoriteType = experience?.favoriteObject;
  const favorite = favoriteType ? state.roomObjects.find(object => object.type === favoriteType) : undefined;
  const mirror = state.roomObjects.find(object => object.type === 'mirror');
  const paper = state.roomObjects.find(object => object.type === 'paper');
  const anyObject = [...state.roomObjects].sort((a, b) => {
    const aPreference = state.objectPreferences[a.type];
    const bPreference = state.objectPreferences[b.type];
    const aScore = (aPreference.interactions === 0 ? 18 : 0) + aPreference.affinity - Math.abs(a.x - state.position.x) * 0.15;
    const bScore = (bPreference.interactions === 0 ? 18 : 0) + bPreference.affinity - Math.abs(b.x - state.position.x) * 0.15;
    return bScore - aScore;
  })[0];
  const candidates: WeightedAutonomy[] = [
    { id: 'listen', labelEn: 'listens until the room answers', labelPl: 'słucha, aż pokój odpowie', behavior: 'observing', emotion: 'curious', duration: 2400, action: 'ambient', weight: 5 + p.calmness * 0.08, cooldown: 42_000 },
    { id: 'watch_dust', labelEn: 'follows one drifting speck', labelPl: 'śledzi jeden opadający pyłek', behavior: 'observing', emotion: 'curious', duration: 2600, action: 'ambient', weight: 4 + p.curiosity * 0.09, cooldown: 52_000 },
    { id: 'stretch', labelEn: 'stretches from nose to tail', labelPl: 'przeciąga się od nosa po ogon', behavior: 'reacting', emotion: 'neutral', duration: 2200, action: 'ambient', weight: 6 + state.needs.energy * 0.025, cooldown: 45_000 },
    { id: 'sniff', labelEn: 'tests the air for what changed', labelPl: 'sprawdza powietrze, szukając zmiany', behavior: 'investigating', emotion: 'curious', duration: 2300, action: 'ambient', weight: 4 + p.curiosity * 0.075, cooldown: 48_000 },
  ];

  if (state.needs.energy < 58) {
    candidates.push({ id: 'yawn', labelEn: 'lets a yawn rearrange its whole face', labelPl: 'ziewa tak, że zmienia mu się cała twarz', behavior: 'settling', emotion: 'neutral', duration: 2700, action: 'ambient', weight: 8 + (58 - state.needs.energy) * 0.22, cooldown: 65_000 });
  }
  if (state.needs.social < 62 || signature.id === 'social_initiator') {
    candidates.push({
      id: 'seek_user',
      labelEn: 'comes nearer without being called',
      labelPl: 'podchodzi bliżej bez wołania',
      behavior: 'settling',
      emotion: 'happy',
      duration: 2900,
      action: 'walk',
      target: { x: 50, y: Math.max(54, experience?.preferredRestSpot.y - 4 || 58) },
      weight: 4 + p.affection * 0.07 + (signature.id === 'social_initiator' ? 12 : 0),
      cooldown: 150_000,
      rare: true,
    });
  }
  if (signature.id === 'careful_explorer' && anyObject) {
    candidates.push({
      id: 'cautious_probe',
      labelEn: 'starts closer, pauses, then leans in',
      labelPl: 'podchodzi, zatrzymuje się i dopiero wtedy wychyla',
      behavior: 'hesitating',
      emotion: 'curious',
      duration: 3000,
      action: 'walk',
      objectId: anyObject.id,
      objectType: anyObject.type,
      target: { x: anyObject.x + (anyObject.x > 50 ? -15 : 15), y: anyObject.y },
      weight: 24,
      cooldown: 95_000,
    });
  }
  if (signature.id === 'careful_explorer' && !anyObject) {
    candidates.push({ id: 'cautious_probe', labelEn: 'takes one step, listens, then takes another', labelPl: 'robi krok, nasłuchuje i dopiero robi następny', behavior: 'hesitating', emotion: 'curious', duration: 2900, action: 'ambient', weight: 22, cooldown: 90_000 });
  }
  if (signature.id === 'bold_tinkerer' && anyObject) {
    candidates.push({
      id: 'bold_test',
      labelEn: 'tests a thing before waiting for permission',
      labelPl: 'sprawdza rzecz, zanim zdąży czekać na pozwolenie',
      behavior: 'investigating',
      emotion: 'curious',
      duration: 2800,
      action: 'use_object',
      objectId: anyObject.id,
      objectType: anyObject.type,
      weight: 20,
      cooldown: 125_000,
    });
  }
  if (signature.id === 'bold_tinkerer' && !anyObject) {
    candidates.push({ id: 'bold_test', labelEn: 'pats the floor just to see what happens', labelPl: 'klepie podłogę tylko po to, by zobaczyć, co się stanie', behavior: 'imitating', emotion: 'curious', duration: 2500, action: 'ambient', weight: 20, cooldown: 95_000 });
  }
  if (signature.id === 'nearby_not_held') {
    candidates.push({
      id: 'independent_nearby',
      labelEn: 'chooses a nearby place with room around it',
      labelPl: 'wybiera pobliskie miejsce, zostawiając sobie przestrzeń',
      behavior: 'settling',
      emotion: 'neutral',
      duration: 2800,
      action: 'walk',
      target: experience?.preferredRestSpot,
      weight: 19,
      cooldown: 110_000,
    });
  }
  if (signature.id === 'quietly_steadfast') {
    candidates.push({
      id: 'steadfast_rest',
      labelEn: 'returns to exactly the place it chose before',
      labelPl: 'wraca dokładnie w miejsce, które wybrało wcześniej',
      behavior: 'settling',
      emotion: 'neutral',
      duration: 2900,
      action: 'walk',
      target: experience?.preferredRestSpot,
      weight: 21,
      cooldown: 105_000,
    });
  }
  if (favorite && state.objectPreferences[favorite.type].interactions >= 2) {
    candidates.push({
      id: 'favorite_return',
      labelEn: 'returns to a favorite without being shown',
      labelPl: 'wraca do ulubionej rzeczy bez podpowiedzi',
      behavior: 'investigating',
      emotion: 'happy',
      duration: 3000,
      action: 'use_object',
      objectId: favorite.id,
      objectType: favorite.type,
      weight: 12 + state.objectPreferences[favorite.type].affinity * 0.25,
      cooldown: 180_000,
      rare: true,
    });
  }
  if (mirror && state.development.cognitiveLevel >= 12) {
    candidates.push({
      id: 'mirror_check',
      labelEn: 'checks whether the reflection still follows',
      labelPl: 'sprawdza, czy odbicie wciąż naśladuje',
      behavior: 'observing',
      emotion: 'curious',
      duration: 3200,
      action: 'use_object',
      objectId: mirror.id,
      objectType: mirror.type,
      weight: 6 + p.curiosity * 0.055,
      cooldown: 240_000,
      rare: true,
    });
  }
  if (state.socialLearning.imitated.length > 0 || state.conversation.totalUserMessages >= 3) {
    candidates.push({ id: 'imitate_user', labelEn: 'tries a gesture it has seen from you', labelPl: 'próbuje gestu, który widziało u ciebie', behavior: 'imitating', emotion: 'curious', duration: 3100, action: 'ambient', weight: 5 + p.sociability * 0.07, cooldown: 170_000, rare: true });
  }
  const learnedWord = state.vocabulary[Math.abs((state.identity.seed + state.vocabulary.length) % Math.max(1, state.vocabulary.length))];
  if (learnedWord) {
    candidates.push({ id: 'rehearse_word', labelEn: 'quietly rehearses a word', labelPl: 'po cichu ćwiczy słowo', behavior: 'proud', emotion: 'curious', duration: 2800, action: 'ambient', utterance: learnedWord.word, weight: 7 + state.development.languageLevel * 0.035, cooldown: 145_000, rare: true });
  }
  if (paper && state.roomObjects.some(object => object.type === 'pencil') && state.creations.length > 0) {
    candidates.push({
      id: 'continue_creation',
      labelEn: 'returns to an unfinished mark',
      labelPl: 'wraca do niedokończonego śladu',
      behavior: 'proud',
      emotion: 'happy',
      duration: 3200,
      action: 'use_object',
      objectId: paper.id,
      objectType: paper.type,
      weight: 5 + p.curiosity * 0.045 + state.development.cognitiveLevel * 0.035,
      cooldown: 300_000,
      rare: true,
    });
  }

  const recent = experience?.recentAutonomy ?? [];
  const rest = isCreatureRestPhase(getTimeOfDay(now, state.world), getRestSchedule(state.lifePath));
  const restQuiet = new Set(['listen', 'watch_dust', 'yawn', 'stretch', 'steadfast_rest', 'independent_nearby', 'sniff']);
  const eligible = candidates.map(candidate => {
    const previousIndex = [...recent].reverse().findIndex(record => record.id === candidate.id);
    const previous = previousIndex >= 0 ? [...recent].reverse()[previousIndex] : undefined;
    if (previous && now - previous.timestamp < candidate.cooldown) return { ...candidate, weight: 0 };
    const recencyFactor = previousIndex === 0 ? 0.08 : previousIndex === 1 ? 0.22 : previousIndex === 2 ? 0.48 : 1;
    let weight = candidate.weight * recencyFactor;
    if (rest) weight *= restQuiet.has(candidate.id) ? 2.4 : 0.07;
    else if (candidate.id === 'stretch' && state.needs.energy >= 65) weight *= 1.7;
    return { ...candidate, weight };
  }).filter(candidate => candidate.weight > 0);
  if (eligible.length === 0) return null;

  // A quiet-room option keeps autonomy legible and prevents constant performance.
  // During their rest, sitting still is the ordinary choice, not a failed roll.
  const quietWeight = (rest ? 38 : 20) + state.needs.energy * 0.05;
  const total = eligible.reduce((sum, candidate) => sum + candidate.weight, quietWeight);
  let roll = deterministicUnit(state.identity.seed, Math.floor(now / 7000) + recent.length * 13) * total;
  if (roll < quietWeight) return null;
  roll -= quietWeight;
  for (const candidate of eligible) {
    if (roll <= candidate.weight) {
      const { weight: _weight, cooldown: _cooldown, ...choice } = candidate;
      return choice;
    }
    roll -= candidate.weight;
  }
  const { weight: _weight, cooldown: _cooldown, ...fallback } = eligible[eligible.length - 1];
  return fallback;
}
