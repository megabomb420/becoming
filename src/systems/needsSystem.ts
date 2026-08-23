import { GameState, Memory, Needs } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';

export type NeedKey = keyof Needs;
export type NeedUrgency = 'settled' | 'notice' | 'attention' | 'urgent';

export const NEED_ORDER: NeedKey[] = [
  'hunger',
  'hydration',
  'energy',
  'bladder',
  'bowel',
  'hygiene',
  'comfort',
  'stimulation',
  'social',
];

// Satisfaction lost per real-world minute while the app is active. The full
// range takes many hours (or days) to cross; a short visit never becomes a
// dashboard-maintenance session.
const AWAKE_RATES: Record<NeedKey, number> = {
  hunger: 0.08,
  hydration: 0.1,
  energy: 0.06,
  bladder: 0.075,
  bowel: 0.025,
  hygiene: 0.022,
  comfort: 0.025,
  stimulation: 0.05,
  social: 0.04,
};

// Negative values restore a need. Sleeping is useful, but it does not freeze
// the rest of the creature's body.
const SLEEP_RATES: Record<NeedKey, number> = {
  hunger: 0.035,
  hydration: 0.045,
  energy: -0.2,
  bladder: 0.04,
  bowel: 0.01,
  hygiene: 0.006,
  comfort: -0.03,
  stimulation: 0.006,
  social: 0.004,
};

const OFFLINE_FLOORS: Record<NeedKey, number> = {
  hunger: 20,
  hydration: 22,
  energy: 18,
  bladder: 16,
  bowel: 18,
  hygiene: 22,
  comfort: 24,
  stimulation: 20,
  social: 22,
};

export const NEED_URGENCY_THRESHOLDS = {
  urgent: 25,
  attention: 48,
  notice: 72,
} as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function personalityMultiplier(state: GameState, key: NeedKey) {
  if (key === 'hunger') return 0.9 + state.personality.impulsiveness / 500;
  if (key === 'energy') return state.personality.calmness > 60 ? 0.88 : 1.08;
  if (key === 'stimulation') return 0.78 + state.personality.curiosity / 230;
  if (key === 'social') return 0.68 + state.personality.sociability / 180;
  if (key === 'comfort') return 0.9 + state.personality.caution / 600;
  return 1;
}

// The creature changes while the player is away, but the curve flattens fast:
// eight absent hours count as 4.4 active hours, the next sixteen as 1.9, and
// very long absences add only a small logarithmic tail.
export function effectiveOfflineMinutes(realMinutes: number) {
  const safe = Math.max(0, realMinutes);
  const firstEightHours = Math.min(safe, 8 * 60) * 0.55;
  const nextSixteenHours = Math.min(Math.max(0, safe - 8 * 60), 16 * 60) * 0.12;
  const remainingHours = Math.max(0, safe - 24 * 60) / 60;
  const longAbsenceTail = 20 * Math.log1p(remainingHours / 24);
  return firstEightHours + nextSixteenHours + longAbsenceTail;
}

function applyRates(
  state: GameState,
  source: Needs,
  rates: Record<NeedKey, number>,
  minutes: number,
  offline: boolean,
) {
  const result = { ...source };
  for (const key of NEED_ORDER) {
    const rate = rates[key] * personalityMultiplier(state, key);
    const next = clamp(source[key] - rate * minutes);
    if (offline && rate > 0) {
      // Never make a need better just because it was already below the floor.
      result[key] = Math.max(Math.min(source[key], OFFLINE_FLOORS[key]), next);
    } else {
      result[key] = next;
    }
  }
  return result;
}

export function calculateNeeds(
  state: GameState,
  realMinutes: number,
  mode: 'active' | 'offline' = 'active',
  sleepingMinutes = state.sleepState === 'sleeping' ? realMinutes : 0,
): Needs {
  const elapsed = Math.max(0, realMinutes);
  const sleep = Math.max(0, Math.min(elapsed, sleepingMinutes));
  const awake = elapsed - sleep;
  const offline = mode === 'offline';
  const effectiveTotal = offline ? effectiveOfflineMinutes(elapsed) : elapsed;
  const sleepShare = elapsed > 0 ? sleep / elapsed : 0;
  const effectiveSleep = effectiveTotal * sleepShare;
  const effectiveAwake = effectiveTotal - effectiveSleep;
  const afterAwake = applyRates(state, state.needs, AWAKE_RATES, effectiveAwake, offline);
  return applyRates(state, afterAwake, SLEEP_RATES, effectiveSleep, offline);
}

