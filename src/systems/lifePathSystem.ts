import {
  DailyMoment,
  GameState,
  LifePathId,
  LifePathMilestone,
  LifePathPhase,
  LifePathState,
  ObjectReactionOutcome,
  ObjectType,
  ObservedBehaviour,
  PersonalityTraits,
} from '../types';
import { parseUserStatement } from './socialLearningSystem';

export const LIFE_PATH_IDS: LifePathId[] = [
  'stoner',
  'party_animal',
  'alcoholic',
  'gymbro',
  'workaholic',
  'doomer',
  'degen',
  'gamer',
  'conspiracist',
  'caretaker',
  'monk',
  'rebel',
];

export interface LifePathDefinition {
  label: string;
  description: string;
  gift: string;
  cost: string;
}

export const LIFE_PATHS: Record<LifePathId, LifePathDefinition> = {
  stoner: {
    label: 'Stoner',
    description: 'Slow, associative and strangely philosophical.',
    gift: 'sees odd connections and stays difficult to rattle',
    cost: 'drifts, forgets promises and avoids momentum',
  },
  party_animal: {
    label: 'Party Animal',
    description: 'Lives for noise, attention and the next story.',
    gift: 'turns empty rooms into events',
    cost: 'hates quiet and can mistake chaos for closeness',
  },
  alcoholic: {
    label: 'Alcoholic',
    description: 'Uses the next drink to postpone the last consequence.',
    gift: 'can be disarmingly open and socially fearless',
    cost: 'becomes unreliable, volatile and increasingly tired',
  },
  gymbro: {
    label: 'Gymbro',
    description: 'Treats existence like a programme that needs progressive overload.',
    gift: 'discipline, confidence and direct encouragement',
    cost: 'turns rest, softness and uncertainty into personal failures',
  },
  workaholic: {
    label: 'Workaholic',
    description: 'Measures worth in finished tasks and late nights.',
    gift: 'focuses hard and remembers unfinished business',
    cost: 'cannot stop performing long enough to feel alive',
  },
  doomer: {
    label: 'Doomer',
    description: 'Expects the worst and notices what optimism edits out.',
    gift: 'honesty, sensitivity and a sharp eye for false hope',
    cost: 'confuses prediction with fate and withdrawal with safety',
  },
  degen: {
    label: 'Degen',
    description: 'Believes the next reckless move will finally change everything.',
    gift: 'boldness, improvisation and appetite for possibility',
    cost: 'chases losses, hype and shortcuts',
  },
  gamer: {
    label: 'Gamer',
    description: 'Turns routines into quests and feelings into mechanics.',
    gift: 'persistence, systems thinking and playful focus',
    cost: 'can hide inside the game when real life has no clear objective',
  },
  conspiracist: {
    label: 'Conspiracist',
    description: 'Assumes every coincidence is a door someone forgot to lock.',
    gift: 'questions consensus and follows details others ignore',
    cost: 'builds certainty faster than evidence',
  },
  caretaker: {
    label: 'Caretaker',
    description: 'Feels useful when everyone else is held together.',
    gift: 'loyalty, patience and attention to small needs',
    cost: 'forgets that care without boundaries becomes self-erasure',
  },
  monk: {
    label: 'Monk',
    description: 'Practises distance from every impulse, sometimes too successfully.',
    gift: 'calm, reflection and the ability to begin again',
    cost: 'can turn peace into avoidance and wisdom into superiority',
  },
  rebel: {
    label: 'Rebel',
    description: 'Tests every rule by pushing against it.',
    gift: 'independence, courage and resistance to social pressure',
    cost: 'may reject good guidance simply because it arrived as guidance',
  },
};

const CROSSBREEDS: Record<string, string> = {
  'doomer|stoner': 'Sofa Prophet',
  'gamer|stoner': 'Fog Gamer',
  'monk|stoner': 'Chill Sage',
  'party_animal|stoner': 'Afterparty Philosopher',
  'alcoholic|party_animal': 'Afterparty Ghost',
  'alcoholic|doomer': 'Midnight Wreck',
  'alcoholic|workaholic': 'Functional Disaster',
  'gymbro|workaholic': 'Grind Machine',
  'doomer|gymbro': 'Iron Nihilist',
  'gymbro|party_animal': 'Preworkout Menace',
  'gamer|workaholic': 'Night-Shift Goblin',
  'doomer|workaholic': 'Burnout',
  'doomer|gamer': 'Basement Oracle',
  'conspiracist|doomer': 'Black-Pill Detective',
  'conspiracist|degen': 'Market Prophet',
  'degen|gamer': 'Loot Goblin',
  'degen|party_animal': 'Weekend Menace',
  'caretaker|party_animal': 'Social Glue',
  'doomer|monk': 'Quiet Survivor',
  'caretaker|workaholic': 'The Fixer',
  'caretaker|monk': 'Gentle Anchor',
  'rebel|stoner': 'Cosmic Dropout',
  'rebel|workaholic': 'Reluctant Founder',
  'conspiracist|gamer': 'Lore Addict',
  'conspiracist|rebel': 'Signal Pirate',
  'caretaker|doomer': 'Tired Empath',
  'gamer|gymbro': 'Min-Max Athlete',
  'monk|workaholic': 'Disciplined Hermit',
};

