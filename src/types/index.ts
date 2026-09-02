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
  // Every need uses the same direction: 100 means settled, 0 means urgent.
  hunger: number;
  hydration: number;
  energy: number;
  bladder: number;
  bowel: number;
  hygiene: number;
  comfort: number;
  stimulation: number;
  social: number;
}

// Health follows the same hidden philosophy as needs: one qualitative
// lifecycle (healthy -> strained -> ill -> critical -> recovery or death)
// driven by sustained body state, never a visible meter. Wellness and illness
// are internal numbers; the UI and the mind only ever read qualitative stages.
export type HealthStage = 'healthy' | 'strained' | 'ill' | 'critical';
export type LifeStatus = 'alive' | 'dead';

export interface HealthState {
  status: LifeStatus;
  stage: HealthStage;
  // General vitality, 100 = strong. Reaches 0 only at the end of a sustained
  // critical state; wellness <= 0 is the single death rule (no random death).
  wellness: number;
  // Accumulated illness burden, 0-100. Builds only under severe sustained
  // pressure, persists over real time, and accelerates wellness loss.
  illness: number;
  // When the illness first crossed into an active state (null while healthy).
  illnessSince: number | null;
  lastUpdated: number;
  diedAt: number | null;
}

export type WeatherMode = 'unconfigured' | 'device' | 'city' | 'disabled';
export type WeatherPermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';
export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

export interface WeatherLocation {
  source: 'device' | 'city';
  name: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  countryCode: string | null;
  country: string | null;
}

export interface WeatherHourlyForecast {
  localTime: string;
  temperatureC: number;
  weatherCode: number;
  condition: WeatherCondition;
  precipitationProbability: number | null;
  windSpeedKph: number | null;
  windDirectionDeg: number | null;
}

export interface WeatherDailyForecast {
  date: string;
  sunrise: string;
  sunset: string;
  minC: number;
  maxC: number;
}

export interface WeatherSnapshot {
  locationKey: string;
  fetchedAt: number;
  observedAt: number;
  timezone: string;
  utcOffsetSeconds: number;
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationMm: number;
  precipitationProbability: number | null;
  weatherCode: number;
  condition: WeatherCondition;
  cloudCover: number;
  windSpeedKph: number;
  windDirectionDeg?: number | null;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  dailyDate: string;
  dailyMinC: number;
  dailyMaxC: number;
  // Two local calendar days are retained so a cached snapshot can cross local
  // midnight without accidentally showing the device's or UTC calendar day.
  hourlyForecast?: WeatherHourlyForecast[];
  dailyForecast?: WeatherDailyForecast[];
}

export type ThermalStimulus = 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

export interface EnvironmentalStimulus {
  condition: WeatherCondition;
  thermal: ThermalStimulus;
  intensity: number;
  precipitation: number;
  cloudiness: number;
  wind: number;
  temperatureStress: number;
  cozyPotential: number;
  novelty: number;
}

export interface WeatherPreference {
  affinity: number;
  exposures: number;
  positiveResponses: number;
  waryResponses: number;
  lastExperiencedAt: number;
}

export type WeatherErrorCode =
  | 'offline'
  | 'permission_denied'
  | 'location_unavailable'
  | 'weather_unavailable'
  | 'city_not_found';