// Kept for small callers and old tests. New runtime code should prefer
// advanceNeeds so elapsed time is recorded atomically with the values.
export function updateNeeds(state: GameState, deltaMinutes: number): Needs {
  return calculateNeeds(state, deltaMinutes, 'active');
}

export function advanceNeeds(
  state: GameState,
  now = Date.now(),
  mode: 'active' | 'offline' = 'active',
  sleepingMinutes?: number,
): GameState {
  const from = Number.isFinite(state.needsUpdatedAt) ? state.needsUpdatedAt : state.lastSaved;
  const elapsedMinutes = Math.max(0, now - from) / 60_000;
  if (elapsedMinutes <= 0) return state;
  return {
    ...state,
    needs: calculateNeeds(state, elapsedMinutes, mode, sleepingMinutes),
    needsUpdatedAt: now,
  };
}

export function getNeedUrgency(value: number): NeedUrgency {
  if (value < NEED_URGENCY_THRESHOLDS.urgent) return 'urgent';
  if (value < NEED_URGENCY_THRESHOLDS.attention) return 'attention';
  if (value < NEED_URGENCY_THRESHOLDS.notice) return 'notice';
  return 'settled';
}

const URGENCY_WEIGHT: Record<NeedUrgency, number> = {
  settled: 0,
  notice: 1,
  attention: 2,
  urgent: 3,
};

export function getDominantNeed(state: GameState, includeNotices = false): NeedKey | null {
  return NEED_ORDER.reduce<NeedKey | null>((best, key) => {
    const urgency = getNeedUrgency(state.needs[key]);
    if (urgency === 'settled' || (!includeNotices && urgency === 'notice')) return best;
    if (!best) return key;
    const bestUrgency = getNeedUrgency(state.needs[best]);
    if (URGENCY_WEIGHT[urgency] !== URGENCY_WEIGHT[bestUrgency]) {
      return URGENCY_WEIGHT[urgency] > URGENCY_WEIGHT[bestUrgency] ? key : best;
    }
    return state.needs[key] < state.needs[best] ? key : best;
  }, null);
}

interface NeedCopy {
  icon: string;
  name: [string, string];
  label: [string, string];
  action: [string, string];
  cues: Record<Exclude<NeedUrgency, 'settled'>, [string, string]>;
}