const HARMFUL_PATHS = new Set<LifePathId>(['alcoholic', 'degen']);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function emptyScores(): Record<LifePathId, number> {
  return Object.fromEntries(LIFE_PATH_IDS.map(id => [id, 0])) as Record<LifePathId, number>;
}

function pairKey(a: LifePathId, b: LifePathId) {
  return [a, b].sort().join('|');
}

function seededScores(personality: PersonalityTraits): Record<LifePathId, number> {
  const scores = emptyScores();
  scores.stoner = clamp((personality.calmness + personality.impulsiveness - 105) * 0.16, 0, 16);
  scores.party_animal = clamp((personality.sociability + personality.impulsiveness - 95) * 0.18, 0, 18);
  scores.gymbro = clamp((personality.confidence + personality.stubbornness - 105) * 0.12, 0, 13);
  scores.workaholic = clamp((personality.caution + personality.stubbornness - personality.calmness - 30) * 0.12, 0, 14);
  scores.doomer = clamp((115 - personality.optimism - personality.sociability * 0.35) * 0.18, 0, 18);
  scores.degen = clamp((personality.impulsiveness + personality.confidence - personality.caution - 45) * 0.11, 0, 12);
  scores.gamer = clamp((personality.curiosity + personality.independence - personality.sociability * 0.4 - 45) * 0.13, 0, 15);
  scores.conspiracist = clamp((personality.curiosity + personality.caution + personality.stubbornness - 155) * 0.1, 0, 12);
  scores.caretaker = clamp((personality.affection + personality.sociability - personality.independence - 30) * 0.16, 0, 18);
  scores.monk = clamp((personality.calmness + personality.caution - personality.impulsiveness - 40) * 0.15, 0, 17);
  scores.rebel = clamp((personality.independence + personality.stubbornness - personality.caution - 35) * 0.14, 0, 16);
  return scores;
}

function phaseFor(score: number, recovery: number, primary: LifePathId | null): LifePathPhase {
  if (primary && HARMFUL_PATHS.has(primary) && recovery >= 28) return 'recovering';
  if (score >= 72) return 'embodied';
  if (score >= 45) return 'committed';
  if (score >= 20) return 'leaning';
  return 'unformed';
}

function titleFor(primary: LifePathId | null, secondary: LifePathId | null, phase: LifePathPhase, recovery: number) {
  if (!primary) return 'Unwritten';
  if (phase === 'recovering') {
    if (primary === 'alcoholic') return recovery >= 60 ? 'Sober Veteran' : 'Trying to Get Clean';
    if (primary === 'degen') return recovery >= 60 ? 'Reformed Degen' : 'Breaking the Chase';
  }
  if (secondary) return CROSSBREEDS[pairKey(primary, secondary)] ?? `${LIFE_PATHS[primary].label} / ${LIFE_PATHS[secondary].label}`;
  return LIFE_PATHS[primary].label;
}