export interface WorldEnvironment {
  settings: {
    mode: WeatherMode;
    onboardingSeen: boolean;
    permission: WeatherPermission;
    location: WeatherLocation | null;
  };
  current: WeatherSnapshot | null;
  stimulus: EnvironmentalStimulus;
  preferences: Record<WeatherCondition, WeatherPreference>;
  status: 'idle' | 'locating' | 'loading' | 'ready' | 'stale' | 'error' | 'disabled';
  lastAttemptAt: number;
  nextRefreshAt: number;
  lastError: WeatherErrorCode | null;
  lastReactionAt: number;
  recentReactionKeys: string[];
  place: 'indoor' | 'outdoors';
  lastOutdoorAt: number;
  outdoorUntil: number;
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

export interface LifePathEvidence {
  // What the player says is context about the player, never a creature choice.
  userMentions: number;
  // Curiosity may produce a question, but does not count as adoption.
  creatureCuriosities: number;
  // Explicit first-person likes and wants from the creature.
  creaturePreferences: number;
  // Actions and decisions made by the creature in the room or over time.
  creatureChoices: number;
  // Dislikes and refusals are durable counter-evidence.
  creatureRejections: number;
  firstPositiveAt: number | null;
  lastPositiveAt: number | null;
  lastNegativeAt: number | null;
}

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
  labelPl?: string;
  result: string;
  resultPl?: string;
  pathEffects: Partial<Record<LifePathId, number>>;
  recoveryEffect?: number;
  bondEffect?: number;
}

export interface DailyMoment {
  id: string;
  day: number;
  templateId?: string;
  title: string;
  titlePl?: string;
  prompt: string;
  promptPl?: string;
  choices: DailyMomentChoice[];
}

export interface LifePathState {
  scores: Record<LifePathId, number>;
  evidence: Record<LifePathId, LifePathEvidence>;
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
  recentDailyMomentTemplateIds: string[];
}

export interface DevelopmentState {
  chronologicalAge: number;    // in milliseconds since birth
  cognitiveLevel: number;      // 0-100
  languageLevel: number;       // 0-100
  emotionalLevel: number;      // 0-100
  independence: number;        // 0-100
  stage: DevelopmentStage;
  hatched: boolean;            // permanent — once true, never false
  experience: DevelopmentExperienceState;
}

export type MeaningfulFirstId =
  | 'first_word'
  | 'first_spontaneous_approach'
  | 'first_refusal'
  | 'first_favorite'
  | 'first_dream'
  | 'first_creation'
  | 'first_opinion'
  | 'first_shared_saying'
  | 'mirror_recognition'
  | 'first_autonomous_object';

export interface MeaningfulFirst {
  id: MeaningfulFirstId;
  timestamp: number;
  titleEn: string;
  titlePl: string;
  detailEn: string;
  detailPl: string;
  announced: boolean;
}

export type AutonomousMomentId =
  | 'listen'
  | 'watch_dust'
  | 'stretch'
  | 'sniff'
  | 'yawn'
  | 'seek_user'
  | 'cautious_probe'
  | 'bold_test'
  | 'independent_nearby'
  | 'steadfast_rest'
  | 'favorite_return'
  | 'mirror_check'
  | 'imitate_user'
  | 'rehearse_word'
  | 'continue_creation';

export interface AutonomousMomentRecord {
  id: AutonomousMomentId;
  timestamp: number;
  objectType?: ObjectType;
}

export interface DevelopmentExperienceState {
  firsts: MeaningfulFirst[];
  recentAutonomy: AutonomousMomentRecord[];
  lastAutonomousAt: number;
  preferredRestSpot: { x: number; y: number };
  favoriteObject: ObjectType | null;
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
  | 'hesitating'
  | 'walking'
  | 'investigating'
  | 'eating'
  | 'playing'
  | 'settling'
  | 'imitating'
  | 'proud'
  | 'uncomfortable'
  | 'toileting'
  | 'washing'
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

export type RoomMessType = 'pee' | 'poop';

export interface RoomMess {
  id: string;
  type: RoomMessType;
  x: number;
  y: number;
  createdAt: number;
}

export type ObjectType =
  | 'food_bowl'
  | 'water_bowl'
  | 'litter_box'
  | 'wash_basin'
  | 'apple'
  | 'broccoli'
  | 'ball'
  | 'blanket'
  | 'cushion'
  | 'brush'
  | 'jingle_toy'
  | 'paper'
  | 'pencil'
  | 'box'
  | 'stone'
  | 'mirror';

export type SemanticWorldActionType =
  | 'toilet'
  | 'drink'
  | 'eat'
  | 'wash'
  | 'sleep'
  | 'wake'
  | 'go_outside'
  | 'come_inside'
  | 'come_here'
  | 'use_object';

export interface SemanticWorldAction {
  type: SemanticWorldActionType;
  target?: 'pee' | 'poop' | 'current_need' | ObjectType;
}

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
  source?: 'conversation' | 'object' | 'dream' | 'born' | 'creature';
  polarity?: number;
  evidence?: InterestEvidence;
}