export const NEED_COPY: Record<NeedKey, NeedCopy> = {
  hunger: {
    icon: '◒', name: ['Food', 'Jedzenie'], label: ['Hungry', 'Głód'], action: ['Offer apple or broccoli', 'Podaj jabłko albo brokuł'],
    cues: { notice: ['glances toward food', 'zerka w stronę jedzenia'], attention: ['keeps looking for food', 'wyraźnie szuka jedzenia'], urgent: ['needs food now', 'potrzebuje teraz jedzenia'] },
  },
  hydration: {
    icon: '◇', name: ['Water', 'Picie'], label: ['Thirsty', 'Pragnienie'], action: ['Place and use the water bowl', 'Postaw i użyj miski z wodą'],
    cues: { notice: ['licks dry lips', 'oblizuje suche usta'], attention: ['searches for water', 'szuka wody'], urgent: ['needs water now', 'pilnie potrzebuje wody'] },
  },
  energy: {
    icon: '☾', name: ['Rest', 'Odpoczynek'], label: ['Tired', 'Zmęczenie'], action: ['Let them sleep; a blanket helps', 'Pozwól mu spać; koc pomaga'],
    cues: { notice: ['moves a little slower', 'rusza się nieco wolniej'], attention: ['yawns and droops', 'ziewa i przysypia'], urgent: ['can barely keep awake', 'ledwo utrzymuje oczy otwarte'] },
  },
  bladder: {
    icon: '·', name: ['Pee', 'Siku'], label: ['Needs to pee', 'Potrzeba siku'], action: ['Use the litter box', 'Użyj kuwety'],
    cues: { notice: ['shifts from foot to foot', 'przestępuje z nogi na nogę'], attention: ['circles near a corner', 'krąży przy kącie'], urgent: ['needs the toilet now', 'pilnie potrzebuje toalety'] },
  },
  bowel: {
    icon: '∿', name: ['Poop', 'Kupa'], label: ['Needs to poop', 'Potrzeba kupy'], action: ['Use the litter box', 'Użyj kuwety'],
    cues: { notice: ['pauses with a tense look', 'napina się i przystaje'], attention: ['keeps returning to a corner', 'wraca w stronę kąta'], urgent: ['needs the toilet now', 'pilnie potrzebuje toalety'] },
  },
  hygiene: {
    icon: '✦', name: ['Hygiene', 'Higiena'], label: ['Needs washing', 'Brudny'], action: ['Use the wash basin', 'Użyj miski do mycia'],
    cues: { notice: ['notices a smudge', 'zauważa na sobie plamkę'], attention: ['tries to clean its fur', 'próbuje wyczyścić futerko'], urgent: ['feels very grubby', 'czuje się bardzo brudno'] },
  },
  comfort: {
    icon: '⌁', name: ['Comfort', 'Komfort'], label: ['Unsettled', 'Niespokojny'], action: ['Stroke, hold, or offer the blanket', 'Pogłaszcz, przytul albo podaj koc'],
    cues: { notice: ['cannot quite settle', 'nie może się ułożyć'], attention: ['seeks a safer spot', 'szuka bezpieczniejszego miejsca'], urgent: ['needs reassurance', 'potrzebuje poczucia bezpieczeństwa'] },
  },
  stimulation: {
    icon: '○', name: ['Activity', 'Zajęcie'], label: ['Restless', 'Nuda'], action: ['Offer the ball, box, paper, or pencil', 'Podaj piłkę, pudełko, papier albo ołówek'],
    cues: { notice: ['watches the room for something new', 'wypatruje czegoś nowego'], attention: ['paces with restless energy', 'krąży niespokojnie po pokoju'], urgent: ['badly needs something to do', 'bardzo potrzebuje zajęcia'] },
  },
  social: {
    icon: '♡', name: ['Contact', 'Kontakt'], label: ['Needs contact', 'Potrzeba kontaktu'], action: ['Talk, stroke, or stay close', 'Porozmawiaj, pogłaszcz albo pobądź blisko'],
    cues: { notice: ['checks whether you are near', 'sprawdza, czy jesteś blisko'], attention: ['keeps trying to catch your eye', 'próbuje złapać twój wzrok'], urgent: ['really needs your company', 'bardzo potrzebuje twojej obecności'] },
  },
};

export function getNeedLabel(key: NeedKey, polish: boolean) {
  return NEED_COPY[key].label[polish ? 1 : 0];
}

export function getNeedName(key: NeedKey, polish: boolean) {
  return NEED_COPY[key].name[polish ? 1 : 0];
}

export function getNeedAction(key: NeedKey, polish: boolean) {
  return NEED_COPY[key].action[polish ? 1 : 0];
}

export function getNaturalNeedCue(state: GameState, polish: boolean, key = getDominantNeed(state, true)) {
  if (!key) return polish ? 'jest spokojny i obecny' : 'seems calm and present';
  const urgency = getNeedUrgency(state.needs[key]);
  if (urgency === 'settled') return polish ? 'jest spokojny i obecny' : 'seems calm and present';
  return NEED_COPY[key].cues[urgency][polish ? 1 : 0];
}

export function getVisibleNeedSignals(state: GameState, limit = 3) {
  return NEED_ORDER
    .map(key => ({ key, value: state.needs[key], urgency: getNeedUrgency(state.needs[key]), icon: NEED_COPY[key].icon }))
    .filter(item => item.urgency !== 'settled')
    .sort((a, b) => URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency] || a.value - b.value)
    .slice(0, limit);
}

