// Core types for Becoming

export interface CreatureIdentity {
  id: string;
  name: string | null;
  birthTimestamp: number;
  seed: number;
  appearance: CreatureAppearance;
}

export interface CreatureAppearance {
  baseHue: number;
  eyeSize: number;
  roundness: number;
  earShape: 'none' | 'small' | 'round' | 'pointy';
  tailLength: number;
  markings: string[];
}

export interface Needs {
  hunger: number;        // 0-100, hidden
  energy: number;        // 0-100, hidden
  comfort: number;       // 0-100, hidden
  stimulation: number;   // 0-100, hidden
  social: number;        // 0-100, hidden
}

export interface PersonalityTraits {
  curiosity: number;
  caution: number;
  affection: number;
  independence: number;
  calmness: number;
  impulsiveness: number;
  optimism: number;
  stubbornness: number;
  confidence: number;
  sociability: number;
}

export type LifePathId =
  | 'stoner'
  | 'party_animal'
  | 'alcoholic'
  | 'gymbro'
  | 'workaholic'
  | 'doomer'
  | 'degen'
  | 'gamer'
  | 'conspiracist'
  | 'caretaker'
  | 'monk'
  | 'rebel';

export type LifePathPhase = 'unformed' | 'leaning' | 'committed' | 'embodied' | 'recovering';

export interface LifePathMilestone {
  id: string;
  timestamp: number;
  title: string;
  detail: string;
  primary: LifePathId | null;
  secondary: LifePathId | null;
  phase: LifePathPhase;
}

export interface DailyMomentChoice {
  id: string;
  label: string;
  result: string;
  pathEffects: Partial<Record<LifePathId, number>>;
  recoveryEffect?: number;
  bondEffect?: number;
}

export interface DailyMoment {
  id: string;
  day: number;
  title: string;
  prompt: string;
  choices: DailyMomentChoice[];
}

export interface LifePathState {
  scores: Record<LifePathId, number>;
  primary: LifePathId | null;
  secondary: LifePathId | null;
  phase: LifePathPhase;
  crossbreed: string | null;
  recovery: number;
  stability: number;
  lastUpdated: number;
  history: LifePathMilestone[];
  lastDailyMomentDay: number;
  pendingMoment: DailyMoment | null;
  resolvedMomentIds: string[];
}

export interface DevelopmentState {
  chronologicalAge: number;    // in milliseconds since birth
  cognitiveLevel: number;      // 0-100
  languageLevel: number;       // 0-100
  emotionalLevel: number;      // 0-100
  independence: number;        // 0-100
  stage: DevelopmentStage;
  hatched: boolean;            // permanent — once true, never false
}

export type DevelopmentStage =
  | 'egg'
  | 'newborn'
  | 'animal'
  | 'communicating'
  | 'first_words'
  | 'combining'
  | 'sentences'
  | 'mature';

export type CreatureBehavior =
  | 'idle'
  | 'observing'
  | 'walking'
  | 'investigating'
  | 'eating'
  | 'playing'
  | 'sleeping'
  | 'reacting';

export interface Memory {
  id: string;
  timestamp: number;
  content: string;
  importance: number;      // 0-10
  emotionalValence: number; // -1 to 1
  tags: string[];
  mentioned: boolean;
  understood: boolean;
  compressed: boolean;
}

export interface VocabularyEntry {
  word: string;
  learnedAt: number;
  confidence: number;      // 0-1
  contexts: string[];
  usageCount: number;
}

export interface RelationshipModel {
  trust: number;
  attachment: number;
  familiarity: number;
  inferredTraits: string[];
  routines: UserRoutine[];
}

export type BondStage = 'tentative' | 'familiar' | 'close' | 'bonded';

export type BondEventType =
  | 'tap'
  | 'stroke'
  | 'hold'
  | 'care'
  | 'play'
  | 'comfort'
  | 'discover'
  | 'conversation';

export interface BondEvent {
  type: BondEventType;
  timestamp: number;
}

export interface BondState {
  stage: BondStage;
  score: number;
  totalInteractions: number;
  careActions: number;
  playActions: number;
  conversations: number;
  lastInteraction: number;
  history: BondEvent[];
}

