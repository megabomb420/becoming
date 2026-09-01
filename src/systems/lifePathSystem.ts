import { authoritativeNow } from './authoritativeTime';
import {
  DailyMoment,
  GameState,
  LifePathId,
  LifePathEvidence,
  LifePathMilestone,
  LifePathPhase,
  LifePathState,
  ObjectReactionOutcome,
  ObjectType,
  ObservedBehaviour,
  PersonalityTraits,
} from '../types';
import { parseUserStatement } from './socialLearningSystem';
import { getTimeOfDay, isCreatureRestPhase } from './timeSystem';

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
  labelPl: string;
  description: string;
  descriptionPl: string;
  gift: string;
  giftPl: string;
  cost: string;
  costPl: string;
}

export const LIFE_PATHS: Record<LifePathId, LifePathDefinition> = {
  stoner: {
    label: 'Stoner',
    labelPl: 'Jaracz',
    description: 'Slow, associative and strangely philosophical.',
    descriptionPl: 'Spokojny, skojarzeniowy i zaskakująco filozoficzny.',
    gift: 'sees odd connections and stays difficult to rattle',
    giftPl: 'widzi nieoczywiste połączenia i trudno wytrącić go z równowagi',
    cost: 'drifts, forgets promises and avoids momentum',
    costPl: 'odpływa myślami, zapomina o obietnicach i unika działania',
  },
  party_animal: {
    label: 'Party Animal',
    labelPl: 'Dusza imprezy',
    description: 'Lives for noise, attention and the next story.',
    descriptionPl: 'Żyje dla hałasu, uwagi i kolejnej historii.',
    gift: 'turns empty rooms into events',
    giftPl: 'zamienia puste pokoje w wydarzenia',
    cost: 'hates quiet and can mistake chaos for closeness',
    costPl: 'nie znosi ciszy i potrafi pomylić chaos z bliskością',
  },
  alcoholic: {
    label: 'Alcoholic',
    labelPl: 'Alkoholik',
    description: 'Uses the next drink to postpone the last consequence.',
    descriptionPl: 'Kolejnym drinkiem odsuwa konsekwencje poprzedniego.',
    gift: 'can be disarmingly open and socially fearless',
    giftPl: 'bywa rozbrajająco otwarty i odważny wśród innych',
    cost: 'becomes unreliable, volatile and increasingly tired',
    costPl: 'staje się zawodny, chwiejny i coraz bardziej zmęczony',
  },
  gymbro: {
    label: 'Gymbro',
    labelPl: 'Bywalec siłowni',
    description: 'Treats existence like a programme that needs progressive overload.',
    descriptionPl: 'Traktuje życie jak plan treningowy wymagający coraz większego obciążenia.',
    gift: 'discipline, confidence and direct encouragement',
    giftPl: 'dyscyplina, pewność siebie i bezpośrednie wsparcie',
    cost: 'turns rest, softness and uncertainty into personal failures',
    costPl: 'uznaje odpoczynek, łagodność i niepewność za osobiste porażki',
  },
  workaholic: {
    label: 'Workaholic',
    labelPl: 'Pracoholik',
    description: 'Measures worth in finished tasks and late nights.',
    descriptionPl: 'Mierzy własną wartość wykonanymi zadaniami i zarwanymi nocami.',
    gift: 'focuses hard and remembers unfinished business',
    giftPl: 'potrafi się skupić i pamięta o niedokończonych sprawach',
    cost: 'cannot stop performing long enough to feel alive',
    costPl: 'nie umie przestać działać na tyle długo, by poczuć, że żyje',
  },
  doomer: {
    label: 'Doomer',
    labelPl: 'Pesymista',
    description: 'Expects the worst and notices what optimism edits out.',
    descriptionPl: 'Spodziewa się najgorszego i widzi to, co optymizm pomija.',
    gift: 'honesty, sensitivity and a sharp eye for false hope',
    giftPl: 'szczerość, wrażliwość i wyczulenie na fałszywą nadzieję',
    cost: 'confuses prediction with fate and withdrawal with safety',
    costPl: 'myli przewidywania z losem, a wycofanie z bezpieczeństwem',
  },
  degen: {
    label: 'Degen',
    labelPl: 'Ryzykant',
    description: 'Believes the next reckless move will finally change everything.',
    descriptionPl: 'Wierzy, że kolejny lekkomyślny ruch wreszcie odmieni wszystko.',
    gift: 'boldness, improvisation and appetite for possibility',
    giftPl: 'odwaga, improwizacja i apetyt na możliwości',
    cost: 'chases losses, hype and shortcuts',
    costPl: 'goni za stratami, modą i drogami na skróty',
  },
  gamer: {
    label: 'Gamer',
    labelPl: 'Gracz',
    description: 'Turns routines into quests and feelings into mechanics.',
    descriptionPl: 'Zmienia rutynę w zadania, a uczucia w mechaniki.',
    gift: 'persistence, systems thinking and playful focus',
    giftPl: 'wytrwałość, myślenie systemowe i skupienie przez zabawę',
    cost: 'can hide inside the game when real life has no clear objective',
    costPl: 'potrafi schować się w grze, gdy prawdziwe życie nie ma jasnego celu',
  },
  conspiracist: {
    label: 'Conspiracist',
    labelPl: 'Tropiciel spisków',
    description: 'Assumes every coincidence is a door someone forgot to lock.',
    descriptionPl: 'Traktuje każdy zbieg okoliczności jak drzwi, których ktoś zapomniał zamknąć.',
    gift: 'questions consensus and follows details others ignore',
    giftPl: 'podważa powszechne opinie i śledzi szczegóły pomijane przez innych',
    cost: 'builds certainty faster than evidence',
    costPl: 'buduje pewność szybciej niż dowody',
  },
  caretaker: {
    label: 'Caretaker',
    labelPl: 'Opiekun',
    description: 'Feels useful when everyone else is held together.',
    descriptionPl: 'Czuje się potrzebny, kiedy pomaga innym trzymać się razem.',
    gift: 'loyalty, patience and attention to small needs',
    giftPl: 'lojalność, cierpliwość i uważność na drobne potrzeby',
    cost: 'forgets that care without boundaries becomes self-erasure',
    costPl: 'zapomina, że opieka bez granic prowadzi do zatracenia siebie',
  },
  monk: {
    label: 'Monk',
    labelPl: 'Mnich',
    description: 'Practises distance from every impulse, sometimes too successfully.',
    descriptionPl: 'Ćwiczy dystans do każdego impulsu, czasem aż nazbyt skutecznie.',
    gift: 'calm, reflection and the ability to begin again',
    giftPl: 'spokój, refleksja i zdolność zaczynania od nowa',
    cost: 'can turn peace into avoidance and wisdom into superiority',
    costPl: 'potrafi zmienić spokój w unikanie, a mądrość w wyższość',
  },
  rebel: {
    label: 'Rebel',
    labelPl: 'Buntownik',
    description: 'Tests every rule by pushing against it.',
    descriptionPl: 'Sprawdza każdą zasadę, napierając na jej granice.',
    gift: 'independence, courage and resistance to social pressure',
    giftPl: 'niezależność, odwaga i odporność na presję otoczenia',
    cost: 'may reject good guidance simply because it arrived as guidance',
    costPl: 'może odrzucić dobrą radę tylko dlatego, że była radą',
  },
};