export function getSleepBlocker(state: GameState): NeedKey | null {
  const physical: NeedKey[] = ['hydration', 'hunger', 'bladder', 'bowel'];
  return physical.find(key => getNeedUrgency(state.needs[key]) === 'urgent') ?? null;
}

export function applyNeedDelta(state: GameState, delta: Partial<Needs>, now = Date.now()): GameState {
  const current = advanceNeeds(state, now);
  const needs = { ...current.needs };
  for (const key of NEED_ORDER) {
    if (delta[key] !== undefined) needs[key] = clamp(needs[key] + delta[key]!);
  }
  return { ...current, needs, needsUpdatedAt: now };
}

function careMemory(state: GameState, content: string, tags: string[], now: number): Memory {
  return {
    id: `mem-${now}-${tags[0]}`,
    timestamp: now,
    content,
    importance: 4,
    emotionalValence: 0.5,
    tags,
    mentioned: false,
    understood: state.development.cognitiveLevel > 20,
    compressed: false,
  };
}

export function feedCreature(state: GameState, foodType: string, now = Date.now()): GameState {
  const hungry = state.needs.hunger < 48;
  let next = applyNeedDelta(state, {
    hunger: foodType === 'apple' ? 38 : 34,
    comfort: foodType === 'apple' ? 5 : 3,
    hydration: foodType === 'apple' ? 4 : -2,
    bowel: -7,
    hygiene: -2,
  }, now);
  if (hungry) {
    next = { ...next, memories: [...next.memories, careMemory(next, `ate ${foodType} when hungry`, ['food', 'satisfied'], now)].slice(-200) };
  }
  return next;
}

export function drinkCreature(state: GameState, now = Date.now()): GameState {
  return applyNeedDelta(state, { hydration: 46, bladder: -13, comfort: 2 }, now);
}

export function useToilet(state: GameState, now = Date.now()): GameState {
  return applyNeedDelta(state, { bladder: 100, bowel: 100, hygiene: -3, comfort: 4 }, now);
}

export function washCreature(state: GameState, now = Date.now()): GameState {
  return applyNeedDelta(state, { hygiene: 58, comfort: 6 }, now);
}

export function putToSleep(state: GameState, now = Date.now()): GameState {
  const current = advanceNeeds(state, now);
  return {
    ...current,
    sleepState: 'sleeping',
    currentActivity: 'sleeping',
    sleepStartTimestamp: now,
  };
}

export function wakeUp(state: GameState, now = Date.now()): GameState {
  const sleepStart = state.sleepStartTimestamp ?? state.needsUpdatedAt ?? state.lastSaved;
  const rested = advanceNeeds(state, now, 'active', state.currentActivity === 'sleeping' ? Math.max(0, now - sleepStart) / 60_000 : 0);
  const sleptDuration = state.currentActivity === 'sleeping' ? Math.max(0, now - sleepStart) : 0;
  const awakeState: GameState = {
    ...rested,
    sleepState: 'awake',
    currentActivity: null,
    sleepStartTimestamp: undefined,
  };
  return generateDreamAfterSleep(awakeState, sleptDuration, now);
}

export function touchCreature(state: GameState, touchType: 'tap' | 'stroke' | 'hold', now = Date.now()): GameState {
  const comfortBoost = touchType === 'stroke' ? 15 : touchType === 'hold' ? 20 : 5;
  const socialBoost = touchType === 'stroke' ? 10 : 5;
  let next = applyNeedDelta(state, { comfort: comfortBoost, social: socialBoost }, now);
  if (state.development.stage !== 'egg') {
    next = {
      ...next,
      memories: [...next.memories, {
        id: `mem-${now}-touch`, timestamp: now, content: `user ${touchType}ed creature`, importance: 3,
        emotionalValence: 0.4, tags: ['touch', 'social'], mentioned: false, understood: true, compressed: false,
      }].slice(-200),
    };
  }
  return next;
}