export interface UserRoutine {
  type: string;
  typicalHour: number;
  consistency: number;
  lastObserved: number;
}

export interface RoomObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  state: Record<string, unknown>;
  interactions: number;
  placedByUser: boolean;
  beingUsedByCreature: boolean;
}

export type ObjectType =
  | 'food_bowl'
  | 'apple'
  | 'broccoli'
  | 'ball'
  | 'blanket'
  | 'paper'
  | 'pencil'
  | 'box'
  | 'stone'
  | 'mirror';

export type ObjectReactionOutcome = 'love' | 'enjoy' | 'curious' | 'neutral' | 'avoid';

export interface ObjectPreference {
  affinity: number;
  interactions: number;
  positiveExperiences: number;
  refusals: number;
  lastOutcome: ObjectReactionOutcome | null;
  lastReaction: string | null;
  lastInteracted: number;
}

export interface Interest {
  type: string;
  level: number;
  discoveredAt: number;
  lastEngaged: number;
  exposures?: number;
  source?: 'conversation' | 'object' | 'dream' | 'born';
  polarity?: number;
}

export interface CreatureDream {
  id: string;
  timestamp: number;
  title: string;
  fragment: string;
  sourceMemoryIds: string[];
  mood: 'warm' | 'strange' | 'restless' | 'bright' | 'lonely';
  shared: boolean;
}

export interface CreatureOpinion {
  topic: string;
  stance: number; // -1 to 1; the user's view can nudge but not overwrite it
  confidence: number; // 0-100
  reason: string;
  formedAt: number;
  lastChanged: number;
  disclosed: boolean;
}

export interface PrivateThought {
  id: string;
  content: string;
  source: 'interest' | 'opinion' | 'dream' | 'bond';
  createdAt: number;
  revealedAt: number | null;
  minimumBond: BondStage;
}

export type SelfAwarenessStage = 'unaware' | 'other' | 'copying' | 'recognized' | 'reflective';

export interface SelfAwarenessState {
  stage: SelfAwarenessStage;
  mirrorEncounters: number;
  recognizedAt: number | null;
  lastReflection: string | null;
  lastMirrorAt: number;
}

export interface InnerLifeState {
  dreams: CreatureDream[];
  opinions: CreatureOpinion[];
  privateThoughts: PrivateThought[];
  currentPreoccupation: string | null;
  pendingDisclosure: string | null;
  selfAwareness: SelfAwarenessState;
  lastDreamAt: number;
  lastInnerShift: number;
}

// === SOCIAL LEARNING TYPES ===

export type BehaviourType =
  | 'consumption'      // eating, drinking, caffeine, alcohol, etc.
  | 'activity'         // exercise, reading, music, hobbies
  | 'social'           // interacting with others, generosity, conflict
  | 'habit'            // routines, sleep habits, cleaning
  | 'work'             // work habits, procrastination, skipping
  | 'emotional'        // apologising, lying, avoidance, risk-taking
  | 'substance'        // drugs, alcohol, caffeine, cannabis
  | 'language'         // swearing, humour, communication style
  | 'value'            // kindness, honesty, generosity as values
  | 'other';

export interface ObservedBehaviour {
  id: string;
  behaviourType: BehaviourType;
  // What the user does: "drink coffee", "go running", "skip work"
  action: string;
  // The thing being acted upon (if any): "coffee", "running", "work"
  target: string;
  // Broader context: "morning", "with friends", "before bed"
  context: string;
  // How often has this been observed: "once", "sometimes", "always"
  frequency: 'once' | 'sometimes' | 'often' | 'always';
  // Number of times observed
  exposureCount: number;
  timestamp: number;
  // What emotion did the user seem to express about this?
  perceivedUserEmotion: 'positive' | 'negative' | 'neutral' | 'mixed';
  // Did the user seem to get something good from this?
  perceivedReward: number; // -1 to 1
  // Did the user mention bad consequences?
  perceivedNegativeOutcome: number; // 0 to 1
  // How sure is the creature about this observation?
  confidence: number; // 0 to 1
  // What the user said (stored verbatim for early stages)
  userExplanation: string;
  // Has the creature mentioned this observation?
  mentioned: boolean;
  // Has the creature tried to imitate this?
  imitated: boolean;
  // Creature's own opinion after trying (if tried)
  creatureOpinion: 'liked' | 'disliked' | 'neutral' | null;
  // When did the creature last think about this?
  lastThoughtAbout: number;
}