const CROSSBREEDS: Record<string, { en: string; pl: string }> = {
  'doomer|stoner': { en: 'Sofa Prophet', pl: 'Kanapowy prorok' },
  'gamer|stoner': { en: 'Fog Gamer', pl: 'Gracz we mgle' },
  'monk|stoner': { en: 'Chill Sage', pl: 'Spokojny mędrzec' },
  'party_animal|stoner': { en: 'Afterparty Philosopher', pl: 'Filozof po imprezie' },
  'alcoholic|party_animal': { en: 'Afterparty Ghost', pl: 'Duch po imprezie' },
  'alcoholic|doomer': { en: 'Midnight Wreck', pl: 'Nocny rozbitek' },
  'alcoholic|workaholic': { en: 'Functional Disaster', pl: 'Funkcjonująca katastrofa' },
  'gymbro|workaholic': { en: 'Grind Machine', pl: 'Maszyna do działania' },
  'doomer|gymbro': { en: 'Iron Nihilist', pl: 'Żelazny nihilista' },
  'gymbro|party_animal': { en: 'Preworkout Menace', pl: 'Postrach przedtreningówki' },
  'gamer|workaholic': { en: 'Night-Shift Goblin', pl: 'Goblin nocnej zmiany' },
  'doomer|workaholic': { en: 'Burnout', pl: 'Wypalenie' },
  'doomer|gamer': { en: 'Basement Oracle', pl: 'Piwniczna wyrocznia' },
  'conspiracist|doomer': { en: 'Black-Pill Detective', pl: 'Detektyw czarnych scenariuszy' },
  'conspiracist|degen': { en: 'Market Prophet', pl: 'Prorok rynku' },
  'degen|gamer': { en: 'Loot Goblin', pl: 'Goblin łupów' },
  'degen|party_animal': { en: 'Weekend Menace', pl: 'Weekendowe utrapienie' },
  'caretaker|party_animal': { en: 'Social Glue', pl: 'Dusza paczki' },
  'doomer|monk': { en: 'Quiet Survivor', pl: 'Cichy ocalały' },
  'caretaker|workaholic': { en: 'The Fixer', pl: 'Ten, który wszystko naprawia' },
  'caretaker|monk': { en: 'Gentle Anchor', pl: 'Łagodna kotwica' },
  'rebel|stoner': { en: 'Cosmic Dropout', pl: 'Kosmiczny włóczęga' },
  'rebel|workaholic': { en: 'Reluctant Founder', pl: 'Niechętny założyciel' },
  'conspiracist|gamer': { en: 'Lore Addict', pl: 'Łowca opowieści' },
  'conspiracist|rebel': { en: 'Signal Pirate', pl: 'Pirat sygnałów' },
  'caretaker|doomer': { en: 'Tired Empath', pl: 'Zmęczony empata' },
  'gamer|gymbro': { en: 'Min-Max Athlete', pl: 'Sportowiec od min-maxu' },
  'monk|workaholic': { en: 'Disciplined Hermit', pl: 'Zdyscyplinowany pustelnik' },
};

const HARMFUL_PATHS = new Set<LifePathId>(['alcoholic', 'degen']);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function emptyScores(): Record<LifePathId, number> {
  return Object.fromEntries(LIFE_PATH_IDS.map(id => [id, 0])) as Record<LifePathId, number>;
}

function emptyPathEvidence(): LifePathEvidence {
  return {
    userMentions: 0,
    creatureCuriosities: 0,
    creaturePreferences: 0,
    creatureChoices: 0,
    creatureRejections: 0,
    firstPositiveAt: null,
    lastPositiveAt: null,
    lastNegativeAt: null,
  };
}

function emptyEvidence(): Record<LifePathId, LifePathEvidence> {
  return Object.fromEntries(LIFE_PATH_IDS.map(id => [id, emptyPathEvidence()])) as Record<LifePathId, LifePathEvidence>;
}

function migratePathEvidence(value: Partial<LifePathEvidence> | null | undefined): LifePathEvidence {
  const fallback = emptyPathEvidence();
  return {
    userMentions: Math.max(0, Math.floor(value?.userMentions ?? 0)),
    creatureCuriosities: Math.max(0, Math.floor(value?.creatureCuriosities ?? 0)),
    creaturePreferences: Math.max(0, Math.floor(value?.creaturePreferences ?? 0)),
    creatureChoices: Math.max(0, Math.floor(value?.creatureChoices ?? 0)),
    creatureRejections: Math.max(0, Math.floor(value?.creatureRejections ?? 0)),
    firstPositiveAt: Number.isFinite(value?.firstPositiveAt) ? Number(value?.firstPositiveAt) : fallback.firstPositiveAt,
    lastPositiveAt: Number.isFinite(value?.lastPositiveAt) ? Number(value?.lastPositiveAt) : fallback.lastPositiveAt,
    lastNegativeAt: Number.isFinite(value?.lastNegativeAt) ? Number(value?.lastNegativeAt) : fallback.lastNegativeAt,
  };
}

function positiveEvidence(evidence: LifePathEvidence) {
  return evidence.creaturePreferences + evidence.creatureChoices;
}

function evidenceBalance(evidence: LifePathEvidence) {
  return positiveEvidence(evidence) - evidence.creatureRejections * 2;
}