export interface InterestEvidence {
  userMentions: number;
  creatureCuriosities: number;
  creaturePreferences: number;
  creatureChoices: number;
  creatureRejections: number;
  firstPositiveAt: number | null;
  lastPositiveAt: number | null;
  lastNegativeAt: number | null;
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

export interface PresenceState {
  firstOpenedAt: number;
  lastOpenedAt: number;
  sessionCount: number;
  returnCount: number;
  currentStreak: number;
  longestStreak: number;
  lastVisitDay: string;
  pendingGreeting: string | null;
  pendingTrace: ReturnTrace | null;
  absenceEpisodes: AbsenceEpisode[];
}

export type ReturnTraceKind =
  | 'moved_object'
  | 'used_object'
  | 'rested'
  | 'continued_creation'
  | 'mirror_visit';

export interface ReturnTrace {
  id: string;
  kind: ReturnTraceKind;
  timestamp: number;
  objectId?: string;
  objectType?: ObjectType;
  captionEn: string;
  captionPl: string;
}

export interface AbsenceEpisode {
  id: string;
  leftAt: number;
  returnedAt: number;
  durationMs: number;
  activityTypes: string[];
  trace?: ReturnTrace;
}

export interface TouchBoundaryState {
  windowStartedAt: number;
  touchesInWindow: number;
  overwhelmedUntil: number;
  lastBoundaryAt: number;
  boundariesShown: number;
}

export interface SharedPhrase {
  id: string;
  text: string;
  normalized: string;
  exposures: number;
  firstSeenAt: number;
  lastSeenAt: number;
  adoptedAt: number | null;
}

export interface SharedLanguageState {
  phrases: SharedPhrase[];
}

export type CreationStage =
  | 'mark'
  | 'shape'
  | 'picture'
  | 'message'
  | 'hideaway'
  | 'den'
  | 'keepsake'
  | 'shared_game';

export interface CreatureCreation {
  id: string;
  stage: CreationStage;
  title: string;
  description: string;
  glyph: string;
  inspiration: string;
  createdAt: number;
}

// === END CONVERSATION / GROWING MIND TYPES ===

export interface GameState {
  identity: CreatureIdentity;
  needs: Needs;
  health: HealthState;
  world: WorldEnvironment;
  personality: PersonalityTraits;
  lifePath: LifePathState;
  development: DevelopmentState;
  memories: Memory[];
  vocabulary: VocabularyEntry[];
  relationship: RelationshipModel;
  bond: BondState;
  roomObjects: RoomObject[];
  roomMess: RoomMess[];
  inventory: ObjectType[];
  objectPreferences: Record<ObjectType, ObjectPreference>;
  interests: Interest[];
  innerLife: InnerLifeState;
  // Social learning state
  socialLearning: SocialLearningState;
  // Persistent conversations and facts learned directly from the user
  conversation: ConversationState;
  continuity: ContinuityState;
  presence: PresenceState;
  creations: CreatureCreation[];
  touchBoundaries: TouchBoundaryState;
  sharedLanguage: SharedLanguageState;
  lastSaved: number;
  // Kept separately from lastSaved so debounced persistence never loses or
  // double-counts elapsed need time.
  needsUpdatedAt: number;
  currentActivity: string | null;
  emotionalState: string;
  sleepState: 'awake' | 'drowsy' | 'sleeping';
  sleepStartTimestamp?: number;
  position: { x: number; y: number };
  facing: 'left' | 'right';
  creatureBehavior: CreatureBehavior;
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