export interface ImitatedBehaviour {
  observedId: string;
  action: string;
  target: string;
  adoptedAt: number;
  // How strongly the creature follows this habit (0-100)
  adherence: number;
  // Why did the creature adopt it?
  reason: string;
  // Has the creature rejected it since?
  rejected: boolean;
}

export interface SocialLearningState {
  // All behaviours the creature has observed
  observations: ObservedBehaviour[];
  // Behaviours the creature has actively adopted
  imitated: ImitatedBehaviour[];
  // Topics the creature is currently curious about
  activeCuriosities: string[];
  // Has the creature noticed the user is a "pattern"?
  noticedUserConsistency: boolean;
  // Last time creature initiated a question about user behaviour
  lastBehaviourQuestion: number;
}

// === END SOCIAL LEARNING TYPES ===

// === CONVERSATION / GROWING MIND TYPES ===

export type ConversationLanguage = 'unknown' | 'en' | 'pl';

export type UserFactKind =
  | 'name'
  | 'like'
  | 'dislike'
  | 'feeling'
  | 'goal'
  | 'place'
  | 'work'
  | 'other';

export interface LearnedUserFact {
  id: string;
  kind: UserFactKind;
  value: string;
  normalizedValue: string;
  sentiment: number; // -1 to 1
  confidence: number; // 0 to 1
  mentions: number;
  learnedAt: number;
  lastMentioned: number;
}

export interface ConversationState {
  messages: ChatMessage[];
  facts: LearnedUserFact[];
  totalUserMessages: number;
  totalCreatureMessages: number;
  language: ConversationLanguage;
  lastConversationAt: number;
  lastCreatureMessage: string | null;
}

export interface ConversationChapter {
  id: string;
  index: number;
  title: string;
  summary: string;
  topics: string[];
  factIds: string[];
  startedAt: number;
  endedAt: number;
}

export interface OpenConversationLoop {
  id: string;
  kind: 'goal' | 'feeling' | 'promise' | 'story';
  subject: string;
  createdAt: number;
  dueAt: number;
  lastAskedAt: number;
  askCount: number;
  resolvedAt: number | null;
}

export interface ContinuityState {
  chapters: ConversationChapter[];
  openLoops: OpenConversationLoop[];
  lastChapterMessageCount: number;
  lastCompressedAt: number;
}

// === END CONVERSATION / GROWING MIND TYPES ===

export interface GameState {
  identity: CreatureIdentity;
  needs: Needs;
  personality: PersonalityTraits;
  lifePath: LifePathState;
  development: DevelopmentState;
  memories: Memory[];
  vocabulary: VocabularyEntry[];
  relationship: RelationshipModel;
  bond: BondState;
  roomObjects: RoomObject[];
  inventory: ObjectType[];
  objectPreferences: Record<ObjectType, ObjectPreference>;
  interests: Interest[];
  innerLife: InnerLifeState;
  // Social learning state
  socialLearning: SocialLearningState;
  // Persistent conversations and facts learned directly from the user
  conversation: ConversationState;
  continuity: ContinuityState;
  lastSaved: number;
  currentActivity: string | null;
  emotionalState: string;
  sleepState: 'awake' | 'drowsy' | 'sleeping';
  sleepStartTimestamp?: number;
  position: { x: number; y: number };
  facing: 'left' | 'right';
  creatureBehavior: CreatureBehavior;
}

export interface MemoryBookEntry {
  day: number;
  text: string;
  timestamp: number;
}

export interface OfflineActivity {
  type: string;
  duration: number;
  timestamp: number;
  result?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'creature';
  text: string;
  timestamp: number;
}