export function isStablePath(score: number, evidence: LifePathEvidence) {
  const positives = positiveEvidence(evidence);
  const span = (evidence.lastPositiveAt ?? 0) - (evidence.firstPositiveAt ?? 0);
  return score >= 42
    && positives >= 6
    && evidenceBalance(evidence) >= 5
    && (span >= 30 * 60_000 || positives >= 9);
}

export function isVisibleDirection(score: number, evidence: LifePathEvidence) {
  return score >= 8 && positiveEvidence(evidence) >= 2 && evidenceBalance(evidence) >= 1;
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

function titleFor(primary: LifePathId | null, secondary: LifePathId | null, phase: LifePathPhase, recovery: number, language: 'en' | 'pl' = 'en') {
  if (!primary) return language === 'pl' ? 'Nieukształtowany' : 'Unwritten';
  if (phase === 'recovering') {
    if (primary === 'alcoholic') return language === 'pl'
      ? recovery >= 60 ? 'Trzeźwy weteran' : 'Próbuje wyjść z nałogu'
      : recovery >= 60 ? 'Sober Veteran' : 'Trying to Get Clean';
    if (primary === 'degen') return language === 'pl'
      ? recovery >= 60 ? 'Nawrócony ryzykant' : 'Przerywa pogoń'
      : recovery >= 60 ? 'Reformed Degen' : 'Breaking the Chase';
  }
  if (secondary) {
    const crossbreed = CROSSBREEDS[pairKey(primary, secondary)];
    return crossbreed?.[language] ?? `${language === 'pl' ? LIFE_PATHS[primary].labelPl : LIFE_PATHS[primary].label} / ${language === 'pl' ? LIFE_PATHS[secondary].labelPl : LIFE_PATHS[secondary].label}`;
  }
  return language === 'pl' ? LIFE_PATHS[primary].labelPl : LIFE_PATHS[primary].label;
}

function recalculate(value: LifePathState, now: number, detail?: string): LifePathState {
  const ranked = LIFE_PATH_IDS
    .map(id => ({ id, score: value.scores[id] }))
    .sort((a, b) => b.score - a.score);
  const stable = ranked.filter(item => isStablePath(item.score, value.evidence[item.id]));
  const primary = stable[0]?.id ?? null;
  const secondaryCandidate = stable.find(item => item.id !== primary);
  const secondary = primary && secondaryCandidate && value.scores[primary] - secondaryCandidate.score <= 28 ? secondaryCandidate.id : null;
  const phase = phaseFor(primary ? value.scores[primary] : 0, value.recovery, primary);
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

export function createLifePathState(personality: PersonalityTraits, now = authoritativeNow()): LifePathState {
  return recalculate({
    scores: seededScores(personality),
    evidence: emptyEvidence(),
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

export function migrateLifePathState(value: Partial<LifePathState> | null | undefined, personality: PersonalityTraits, now = authoritativeNow()): LifePathState {
  const fallback = createLifePathState(personality, now);
  if (!value) return fallback;
  const hasSourceAwareEvidence = Boolean(value.evidence && LIFE_PATH_IDS.every(id => value.evidence?.[id]));
  const scores = emptyScores();
  LIFE_PATH_IDS.forEach(id => {
    const candidate = value.scores?.[id];
    scores[id] = hasSourceAwareEvidence && typeof candidate === 'number' && Number.isFinite(candidate)
      ? clamp(candidate)
      : fallback.scores[id];
  });
  const evidence = emptyEvidence();
  LIFE_PATH_IDS.forEach(id => {
    evidence[id] = migratePathEvidence(value.evidence?.[id]);
  });
  return recalculate({
    ...fallback,
    ...value,
    scores,
    evidence,
    primary: hasSourceAwareEvidence ? value.primary ?? null : null,
    secondary: hasSourceAwareEvidence ? value.secondary ?? null : null,
    phase: hasSourceAwareEvidence ? value.phase ?? 'unformed' : 'unformed',
    crossbreed: hasSourceAwareEvidence ? value.crossbreed ?? null : null,
    recovery: hasSourceAwareEvidence ? clamp(value.recovery ?? 0) : 0,
    stability: hasSourceAwareEvidence ? clamp(value.stability ?? 0) : 0,
    history: hasSourceAwareEvidence && Array.isArray(value.history) ? value.history.slice(-30) : [],
    lastDailyMomentDay: Number.isFinite(value.lastDailyMomentDay) ? value.lastDailyMomentDay! : -1,
    pendingMoment: hydrateDailyMoment(value.pendingMoment ?? null),
    resolvedMomentIds: Array.isArray(value.resolvedMomentIds) ? value.resolvedMomentIds.slice(-60) : [],
  }, now);
}

function applyObservedBehaviour(
  scores: Record<LifePathId, number>,
  obs: Pick<ObservedBehaviour, 'action' | 'target' | 'behaviourType' | 'exposureCount' | 'perceivedNegativeOutcome'>,
  weight = 1,
): LifePathId[] {
  const before = { ...scores };
  const amount = Math.min(12, 2 + Math.max(1, obs.exposureCount) * 1.7);
  if (obs.action === 'drink' && /piwo|wino|alkohol|beer|wine|alcohol|wódk/i.test(obs.target)) addScore(scores, 'alcoholic', amount * weight);
  if (obs.action === 'smoke' && /weed|cannabis|pot|zioł|ziol|marihuan|joint|blunt|skręt|skret/i.test(obs.target)) addScore(scores, 'stoner', amount * weight);
  if (obs.action === 'exercise' || obs.action === 'do') addScore(scores, 'gymbro', amount * 0.75 * weight);
  if (obs.action === 'play' && /grę|gre|gry|playstation|xbox|pc|ranked|lola|fortnite|minecraft|game/i.test(obs.target)) addScore(scores, 'gamer', amount * 0.8 * weight);
  if (obs.action === 'overwork') addScore(scores, 'workaholic', amount * 0.85 * weight);
  if (obs.action === 'gamble') addScore(scores, 'degen', amount * weight);
  if (obs.action === 'meditate') addScore(scores, 'monk', amount * 0.85 * weight);
  if (obs.action === 'get' && /drunk|wasted|pijany/i.test(obs.target)) addScore(scores, 'alcoholic', amount * 0.9 * weight);
  if (obs.action === 'stay up' || obs.action === 'sleep') { addScore(scores, 'gamer', amount * 0.35 * weight); addScore(scores, 'doomer', amount * 0.28 * weight); }
  if (obs.action === 'avoid' || obs.action === 'skip') { addScore(scores, 'doomer', amount * 0.55 * weight); addScore(scores, 'rebel', amount * 0.35 * weight); }
  if (obs.action === 'help' || obs.action === 'speak kindly') addScore(scores, 'caretaker', amount * 0.8 * weight);
  if (obs.action === 'clean') { addScore(scores, 'monk', amount * 0.4 * weight); addScore(scores, 'workaholic', amount * 0.35 * weight); }
  if (obs.action === 'buy') addScore(scores, 'degen', amount * 0.25 * weight);
  if (obs.action === 'try' && obs.perceivedNegativeOutcome > 0.3) addScore(scores, 'degen', amount * 0.45 * weight);
  if (obs.behaviourType === 'language' && obs.action === 'swear') addScore(scores, 'rebel', amount * 0.35 * weight);
  return LIFE_PATH_IDS.filter(id => scores[id] !== before[id]);
}

export function bootstrapLifePathState(personality: PersonalityTraits, observations: ObservedBehaviour[], now = authoritativeNow()): LifePathState {
  const base = createLifePathState(personality, now);
  const scores = { ...base.scores };
  const evidence = { ...base.evidence };
  observations.slice(-40).forEach(obs => {
    applyObservedBehaviour(scores, obs, 0.06).forEach(id => {
      evidence[id] = { ...evidence[id], userMentions: evidence[id].userMentions + Math.max(1, obs.exposureCount) };
    });
  });
  return recalculate({ ...base, scores, evidence }, now);
}

const TEXT_SIGNALS: Array<{ path: LifePathId; amount: number; regex: RegExp }> = [
  // JavaScript's classic word boundary is ASCII-only, so it does not match
  // after Polish letters such as the final "ę" in "palę". Explicit
  // whitespace/punctuation boundaries keep the Polish signal reliable.
  { path: 'stoner', amount: 9, regex: /(?:^|[\s.,!?])(?:palę|pale|jaram|zjarałem|zjaralem|zapaliłem|zapilem|smoke(?:d)? weed|smoke(?:d)? cannabis|got high|i(?:'m| am) high)(?=$|[\s.,!?])/i },
  { path: 'stoner', amount: 6, regex: /(?:^|[\s.,!?])(?:(?:idę|ide|chcę|chce|zamierzam)\s+)?(?:zapalić|zapalic)\s+(?:blanta|jointa|skręta|skreta|zioło|ziolo|marihuanę|marihuane)(?=$|[\s.,!?])/i },
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

export function evolveLifePath(state: GameState, userText: string, now = authoritativeNow()): GameState {
  if (!state.development.hatched) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const evidence = { ...current.evidence };
  const elapsedDays = clamp((now - current.lastUpdated) / 86_400_000, 0, 30);
  if (elapsedDays > 0.5) {
    LIFE_PATH_IDS.forEach(id => {
      scores[id] = clamp(scores[id] - elapsedDays * (HARMFUL_PATHS.has(id) ? 0.55 : 0.2));
    });
  }

  const mentioned = new Set<LifePathId>();
  TEXT_SIGNALS.forEach(signal => {
    if (!signal.regex.test(userText)) return;
    addScore(scores, signal.path, signal.amount * 0.06);
    mentioned.add(signal.path);
  });

  const parsed = parseUserStatement(userText);
  if (parsed) {
    applyObservedBehaviour(scores, {
      action: parsed.action ?? '',
      target: parsed.target ?? '',
      behaviourType: parsed.behaviourType ?? 'other',
      exposureCount: 1,
      perceivedNegativeOutcome: parsed.perceivedNegativeOutcome ?? 0,
    }, 0.06).forEach(id => mentioned.add(id));
  }

  mentioned.forEach(id => {
    evidence[id] = { ...evidence[id], userMentions: evidence[id].userMentions + 1 };
  });

  // A report, suggestion, or repeated topic from the player remains evidence
  // about the player. It can tempt or inform, but never becomes the creature's
  // own recovery, preference, or identity signal by itself.
  const nextPath = recalculate({ ...current, scores, evidence }, now);
  return { ...state, lifePath: nextPath };
}

type CreaturePathSignal = 'curiosity' | 'preference' | 'choice' | 'rejection';

const PATH_TOPIC_PATTERNS: Record<LifePathId, RegExp> = {
  stoner: /(?:weed|cannabis|\bpot\b|joint|blunt|\bhigh\b|zioł|ziol|marihuan|skręt|skret|blant|palić|palic|jarać|jarac)/i,
  party_animal: /\b(?:party|club|rave|afterparty|imprez|klub|balang)\b/i,
  alcoholic: /\b(?:alcohol|beer|wine|vodka|drunk|drink|alkohol|piw|win|wódk|wodk|pijan)\b/i,
  gymbro: /\b(?:gym|workout|lifting|training|protein|siłown|silown|trening|ćwicz|cwicz|białk|bialk)\b/i,
  workaholic: /\b(?:overwork|overtime|work late|always work|nadgodzin|pracować po|pracowac po|ciągle prac|ciagle prac)\b/i,
  doomer: /\b(?:nothing matters|no point|doomed|hopeless|bez sensu|nie ma sensu|beznadziej|wszystko przepad)\b/i,
  degen: /\b(?:gambl|casino|betting|all in|leverage|memecoin|hazard|kasyn|obstaw|krypto)\b/i,
  gamer: /\b(?:game|games|gaming|ranked|quest|raid|playstation|xbox|gry|grę|gre|gram|granie|konsol)\b/i,
  conspiracist: /\b(?:conspir|they are hiding|government lies|spisek|spisk|ukrywają|ukrywaja|rząd kłamie|rzad klamie)\b/i,
  caretaker: /\b(?:care for|look after|help someone|caretaking|opiekuj|pomagać|pomagac|pomagam|wspierać|wspierac)\b/i,
  monk: /\b(?:meditat|mindful|inner peace|silence|medyt|uważno|uwazno|wewnętrzny spokój|wewnetrzny spokoj|cisz)\b/i,
  rebel: /\b(?:break the rules|disobey|rebel|won't obey|złamać zasady|zlamac zasady|nie słuchać|nie sluchac|bunt|olewam zasady)\b/i,
};

function creatureSignalFromClause(clause: string): CreaturePathSignal | null {
  if (/(?:\bi\s+(?:do not|don't|never|refuse to|won't)\b|\b(?:not for me|i dislike|i hate|i would rather not)\b|nie chcę|nie chce|nie lubię|nie lubie|odmawiam|nigdy nie|nie będę|nie bede|wolę nie|wole nie|to nie dla mnie|nienawidzę|nienawidze)/i.test(clause)) return 'rejection';
  if (/(?:\b(?:i choose|i decided|i keep|i am going to|i'm going to|i will|my choice)\b|wybieram|postanawiam|zdecydowałem|zdecydowalem|zdecydowałam|zdecydowalam|będę|bede|robię to|robie to)/i.test(clause)) return 'choice';
  if (/(?:\b(?:i like|i love|i enjoy|i prefer|i want|my favourite|my favorite)\b|lubię|lubie|uwielbiam|wolę|wole|chcę|chce|to moje ulubione)/i.test(clause)) return 'preference';
  if (/(?:\b(?:i wonder|i am curious|i'm curious|interesting|what if)\b|ciekawi mnie|jestem ciekaw|jestem ciekawa|zastanawiam się|zastanawiam sie|interesujące|interesujace|co jeśli|co jesli|\?)/i.test(clause)) return 'curiosity';
  return null;
}

function recordPathEvidence(previous: LifePathEvidence, signal: CreaturePathSignal, now: number): LifePathEvidence {
  if (signal === 'rejection') return {
    ...previous,
    creatureRejections: previous.creatureRejections + 1,
    lastNegativeAt: now,
  };
  if (signal === 'curiosity') return {
    ...previous,
    creatureCuriosities: previous.creatureCuriosities + 1,
  };
  return {
    ...previous,
    creaturePreferences: previous.creaturePreferences + (signal === 'preference' ? 1 : 0),
    creatureChoices: previous.creatureChoices + (signal === 'choice' ? 1 : 0),
    firstPositiveAt: previous.firstPositiveAt ?? now,
    lastPositiveAt: now,
  };
}

/** Records only the creature's own expressed stance, after its reply exists. */
export function evolveLifePathFromCreatureStatement(state: GameState, text: string, now = authoritativeNow()): GameState {
  if (!state.development.hatched || !text.trim()) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const evidence = { ...current.evidence };
  const clauses = text.split(/(?:[.!?;\n]+|\bbut\b|\bhowever\b|\bale\b|\bjednak\b)/i).map(value => value.trim()).filter(Boolean);

  clauses.forEach(clause => {
    const signal = creatureSignalFromClause(clause);
    if (!signal) return;
    LIFE_PATH_IDS.forEach(id => {
      if (!PATH_TOPIC_PATTERNS[id].test(clause)) return;
      evidence[id] = recordPathEvidence(evidence[id], signal, now);
      if (signal === 'rejection') addScore(scores, id, -12);
      else if (signal === 'choice') addScore(scores, id, 8);
      else if (signal === 'preference') addScore(scores, id, 7);
      else addScore(scores, id, 0.2);
    });
  });

  const rejectedHarmful = LIFE_PATH_IDS.some(id => HARMFUL_PATHS.has(id) && evidence[id].lastNegativeAt === now);
  const recovery = rejectedHarmful ? clamp(current.recovery + 2) : current.recovery;
  return { ...state, lifePath: recalculate({ ...current, scores, evidence, recovery }, now, rejectedHarmful ? 'Chose distance from an old pattern.' : undefined) };
}

/** Converts a completed imitation attempt into the creature's own evidence. */
export function evolveLifePathFromImitation(state: GameState, observationId: string, now = authoritativeNow()): GameState {
  const observation = state.socialLearning.observations.find(item => item.id === observationId);
  const imitation = state.socialLearning.imitated.find(item => item.observedId === observationId);
  if (!observation || !imitation) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const evidence = { ...current.evidence };
  const potential = { ...scores };
  const touched = applyObservedBehaviour(potential, observation);
  touched.forEach(id => {
    const rawAmount = Math.max(1, potential[id] - scores[id]);
    if (imitation.rejected || observation.creatureOpinion === 'disliked') {
      addScore(scores, id, -Math.max(8, rawAmount));
      evidence[id] = recordPathEvidence(evidence[id], 'rejection', now);
    } else if (observation.creatureOpinion === 'liked') {
      addScore(scores, id, rawAmount * 1.5);
      evidence[id] = recordPathEvidence(evidence[id], 'preference', now);
    } else {
      addScore(scores, id, rawAmount * 0.6);
      evidence[id] = recordPathEvidence(evidence[id], 'choice', now);
    }
  });
  return { ...state, lifePath: recalculate({ ...current, scores, evidence }, now) };
}

const OBJECT_EFFECTS: Partial<Record<ObjectType, Partial<Record<LifePathId, number>>>> = {
  ball: { gymbro: 2.2, party_animal: 0.6 },
  blanket: { stoner: 1.2, doomer: 0.6, monk: 0.8 },
  paper: { workaholic: 1.1, conspiracist: 0.7 },
  pencil: { workaholic: 1.2, conspiracist: 0.8 },
  box: { gamer: 0.8, conspiracist: 0.8, rebel: 0.4 },
  cushion: { stoner: 0.6, doomer: 0.5, monk: 0.6 },
  brush: { caretaker: 0.8, gymbro: 0.4 },
  jingle_toy: { party_animal: 0.8, gymbro: 0.4 },
  stone: { monk: 1.2, doomer: 0.4 },
  mirror: { party_animal: 1.1, gymbro: 0.7, doomer: 0.5 },
  broccoli: { gymbro: 1.2, monk: 0.5 },
  apple: { caretaker: 0.5, gymbro: 0.7 },
};

export function evolveLifePathFromObject(state: GameState, type: ObjectType, outcome: ObjectReactionOutcome, now = authoritativeNow()): GameState {
  const effects = OBJECT_EFFECTS[type];
  if (!effects || !state.development.hatched) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const evidence = { ...current.evidence };
  Object.entries(effects).forEach(([rawId, rawAmount]) => {
    const id = rawId as LifePathId;
    const amount = rawAmount ?? 0;
    if (outcome === 'avoid') {
      addScore(scores, id, -Math.max(3, amount * 1.5));
      evidence[id] = recordPathEvidence(evidence[id], 'rejection', now);
    } else if (outcome === 'love') {
      addScore(scores, id, amount * 1.5);
      evidence[id] = recordPathEvidence(evidence[id], 'preference', now);
    } else if (outcome === 'enjoy') {
      addScore(scores, id, amount);
      evidence[id] = recordPathEvidence(evidence[id], 'choice', now);
    } else if (outcome === 'curious') {
      addScore(scores, id, amount * 0.15);
      evidence[id] = recordPathEvidence(evidence[id], 'curiosity', now);
    }
  });
  return { ...state, lifePath: recalculate({ ...current, scores, evidence }, now) };
}

type MomentTemplate = Omit<DailyMoment, 'id' | 'day'> & { when?: 'night_life' };

const MOMENT_TEMPLATES: MomentTemplate[] = [
  {
    title: '2:17 AM',
    titlePl: '2:17 w nocy',
    when: 'night_life',
    prompt: 'The room is quiet, but the mind is not. What should happen next?',
    promptPl: 'W pokoju jest cicho, ale w głowie nie. Co wydarzy się dalej?',
    choices: [
      { id: 'queue', label: 'One more game', labelPl: 'Jeszcze jedna gra', result: 'The night became another level.', resultPl: 'Noc zamieniła się w kolejny poziom.', pathEffects: { gamer: 6, doomer: 2 } },
      { id: 'breathe', label: 'Sit with the silence', labelPl: 'Posiedzieć w ciszy', result: 'The silence stopped feeling empty.', resultPl: 'Cisza przestała wydawać się pusta.', pathEffects: { monk: 6 }, recoveryEffect: 2 },
      { id: 'message', label: 'Message somebody', labelPl: 'Napisać do kogoś', result: 'A small connection outlived the hour.', resultPl: 'Mała więź przetrwała tę godzinę.', pathEffects: { caretaker: 3, party_animal: 3 }, bondEffect: 2 },
    ],
  },
  {
    title: 'The Easy Bet',
    titlePl: 'Łatwy zakład',
    prompt: 'A glowing chart promises that one reckless move could change everything.',
    promptPl: 'Świecący wykres obiecuje, że jeden lekkomyślny ruch może zmienić wszystko.',
    choices: [
      { id: 'all-in', label: 'All in', labelPl: 'Postawić wszystko', result: 'For a moment, risk felt exactly like destiny.', resultPl: 'Przez chwilę ryzyko brzmiało dokładnie jak przeznaczenie.', pathEffects: { degen: 8, rebel: 2 } },
      { id: 'study', label: 'Study the pattern', labelPl: 'Zbadać wzorzec', result: 'Suspicion replaced excitement.', resultPl: 'Podejrzliwość zastąpiła ekscytację.', pathEffects: { conspiracist: 5, workaholic: 2 } },
      { id: 'close', label: 'Close it', labelPl: 'Zamknąć wykres', result: 'Walking away felt strangely powerful.', resultPl: 'Odejście dało zaskakujące poczucie siły.', pathEffects: { monk: 4 }, recoveryEffect: 5 },
    ],
  },
  {
    title: 'Someone Needs You',
    titlePl: 'Ktoś cię potrzebuje',
    prompt: 'A tired voice asks for help at the worst possible time.',
    promptPl: 'Zmęczony głos prosi o pomoc w najgorszym możliwym momencie.',
    choices: [
      { id: 'stay', label: 'Stay with them', labelPl: 'Zostać z tą osobą', result: 'Nothing was fixed, but nobody was alone.', resultPl: 'Nic się nie naprawiło, ale nikt nie został sam.', pathEffects: { caretaker: 7 }, bondEffect: 3 },
      { id: 'solve', label: 'Make a plan', labelPl: 'Ułożyć plan', result: 'The problem became a list.', resultPl: 'Problem zamienił się w listę.', pathEffects: { workaholic: 5, caretaker: 2 } },
      { id: 'escape', label: 'Pretend not to notice', labelPl: 'Udawać, że się nie zauważyło', result: 'The room became quieter and heavier.', resultPl: 'W pokoju zrobiło się ciszej i ciężej.', pathEffects: { doomer: 5, rebel: 2 }, bondEffect: -2 },
    ],
  },
  {
    title: 'The Bottle',
    titlePl: 'Butelka',
    when: 'night_life',
    prompt: 'Something left from a party catches the light. It carries a story and a warning.',
    promptPl: 'Pozostałość po imprezie łapie światło. Niesie historię i ostrzeżenie.',
    choices: [
      { id: 'drink', label: 'Open it', labelPl: 'Otworzyć ją', result: 'Warmth arrived first. The cost waited outside.', resultPl: 'Najpierw przyszło ciepło. Cena czekała za drzwiami.', pathEffects: { alcoholic: 8, party_animal: 3 } },
      { id: 'keep', label: 'Save it for later', labelPl: 'Zostawić na później', result: 'The decision was delayed, not removed.', resultPl: 'Decyzja została odłożona, nie usunięta.', pathEffects: { alcoholic: 3, doomer: 2 } },
      { id: 'pour', label: 'Pour it out', labelPl: 'Wylać zawartość', result: 'The smell disappeared before the memory did.', resultPl: 'Zapach zniknął szybciej niż wspomnienie.', pathEffects: { monk: 3 }, recoveryEffect: 9 },
    ],
  },
  {
    title: 'Room Archaeology',
    titlePl: 'Archeologia pokoju',
    prompt: 'The mess has developed layers. It is becoming either a problem or a culture.',
    promptPl: 'Bałagan ma już warstwy. Staje się problemem albo kulturą.',
    choices: [
      { id: 'clean', label: 'Reset the room', labelPl: 'Przywrócić porządek', result: 'Order made the room feel larger.', resultPl: 'Porządek sprawił, że pokój wydał się większy.', pathEffects: { monk: 4, workaholic: 3 } },
      { id: 'nest', label: 'Make it comfortable', labelPl: 'Urządzić wygodne gniazdo', result: 'The mess became a nest with plausible deniability.', resultPl: 'Bałagan zamienił się w gniazdo, które można było uznać za zamierzone.', pathEffects: { stoner: 6, gamer: 2 } },
      { id: 'art', label: 'Call it an installation', labelPl: 'Nazwać to instalacją', result: 'A refusal became an aesthetic.', resultPl: 'Odmowa stała się estetyką.', pathEffects: { rebel: 5, party_animal: 2 } },
    ],
  },
  {
    title: 'Mirror Challenge',
    titlePl: 'Wyzwanie lustra',
    prompt: 'The reflection asks a rude question: what are you actually building?',
    promptPl: 'Odbicie zadaje bezczelne pytanie: co właściwie budujesz?',
    choices: [
      { id: 'body', label: 'A stronger body', labelPl: 'Silniejsze ciało', result: 'The floor became a training ground.', resultPl: 'Podłoga zamieniła się w miejsce treningu.', pathEffects: { gymbro: 7 } },
      { id: 'career', label: 'Something undeniable', labelPl: 'Coś niepodważalnego', result: 'Rest was postponed in the name of proof.', resultPl: 'Odpoczynek odłożono w imię dowodu.', pathEffects: { workaholic: 7 } },
      { id: 'nothing', label: 'Nothing. That is fine.', labelPl: 'Nic. I to jest w porządku.', result: 'The reflection lost the argument.', resultPl: 'Odbicie przegrało tę sprzeczkę.', pathEffects: { stoner: 4, monk: 3 } },
    ],
  },
  {
    title: 'The Thread',
    titlePl: 'Nić',
    prompt: 'Three unrelated details suddenly look related. How far should the theory go?',
    promptPl: 'Trzy niezwiązane szczegóły nagle wyglądają na połączone. Jak daleko pociągnąć tę teorię?',
    choices: [
      { id: 'wall', label: 'Build the evidence wall', labelPl: 'Zbudować ścianę dowodów', result: 'Soon every gap looked intentional.', resultPl: 'Wkrótce każda luka wyglądała na celową.', pathEffects: { conspiracist: 8 } },
      { id: 'ask', label: 'Ask what would disprove it', labelPl: 'Zapytać, co mogłoby temu zaprzeczyć', result: 'The theory survived, but certainty did not.', resultPl: 'Teoria przetrwała, ale pewność już nie.', pathEffects: { conspiracist: 3, monk: 3 } },
      { id: 'meme', label: 'Turn it into a meme', labelPl: 'Zrobić z tego mem', result: 'The mystery became funnier than it was frightening.', resultPl: 'Tajemnica stała się zabawniejsza niż straszna.', pathEffects: { gamer: 3, stoner: 3 } },
    ],
  },
  {
    title: 'No Invitation',
    titlePl: 'Bez zaproszenia',
    when: 'night_life',
    prompt: 'Everyone seems to be somewhere else tonight.',
    promptPl: 'Wygląda na to, że dziś wieczorem wszyscy są gdzieś indziej.',
    choices: [
      { id: 'go', label: 'Find the noise', labelPl: 'Poszukać gwaru', result: 'A stranger became a story before sunrise.', resultPl: 'Przed wschodem słońca nieznajomy stał się historią.', pathEffects: { party_animal: 7 } },
      { id: 'stay', label: 'Stay home and play', labelPl: 'Zostać w domu i pograć', result: 'The lobby was full even if the room was not.', resultPl: 'Lobby było pełne, nawet jeśli pokój nie.', pathEffects: { gamer: 6 } },
      { id: 'feel', label: 'Let it hurt', labelPl: 'Pozwolić sobie to poczuć', result: 'Loneliness became information instead of an enemy.', resultPl: 'Samotność stała się informacją zamiast wrogiem.', pathEffects: { doomer: 3, monk: 3 }, recoveryEffect: 2 },
    ],
  },
];

function hydrateDailyMoment(moment: DailyMoment | null): DailyMoment | null {
  if (!moment) return null;
  const template = MOMENT_TEMPLATES.find(candidate => candidate.title === moment.title)
    ?? MOMENT_TEMPLATES.find(candidate => candidate.choices.some(choice => moment.choices.some(saved => saved.id === choice.id)));
  if (!template) return moment;
  return {
    ...moment,
    titlePl: moment.titlePl ?? template.titlePl,
    promptPl: moment.promptPl ?? template.promptPl,
    choices: moment.choices.map(saved => {
      const authored = template.choices.find(choice => choice.id === saved.id);
      return authored ? {
        ...saved,
        labelPl: saved.labelPl ?? authored.labelPl,
        resultPl: saved.resultPl ?? authored.resultPl,
      } : saved;
    }),
  };
}

export function ensureDailyMoment(state: GameState, now = authoritativeNow()): GameState {
  if (!state.development.hatched || state.development.cognitiveLevel < 12) return state;
  if (state.sleepState === 'sleeping') return state;
  const schedule = getRestSchedule(state.lifePath);
  if (isCreatureRestPhase(getTimeOfDay(now, state.world), schedule)) return state;
  const path = state.lifePath;
  if (path.pendingMoment) return state;
  const day = Math.max(1, Math.floor(state.development.chronologicalAge / 86_400_000) + 1);
  if (path.lastDailyMomentDay >= day) return state;
  const pool = schedule === 'nocturnal'
    ? MOMENT_TEMPLATES
    : MOMENT_TEMPLATES.filter(template => template.when !== 'night_life');
  const primaryIndex = path.primary ? LIFE_PATH_IDS.indexOf(path.primary) : 0;
  const index = Math.abs(state.identity.seed + day * 31 + primaryIndex * 17) % pool.length;
  const template = pool[index];
  const { when: _when, ...authored } = template;
  const pendingMoment: DailyMoment = { ...authored, id: `moment-${day}-${index}`, day };
  if (path.resolvedMomentIds.includes(pendingMoment.id)) {
    return { ...state, lifePath: { ...path, lastDailyMomentDay: day } };
  }
  return { ...state, lifePath: { ...path, pendingMoment } };
}

export function resolveDailyMoment(state: GameState, choiceId: string, now = authoritativeNow()): GameState {
  const moment = state.lifePath?.pendingMoment;
  if (!moment) return state;
  const choice = moment.choices.find(item => item.id === choiceId);
  if (!choice) return state;
  const current = migrateLifePathState(state.lifePath, state.personality, now);
  const scores = { ...current.scores };
  const evidence = { ...current.evidence };
  Object.entries(choice.pathEffects).forEach(([rawId, amount]) => {
    const id = rawId as LifePathId;
    addScore(scores, id, amount ?? 0);
    evidence[id] = recordPathEvidence(evidence[id], 'choice', now);
  });
  const recovery = clamp(current.recovery + (choice.recoveryEffect ?? 0));
  const nextPath = recalculate({
    ...current,
    scores,
    evidence,
    recovery,
    pendingMoment: null,
    lastDailyMomentDay: moment.day,
    resolvedMomentIds: [...current.resolvedMomentIds, moment.id].slice(-60),
  }, now, state.conversation.language === 'pl' ? (choice.resultPl ?? choice.result) : choice.result);
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
      content: state.conversation.language === 'pl'
        ? `${moment.titlePl ?? moment.title}: ${choice.resultPl ?? choice.result}`
        : `${moment.title}: ${choice.result}`,
      importance: 7,
      emotionalValence: bondDelta > 0 ? 0.35 : bondDelta < 0 ? -0.35 : 0,
      tags: ['daily-moment', 'choice', nextPath.primary ?? 'unwritten'],
      mentioned: false,
      understood: true,
      compressed: false,
    }].slice(-200),
  };
}

export function getLifePathTitle(state: Pick<GameState, 'lifePath' | 'personality'>, language: 'en' | 'pl' = 'en'): string {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return titleFor(path.primary, path.secondary, path.phase, path.recovery, language);
}

export function getLifePathDescription(state: Pick<GameState, 'lifePath' | 'personality'>, language: 'en' | 'pl' = 'en'): string {
  const path = migrateLifePathState(state.lifePath, state.personality);
  if (!path.primary) return language === 'pl' ? 'Żaden sposób życia nie utrwalił się jeszcze w rolę.' : 'No life has hardened into a role yet.';
  if (path.phase === 'recovering') return language === 'pl'
    ? `Dawny wzorzec „${LIFE_PATHS[path.primary].labelPl.toLocaleLowerCase('pl-PL')}” wciąż jest widoczny, ale nie kieruje już każdą decyzją.`
    : `The old ${LIFE_PATHS[path.primary].label.toLowerCase()} pattern is still visible, but it no longer makes every decision.`;
  if (path.secondary) return language === 'pl'
    ? `${LIFE_PATHS[path.primary].descriptionPl} ${LIFE_PATHS[path.secondary].descriptionPl}`
    : `${LIFE_PATHS[path.primary].description} ${LIFE_PATHS[path.secondary].description}`;
  return language === 'pl' ? LIFE_PATHS[path.primary].descriptionPl : LIFE_PATHS[path.primary].description;
}

export function getLifePathClues(state: Pick<GameState, 'lifePath' | 'personality'>, count = 3, language: 'en' | 'pl' = 'en'): string[] {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return LIFE_PATH_IDS
    .map(id => ({ id, score: path.scores[id] }))
    .filter(item => isVisibleDirection(item.score, path.evidence[item.id]))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ id, score }) => language === 'pl'
      ? score >= 45
        ? `${LIFE_PATHS[id].labelPl}: ${LIFE_PATHS[id].costPl}`
        : `Skłania się ku drodze „${LIFE_PATHS[id].labelPl.toLocaleLowerCase('pl-PL')}”: ${LIFE_PATHS[id].giftPl}`
      : score >= 45
        ? `${LIFE_PATHS[id].label}: ${LIFE_PATHS[id].cost}`
        : `Leaning ${LIFE_PATHS[id].label.toLowerCase()}: ${LIFE_PATHS[id].gift}`);
}

export function getRankedLifePaths(state: Pick<GameState, 'lifePath' | 'personality'>, count = 4, language: 'en' | 'pl' = 'en') {
  const path = migrateLifePathState(state.lifePath, state.personality);
  return LIFE_PATH_IDS
    .filter(id => isVisibleDirection(path.scores[id], path.evidence[id]))
    .map(id => ({ id, label: language === 'pl' ? LIFE_PATHS[id].labelPl : LIFE_PATHS[id].label, score: path.scores[id] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

const NOCTURNAL_PATHS = new Set<LifePathId>(['party_animal', 'alcoholic', 'degen']);

/**
 * Their clock, not the player's. Ordinary lives follow the sun. A settled
 * night life (party, drink, chase) inverts: sleep through the day, wake for night.
 * Recovery and early leanings stay diurnal. Visit hours never enter this.
 */
export function getRestSchedule(path: LifePathState): 'diurnal' | 'nocturnal' {
  if (path.phase === 'unformed' || path.phase === 'leaning' || path.phase === 'recovering') return 'diurnal';
  const nightPrimary = Boolean(path.primary && NOCTURNAL_PATHS.has(path.primary) && path.scores[path.primary] >= 45);
  const nightSecondary = Boolean(path.secondary && NOCTURNAL_PATHS.has(path.secondary) && path.scores[path.secondary] >= 45);
  return nightPrimary || nightSecondary ? 'nocturnal' : 'diurnal';
}

/** A portrait of their clock, not a score. */
export function getLivedClockNote(state: Pick<GameState, 'lifePath' | 'personality'>, language: 'en' | 'pl' = 'en'): string {
  if (getRestSchedule(state.lifePath) === 'nocturnal') {
    return language === 'pl'
      ? 'Noc jest jego dniem. Śpi, kiedy świeci słońce.'
      : 'Night is when it is most itself. It sleeps through the sun.';
  }
  return language === 'pl'
    ? 'Żyje dniem i odpoczywa, kiedy zapada jego noc.'
    : 'It lives by day and rests when its night comes.';
}

export function getLifePathPhaseLabel(phase: LifePathPhase, language: 'en' | 'pl' = 'en') {
  const labels: Record<LifePathPhase, { en: string; pl: string }> = {
    unformed: { en: 'still forming', pl: 'wciąż się kształtuje' },
    leaning: { en: 'leaning', pl: 'skłania się' },
    committed: { en: 'settled', pl: 'utrwalony' },
    embodied: { en: 'embodied', pl: 'ucieleśniony' },
    recovering: { en: 'changing', pl: 'zmienia się' },
  };
  return labels[phase][language];
}

export function getLifePathMilestoneTitle(item: LifePathMilestone, language: 'en' | 'pl' = 'en') {
  return titleFor(item.primary, item.secondary, item.phase, 0, language);
}

export function getLifePathMilestoneDetail(item: LifePathMilestone, language: 'en' | 'pl' = 'en') {
  if (language === 'en') return item.detail;
  if (item.detail === 'The path became uncertain again.') return 'Droga znów stała się niepewna.';
  if (/^Began to look like /i.test(item.detail)) return `Zaczął wyraźnie przypominać: ${getLifePathMilestoneTitle(item, 'pl')}.`;
  if (item.detail === 'Chose distance from an old pattern.') return 'Wybrał dystans wobec dawnego wzorca.';
  if (item.detail === 'Chose change over repetition.') return 'Wybrał zmianę zamiast powtórzenia.';
  return item.detail;
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