function recalculate(value: LifePathState, now: number, detail?: string): LifePathState {
  const ranked = LIFE_PATH_IDS
    .map(id => ({ id, score: value.scores[id] }))
    .sort((a, b) => b.score - a.score);
  const primary = ranked[0].score >= 18 ? ranked[0].id : null;
  const secondary = primary && ranked[1].score >= 16 && ranked[0].score - ranked[1].score <= 28 ? ranked[1].id : null;
  const phase = phaseFor(ranked[0].score, value.recovery, primary);
  const crossbreed = primary && secondary ? titleFor(primary, secondary, phase, value.recovery) : null;
  const changed = primary !== value.primary || secondary !== value.secondary || phase !== value.phase || crossbreed !== value.crossbreed;
  const stability = primary && primary === value.primary ? clamp(value.stability + 1) : primary ? 8 : 0;
  if (!changed) return { ...value, primary, secondary, phase, crossbreed, stability, lastUpdated: now };

  const title = titleFor(primary, secondary, phase, value.recovery);
  const milestone: LifePathMilestone = {
    id: `path-${now}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    title,
    detail: detail || (primary ? `Began to look like ${title}.` : 'The path became uncertain again.'),
    primary,
    secondary,
    phase,
  };
  return {
    ...value,
    primary,
    secondary,
    phase,
    crossbreed,
    stability,
    lastUpdated: now,
    history: [...value.history, milestone].slice(-30),
  };
}

export function createLifePathState(personality: PersonalityTraits, now = Date.now()): LifePathState {
  return recalculate({
    scores: seededScores(personality),
    primary: null,
    secondary: null,
    phase: 'unformed',
    crossbreed: null,
    recovery: 0,
    stability: 0,
    lastUpdated: now,
    history: [],
    lastDailyMomentDay: -1,
    pendingMoment: null,
    resolvedMomentIds: [],
  }, now);
}

export function migrateLifePathState(value: Partial<LifePathState> | null | undefined, personality: PersonalityTraits, now = Date.now()): LifePathState {
  const fallback = createLifePathState(personality, now);
  if (!value) return fallback;
  const scores = emptyScores();
  LIFE_PATH_IDS.forEach(id => {
    const candidate = value.scores?.[id];
    scores[id] = typeof candidate === 'number' && Number.isFinite(candidate) ? clamp(candidate) : fallback.scores[id];
  });
  return recalculate({
    ...fallback,
    ...value,
    scores,
    recovery: clamp(value.recovery ?? 0),
    stability: clamp(value.stability ?? 0),
    history: Array.isArray(value.history) ? value.history.slice(-30) : [],
    lastDailyMomentDay: Number.isFinite(value.lastDailyMomentDay) ? value.lastDailyMomentDay! : -1,
    pendingMoment: value.pendingMoment ?? null,
    resolvedMomentIds: Array.isArray(value.resolvedMomentIds) ? value.resolvedMomentIds.slice(-60) : [],
  }, now);
}

function applyObservedBehaviour(scores: Record<LifePathId, number>, obs: Pick<ObservedBehaviour, 'action' | 'target' | 'behaviourType' | 'exposureCount' | 'perceivedNegativeOutcome'>) {
  const amount = Math.min(12, 2 + Math.max(1, obs.exposureCount) * 1.7);
  if (obs.action === 'drink' && /piwo|wino|alkohol|beer|wine|alcohol|wódk/i.test(obs.target)) addScore(scores, 'alcoholic', amount);
  if (obs.action === 'smoke' && /weed|cannabis|pot/i.test(obs.target)) addScore(scores, 'stoner', amount);
  if (obs.action === 'exercise' || obs.action === 'do') addScore(scores, 'gymbro', amount * 0.75);
  if (obs.action === 'play' && /grę|gre|gry|playstation|xbox|pc|ranked|lola|fortnite|minecraft|game/i.test(obs.target)) addScore(scores, 'gamer', amount * 0.8);
  if (obs.action === 'overwork') addScore(scores, 'workaholic', amount * 0.85);
  if (obs.action === 'gamble') addScore(scores, 'degen', amount);
  if (obs.action === 'meditate') addScore(scores, 'monk', amount * 0.85);
  if (obs.action === 'get' && /drunk|wasted|pijany/i.test(obs.target)) addScore(scores, 'alcoholic', amount * 0.9);
  if (obs.action === 'stay up' || obs.action === 'sleep') { addScore(scores, 'gamer', amount * 0.35); addScore(scores, 'doomer', amount * 0.28); }
  if (obs.action === 'avoid' || obs.action === 'skip') { addScore(scores, 'doomer', amount * 0.55); addScore(scores, 'rebel', amount * 0.35); }
  if (obs.action === 'help' || obs.action === 'speak kindly') addScore(scores, 'caretaker', amount * 0.8);
  if (obs.action === 'clean') { addScore(scores, 'monk', amount * 0.4); addScore(scores, 'workaholic', amount * 0.35); }
  if (obs.action === 'buy') addScore(scores, 'degen', amount * 0.25);
  if (obs.action === 'try' && obs.perceivedNegativeOutcome > 0.3) addScore(scores, 'degen', amount * 0.45);
  if (obs.behaviourType === 'language' && obs.action === 'swear') addScore(scores, 'rebel', amount * 0.35);
}

export function bootstrapLifePathState(personality: PersonalityTraits, observations: ObservedBehaviour[], now = Date.now()): LifePathState {
  const base = createLifePathState(personality, now);
  const scores = { ...base.scores };
  observations.slice(-40).forEach(obs => applyObservedBehaviour(scores, obs));
  return recalculate({ ...base, scores }, now, observations.length > 0 ? 'Old habits began to form a visible life.' : undefined);
}

const TEXT_SIGNALS: Array<{ path: LifePathId; amount: number; regex: RegExp }> = [
  // JavaScript's classic word boundary is ASCII-only, so it does not match
  // after Polish letters such as the final "ę" in "palę". Explicit
  // whitespace/punctuation boundaries keep the Polish signal reliable.
  { path: 'stoner', amount: 9, regex: /(?:^|[\s.,!?])(?:palę|pale|jaram|zjarałem|zjaralem|zapaliłem|zapilem|smoke(?:d)? weed|smoke(?:d)? cannabis|got high|i(?:'m| am) high)(?=$|[\s.,!?])/i },
  { path: 'party_animal', amount: 6, regex: /\b(?:idę na imprezę|ide na impreze|byłem na imprezie|impreza|klub|rave|party|clubbing|afterparty)\b/i },
  { path: 'alcoholic', amount: 8, regex: /\b(?:(?:piję|pije|piłem|pilem|wypiłem|wypilem).{0,24}(?:piwo|wino|wódk|alkohol)|got drunk|was wasted|drink(?:ing)? alcohol|drink(?:ing)? beer|drink(?:ing)? wine)\b/i },
  { path: 'gymbro', amount: 6, regex: /\b(?:siłowni|silowni|trenuję|trenuje|ćwiczę|cwicze|białko|bialko|protein|gym|workout|lifting|gains)\b/i },
  { path: 'workaholic', amount: 6, regex: /\b(?:nadgodzin|pracuję po|pracuje po|ciągle prac|ciagle prac|nie mam czasu przez prac|work late|overwork|always working|another shift)\b/i },
  { path: 'doomer', amount: 6, regex: /\b(?:nie ma sensu|wszystko bez sensu|świat się kończy|swiat sie konczy|nic się nie zmieni|nic sie nie zmieni|nothing matters|world is doomed|no point|we are finished)\b/i },
  { path: 'degen', amount: 7, regex: /\b(?:obstawiam|bukmacher|kasyn|hazard|krypto|crypto|memecoin|betting|gambl|all in|leverage)\b/i },
  { path: 'gamer', amount: 6, regex: /\b(?:gram w|grałem w|gralem w|gaming|video game|played .{0,24}game|ranked|quest|raid)\b/i },
  { path: 'conspiracist', amount: 7, regex: /\b(?:ukrywają prawdę|ukrywaja prawde|oni nas śledzą|oni nas sledza|rząd kłamie|rzad klamie|spisek|conspiracy|they are hiding|government lies|wake up sheeple)\b/i },
  { path: 'caretaker', amount: 6, regex: /\b(?:pomogłem|pomoglem|pomogłam|pomoglam|opiekuję|opiekuje|wsparłem|wsparlem|helped someone|taking care|look after)\b/i },
  { path: 'monk', amount: 6, regex: /\b(?:medytuję|medytuje|medytacja|oddech|uważność|uwaznosc|meditat|mindful|inner peace|spokojnie oddych)\b/i },
  { path: 'rebel', amount: 6, regex: /\b(?:mam wyjebane|nie będę słuchać|nie bede sluchac|pieprzyć zasady|pierdzielę zasady|fuck the rules|won't obey|i refuse|break the rules)\b/i },
  // Direct influence matters too. One suggestion creates a temptation; only
  // repetition can grow it into a path, so personality changes do not happen
  // on command in a single message.
  { path: 'stoner', amount: 5, regex: /(?:^|[\s.,!?])(?:zapal(?:my)?|jaraj|spróbuj(?:my)? (?:zioła|ziola|marihuany|jointa)|smoke (?:some )?(?:weed|cannabis)|get high with me)(?=$|[\s.,!?])/i },
  { path: 'party_animal', amount: 4, regex: /(?:^|[\s.,!?])(?:chodźmy na imprezę|chodzmy na impreze|idź na imprezę|idz na impreze|let's party|go to the party|stay out all night)(?=$|[\s.,!?])/i },
  { path: 'alcoholic', amount: 5, regex: /(?:^|[\s.,!?])(?:napij się|napij sie|wypij|otwórz piwo|otworz piwo|chodź na piwo|chodz na piwo|have a drink|drink this|open a beer|let's get drunk)(?=$|[\s.,!?])/i },
  { path: 'doomer', amount: 4, regex: /(?:^|[\s.,!?])(?:odpuść wszystko|odpusc wszystko|nie rób nic|nie rob nic|give up|do nothing|why even try)(?=$|[\s.,!?])/i },
  { path: 'degen', amount: 5, regex: /(?:^|[\s.,!?])(?:postaw wszystko|zagraj w kasynie|obstaw wszystko|all in|bet it all|go gamble|double down)(?=$|[\s.,!?])/i },
  { path: 'rebel', amount: 4, regex: /(?:^|[\s.,!?])(?:złam zasady|zlam zasady|olej zasady|skłam|sklam|oszukaj|break the rules|ignore the rules|lie about it|cheat them)(?=$|[\s.,!?])/i },
];

function addScore(scores: Record<LifePathId, number>, id: LifePathId, amount: number) {
  scores[id] = clamp(scores[id] + amount);
}

export function evolveLifePath(state: GameState, userText: string, now = Date.now()): GameState {
  if (!state.development.hatched) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const elapsedDays = clamp((now - current.lastUpdated) / 86_400_000, 0, 30);
  if (elapsedDays > 0.5) {
    LIFE_PATH_IDS.forEach(id => {
      scores[id] = clamp(scores[id] - elapsedDays * (HARMFUL_PATHS.has(id) ? 0.55 : 0.2));
    });
  }

  TEXT_SIGNALS.forEach(signal => {
    if (signal.regex.test(userText)) addScore(scores, signal.path, signal.amount);
  });

  const parsed = parseUserStatement(userText);
  if (parsed) {
    applyObservedBehaviour(scores, {
      action: parsed.action ?? '',
      target: parsed.target ?? '',
      behaviourType: parsed.behaviourType ?? 'other',
      exposureCount: 1,
      perceivedNegativeOutcome: parsed.perceivedNegativeOutcome ?? 0,
    });
  }

  let recovery = current.recovery;
  const recoverySignal = /(?:trzeźw|trzezw|nie piję|nie pije|rzuciłem|rzucilem|przestałem|przestalem|odwyk|sober|sobriety|quit drinking|quit gambling|stopped drinking|in recovery|clean for)/i.test(userText);
  const consequenceSignal = /(?:kac|uzależn|uzalezn|dług|dlug|żałuję|zaluje|straciłem przez|stracilem przez|hangover|addict|debt|regret|lost because|problem)/i.test(userText);
  if (recoverySignal) {
    recovery = clamp(recovery + 14);
    scores.alcoholic = clamp(scores.alcoholic - 8);
    scores.degen = clamp(scores.degen - 6);
    scores.stoner = clamp(scores.stoner - 4);
  } else if (consequenceSignal) {
    recovery = clamp(recovery + 4);
    scores.alcoholic = clamp(scores.alcoholic - 2);
    scores.degen = clamp(scores.degen - 2);
  } else if (TEXT_SIGNALS.some(signal => HARMFUL_PATHS.has(signal.path) && signal.regex.test(userText))) {
    recovery = clamp(recovery - 2);
  }

  const nextPath = recalculate({ ...current, scores, recovery }, now, recoverySignal ? 'Chose change over repetition.' : undefined);
  return { ...state, lifePath: nextPath };
}

const OBJECT_EFFECTS: Partial<Record<ObjectType, Partial<Record<LifePathId, number>>>> = {
  ball: { gymbro: 2.2, party_animal: 0.6 },
  blanket: { stoner: 1.2, doomer: 0.6, monk: 0.8 },
  paper: { workaholic: 1.1, conspiracist: 0.7 },
  pencil: { workaholic: 1.2, conspiracist: 0.8 },
  box: { gamer: 0.8, conspiracist: 0.8, rebel: 0.4 },
  stone: { monk: 1.2, doomer: 0.4 },
  mirror: { party_animal: 1.1, gymbro: 0.7, doomer: 0.5 },
  broccoli: { gymbro: 1.2, monk: 0.5 },
  apple: { caretaker: 0.5, gymbro: 0.7 },
};

export function evolveLifePathFromObject(state: GameState, type: ObjectType, outcome: ObjectReactionOutcome, now = Date.now()): GameState {
  const effects = OBJECT_EFFECTS[type];
  if (!effects || !state.development.hatched) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const multiplier = outcome === 'love' ? 1.5 : outcome === 'enjoy' ? 1 : outcome === 'avoid' ? -0.35 : 0.55;
  Object.entries(effects).forEach(([id, amount]) => addScore(scores, id as LifePathId, (amount ?? 0) * multiplier));
  return { ...state, lifePath: recalculate({ ...current, scores }, now) };
}

const MOMENT_TEMPLATES: Array<Omit<DailyMoment, 'id' | 'day'>> = [
  {
    title: '2:17 AM',
    prompt: 'The room is quiet, but the mind is not. What should happen next?',
    choices: [
      { id: 'queue', label: 'One more game', result: 'The night became another level.', pathEffects: { gamer: 6, doomer: 2 } },
      { id: 'breathe', label: 'Sit with the silence', result: 'The silence stopped feeling empty.', pathEffects: { monk: 6 }, recoveryEffect: 2 },
      { id: 'message', label: 'Message somebody', result: 'A small connection outlived the hour.', pathEffects: { caretaker: 3, party_animal: 3 }, bondEffect: 2 },
    ],
  },
  {
    title: 'The Easy Bet',
    prompt: 'A glowing chart promises that one reckless move could change everything.',
    choices: [
      { id: 'all-in', label: 'All in', result: 'For a moment, risk felt exactly like destiny.', pathEffects: { degen: 8, rebel: 2 } },
      { id: 'study', label: 'Study the pattern', result: 'Suspicion replaced excitement.', pathEffects: { conspiracist: 5, workaholic: 2 } },
      { id: 'close', label: 'Close it', result: 'Walking away felt strangely powerful.', pathEffects: { monk: 4 }, recoveryEffect: 5 },
    ],
  },
  {
    title: 'Someone Needs You',
    prompt: 'A tired voice asks for help at the worst possible time.',
    choices: [
      { id: 'stay', label: 'Stay with them', result: 'Nothing was fixed, but nobody was alone.', pathEffects: { caretaker: 7 }, bondEffect: 3 },
      { id: 'solve', label: 'Make a plan', result: 'The problem became a list.', pathEffects: { workaholic: 5, caretaker: 2 } },
      { id: 'escape', label: 'Pretend not to notice', result: 'The room became quieter and heavier.', pathEffects: { doomer: 5, rebel: 2 }, bondEffect: -2 },
    ],
  },
  {
    title: 'The Bottle',
    prompt: 'Something left from a party catches the light. It carries a story and a warning.',
    choices: [
      { id: 'drink', label: 'Open it', result: 'Warmth arrived first. The cost waited outside.', pathEffects: { alcoholic: 8, party_animal: 3 } },
      { id: 'keep', label: 'Save it for later', result: 'The decision was delayed, not removed.', pathEffects: { alcoholic: 3, doomer: 2 } },
      { id: 'pour', label: 'Pour it out', result: 'The smell disappeared before the memory did.', pathEffects: { monk: 3 }, recoveryEffect: 9 },
    ],
  },
  {
    title: 'Room Archaeology',
    prompt: 'The mess has developed layers. It is becoming either a problem or a culture.',
    choices: [
      { id: 'clean', label: 'Reset the room', result: 'Order made the room feel larger.', pathEffects: { monk: 4, workaholic: 3 } },
      { id: 'nest', label: 'Make it comfortable', result: 'The mess became a nest with plausible deniability.', pathEffects: { stoner: 6, gamer: 2 } },
      { id: 'art', label: 'Call it an installation', result: 'A refusal became an aesthetic.', pathEffects: { rebel: 5, party_animal: 2 } },
    ],
  },
  {
    title: 'Mirror Challenge',
    prompt: 'The reflection asks a rude question: what are you actually building?',
    choices: [
      { id: 'body', label: 'A stronger body', result: 'The floor became a training ground.', pathEffects: { gymbro: 7 } },
      { id: 'career', label: 'Something undeniable', result: 'Rest was postponed in the name of proof.', pathEffects: { workaholic: 7 } },
      { id: 'nothing', label: 'Nothing. That is fine.', result: 'The reflection lost the argument.', pathEffects: { stoner: 4, monk: 3 } },
    ],
  },
  {
    title: 'The Thread',
    prompt: 'Three unrelated details suddenly look related. How far should the theory go?',
    choices: [
      { id: 'wall', label: 'Build the evidence wall', result: 'Soon every gap looked intentional.', pathEffects: { conspiracist: 8 } },
      { id: 'ask', label: 'Ask what would disprove it', result: 'The theory survived, but certainty did not.', pathEffects: { conspiracist: 3, monk: 3 } },
      { id: 'meme', label: 'Turn it into a meme', result: 'The mystery became funnier than it was frightening.', pathEffects: { gamer: 3, stoner: 3 } },
    ],
  },
  {
    title: 'No Invitation',
    prompt: 'Everyone seems to be somewhere else tonight.',
    choices: [
      { id: 'go', label: 'Find the noise', result: 'A stranger became a story before sunrise.', pathEffects: { party_animal: 7 } },
      { id: 'stay', label: 'Stay home and play', result: 'The lobby was full even if the room was not.', pathEffects: { gamer: 6 } },
      { id: 'feel', label: 'Let it hurt', result: 'Loneliness became information instead of an enemy.', pathEffects: { doomer: 3, monk: 3 }, recoveryEffect: 2 },
    ],
  },
];

export function ensureDailyMoment(state: GameState, now = Date.now()): GameState {
  if (!state.development.hatched || state.development.cognitiveLevel < 12) return state;
  const path = state.lifePath;
  if (path.pendingMoment) return state;
  const day = Math.max(1, Math.floor(state.development.chronologicalAge / 86_400_000) + 1);
  if (path.lastDailyMomentDay >= day) return state;
  const primaryIndex = path.primary ? LIFE_PATH_IDS.indexOf(path.primary) : 0;
  const index = Math.abs(state.identity.seed + day * 31 + primaryIndex * 17) % MOMENT_TEMPLATES.length;
  const template = MOMENT_TEMPLATES[index];
  const pendingMoment: DailyMoment = { ...template, id: `moment-${day}-${index}`, day };
  if (path.resolvedMomentIds.includes(pendingMoment.id)) {
    return { ...state, lifePath: { ...path, lastDailyMomentDay: day } };
  }
  return { ...state, lifePath: { ...path, pendingMoment } };
}

export function resolveDailyMoment(state: GameState, choiceId: string, now = Date.now()): GameState {
  const moment = state.lifePath?.pendingMoment;
  if (!moment) return state;
  const choice = moment.choices.find(item => item.id === choiceId);
  if (!choice) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  Object.entries(choice.pathEffects).forEach(([id, amount]) => addScore(scores, id as LifePathId, amount ?? 0));
  const recovery = clamp(current.recovery + (choice.recoveryEffect ?? 0));
  const nextPath = recalculate({
    ...current,
    scores,
    recovery,
    pendingMoment: null,
    lastDailyMomentDay: moment.day,
    resolvedMomentIds: [...current.resolvedMomentIds, moment.id].slice(-60),
  }, now, choice.result);
  const bondDelta = choice.bondEffect ?? 0;
  return {
    ...state,
    lifePath: nextPath,
    bond: {
      ...state.bond,
      score: clamp(state.bond.score + bondDelta),
      totalInteractions: state.bond.totalInteractions + 1,
      lastInteraction: now,
    },
    memories: [...state.memories, {
      id: `mem-moment-${now}`,
      timestamp: now,
      content: `${moment.title}: ${choice.result}`,
      importance: 7,
      emotionalValence: bondDelta > 0 ? 0.35 : bondDelta < 0 ? -0.35 : 0,
      tags: ['daily-moment', 'choice', nextPath.primary ?? 'unwritten'],
      mentioned: false,
      understood: true,
      compressed: false,
    }].slice(-200),
  };
}

export function getLifePathTitle(state: Pick<GameState, 'lifePath' | 'personality'>): string {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return titleFor(path.primary, path.secondary, path.phase, path.recovery);
}

export function getLifePathDescription(state: Pick<GameState, 'lifePath' | 'personality'>): string {
  const path = migrateLifePathState(state.lifePath, state.personality);
  if (!path.primary) return 'No life has hardened into a role yet.';
  if (path.phase === 'recovering') return `The old ${LIFE_PATHS[path.primary].label.toLowerCase()} pattern is still visible, but it no longer makes every decision.`;
  if (path.secondary) return `${LIFE_PATHS[path.primary].description} ${LIFE_PATHS[path.secondary].description}`;
  return LIFE_PATHS[path.primary].description;
}

export function getLifePathClues(state: Pick<GameState, 'lifePath' | 'personality'>, count = 3): string[] {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return LIFE_PATH_IDS
    .map(id => ({ id, score: path.scores[id] }))
    .filter(item => item.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ id, score }) => score >= 45
      ? `${LIFE_PATHS[id].label}: ${LIFE_PATHS[id].cost}`
      : `Leaning ${LIFE_PATHS[id].label.toLowerCase()}: ${LIFE_PATHS[id].gift}`);
}

export function getRankedLifePaths(state: Pick<GameState, 'lifePath' | 'personality'>, count = 4) {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return LIFE_PATH_IDS.map(id => ({ id, label: LIFE_PATHS[id].label, score: path.scores[id] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

export interface LifePathVisual {
  hueShift: number;
  saturation: number;
  lightness: number;
  eyeDroop: number;
  width: number;
  height: number;
  aura: string;
  roomTint: string;
  accent: string;
  paths: LifePathId[];
  strength: number;
}

const VISUALS: Record<LifePathId, Omit<LifePathVisual, 'paths' | 'strength'>> = {
  stoner: { hueShift: 82, saturation: 30, lightness: 49, eyeDroop: 0.44, width: 1.04, height: 0.96, aura: 'rgba(116, 168, 104, 0.18)', roomTint: 'rgba(80, 120, 72, 0.14)', accent: '#9fc38f' },
  party_animal: { hueShift: 306, saturation: 48, lightness: 55, eyeDroop: 0.04, width: 1.01, height: 1.01, aura: 'rgba(210, 92, 184, 0.20)', roomTint: 'rgba(115, 48, 130, 0.16)', accent: '#e58ccd' },
  alcoholic: { hueShift: 14, saturation: 34, lightness: 47, eyeDroop: 0.3, width: 1.03, height: 0.97, aura: 'rgba(165, 92, 58, 0.17)', roomTint: 'rgba(92, 54, 34, 0.16)', accent: '#be7658' },
  gymbro: { hueShift: 26, saturation: 36, lightness: 53, eyeDroop: 0, width: 1.17, height: 1.03, aura: 'rgba(218, 156, 68, 0.16)', roomTint: 'rgba(126, 88, 34, 0.13)', accent: '#e6b15f' },
  workaholic: { hueShift: 214, saturation: 22, lightness: 48, eyeDroop: 0.22, width: 0.98, height: 1.04, aura: 'rgba(94, 128, 155, 0.15)', roomTint: 'rgba(44, 67, 86, 0.15)', accent: '#8caec4' },
  doomer: { hueShift: 238, saturation: 12, lightness: 36, eyeDroop: 0.34, width: 0.98, height: 0.98, aura: 'rgba(72, 74, 104, 0.22)', roomTint: 'rgba(25, 26, 42, 0.24)', accent: '#777b9f' },
  degen: { hueShift: 132, saturation: 54, lightness: 47, eyeDroop: 0.08, width: 1.02, height: 1.01, aura: 'rgba(63, 210, 117, 0.18)', roomTint: 'rgba(28, 104, 58, 0.14)', accent: '#58df8b' },
  gamer: { hueShift: 275, saturation: 43, lightness: 49, eyeDroop: 0.18, width: 1.02, height: 0.98, aura: 'rgba(129, 76, 210, 0.19)', roomTint: 'rgba(57, 31, 104, 0.18)', accent: '#a782ed' },
  conspiracist: { hueShift: 58, saturation: 24, lightness: 46, eyeDroop: 0.09, width: 0.98, height: 1.02, aura: 'rgba(185, 178, 96, 0.16)', roomTint: 'rgba(91, 86, 43, 0.15)', accent: '#c8bf72' },
  caretaker: { hueShift: 350, saturation: 27, lightness: 58, eyeDroop: 0, width: 1.06, height: 1.01, aura: 'rgba(224, 142, 151, 0.17)', roomTint: 'rgba(112, 66, 72, 0.12)', accent: '#e5a0a7' },
  monk: { hueShift: 42, saturation: 18, lightness: 58, eyeDroop: 0.12, width: 0.98, height: 1.04, aura: 'rgba(226, 195, 120, 0.18)', roomTint: 'rgba(116, 94, 48, 0.12)', accent: '#dcc783' },
  rebel: { hueShift: 2, saturation: 42, lightness: 44, eyeDroop: 0.06, width: 1.03, height: 1.02, aura: 'rgba(196, 66, 72, 0.17)', roomTint: 'rgba(96, 29, 35, 0.16)', accent: '#d15e62' },
};

export function getLifePathVisual(state: Pick<GameState, 'lifePath' | 'personality'>): LifePathVisual {
  const path = migrateLifePathState(state.lifePath, state.personality);
  const strength = { unformed: 0.15, leaning: 0.45, committed: 0.72, embodied: 1, recovering: 0.62 }[path.phase];
  const ids = [path.primary, path.secondary].filter((id): id is LifePathId => Boolean(id));
  if (!path.primary) return { hueShift: 0, saturation: 24, lightness: 52, eyeDroop: 0, width: 1, height: 1, aura: 'rgba(200,180,150,0.08)', roomTint: 'transparent', accent: '#c9b8a0', paths: [], strength };
  const primary = VISUALS[path.primary];
  const secondary = path.secondary ? VISUALS[path.secondary] : primary;
  const mix = path.secondary ? 0.34 : 0;
  return {
    hueShift: primary.hueShift * (1 - mix) + secondary.hueShift * mix,
    saturation: primary.saturation * (1 - mix) + secondary.saturation * mix,
    lightness: primary.lightness * (1 - mix) + secondary.lightness * mix,
    eyeDroop: primary.eyeDroop * (1 - mix) + secondary.eyeDroop * mix,
    width: 1 + ((primary.width * (1 - mix) + secondary.width * mix) - 1) * strength,
    height: 1 + ((primary.height * (1 - mix) + secondary.height * mix) - 1) * strength,
    aura: primary.aura,
    roomTint: primary.roomTint,
    accent: secondary.accent,
    paths: ids,
    strength,
  };
}
