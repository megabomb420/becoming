import { GameState, HealthStage, HealthState, Memory } from '../types';

// Health is one quiet axis on the existing physiology heartbeat. There is no
// second timer, no visible meter, no random death. The body only changes when
// the body state is sustained: prolonged hunger/dehydration, poor rest, very
// poor hygiene, a persistent combination of several bad needs, or an active
// illness that keeps getting worse.
//
// The same causal function drives active play (App's existing needs cadence)
// and the offline pass, using the same real elapsed time in both. The offline
// "effective minutes" curve stays a needs-decay-only lever; the body suffers
// for as long as it is actually in a bad state, which is what makes neglect a
// real but slow road.

export const HEALTH_STAGE_ORDER: HealthStage[] = ['healthy', 'strained', 'ill', 'critical'];

// Per-need pressure ramps. Each returns 0 when the need is comfortably met and
// approaches 1 as the body is genuinely deprived (the offline floors sit deep
// inside these ramps, so a long-neglected body reads as a real bad state).
function hungerPressure(value: number): number {
  return value >= 45 ? 0 : Math.min(1, (45 - value) / 30);
}
function hydrationPressure(value: number): number {
  return value >= 42 ? 0 : Math.min(1, (42 - value) / 28);
}
function energyPressure(value: number): number {
  return value >= 38 ? 0 : Math.min(1, (38 - value) / 24);
}
function hygienePressure(value: number): number {
  return value >= 36 ? 0 : Math.min(1, (36 - value) / 26);
}

const PRESSURE_WEIGHTS = { hunger: 0.3, hydration: 0.3, energy: 0.22, hygiene: 0.18 } as const;

export function clampPressure(value: number): number {
  return Math.max(0, Math.min(1.2, value));
}

/**
 * Current body pressure from the creature's needs (0..1.2). Exported for the
 * deterministic checks so the causal model can be asserted directly.
 */
export function bodyPressure(state: GameState): number {
  const needs = state.needs;
  return clampPressure(
    hungerPressure(needs.hunger) * PRESSURE_WEIGHTS.hunger
    + hydrationPressure(needs.hydration) * PRESSURE_WEIGHTS.hydration
    + energyPressure(needs.energy) * PRESSURE_WEIGHTS.energy
    + hygienePressure(needs.hygiene) * PRESSURE_WEIGHTS.hygiene,
  );
}

// Wellness drains only above a real bad-state floor, and recovers only when
// conditions are genuinely good. The rates are slow on purpose: a short or
// ordinary absence must never dent health (wellness loses ~6/day at the worst
// offline floors, so a two-day absence stays clearly healthy), while weeks of
// total neglect or days of full crisis are a genuine, visible road to death.
const WELLNESS_DRAIN_FLOOR = 0.25;
const WELLNESS_DRAIN_RATE = 0.0108; // per minute at pressure 1 above the floor
const WELLNESS_RECOVERY_CEILING = 0.18;
const WELLNESS_RECOVERY_RATE = 0.03; // per minute below the ceiling
const ILLNESS_PRESSURE_FEEDBACK = 0.3; // an ill body adds pressure to wellness loss

// Illness accumulates only under severe, sustained pressure (a single bad need
// or one accident never crosses it) and decays slowly under good conditions,
// so an illness persists over real time and recovery is a real arc.
const ILLNESS_ACCUMULATION_TRIGGER = 0.34;
const ILLNESS_ACCUMULATION_RATE = 0.0106; // per minute of pressure above the trigger
const ILLNESS_DECAY_CEILING = 0.22;
const ILLNESS_DECAY_RATE = 0.022; // per minute below the ceiling

export function deriveHealthStage(wellness: number, illness: number): HealthStage {
  if (wellness <= 18 || (illness >= 80 && wellness <= 45)) return 'critical';
  if (wellness <= 40 || illness >= 45) return 'ill';
  if (wellness <= 68 || illness >= 22) return 'strained';
  return 'healthy';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createHealthState(now: number): HealthState {
  return {
    status: 'alive',
    stage: 'healthy',
    wellness: 100,
    illness: 0,
    illnessSince: null,
    lastUpdated: now,
    diedAt: null,
  };
}

/**
 * Existing v0.14.4 saves have no health data and must start alive and healthy;
 * they must never become retroactively ill. A backup round-trip of a real
 * health state (alive or dead) is preserved and re-validated.
 */
export function migrateHealthState(value: unknown, savedAt: number): HealthState {
  const raw = (value ?? {}) as Partial<HealthState>;
  if (raw.status === 'dead') {
    const wellness = clamp(Number.isFinite(raw.wellness) ? raw.wellness as number : 0, 0, 100);
    const illness = clamp(Number.isFinite(raw.illness) ? raw.illness as number : 100, 0, 100);
    const lastUpdated = Number.isFinite(raw.lastUpdated) ? raw.lastUpdated as number : savedAt;
    return {
      status: 'dead',
      stage: 'critical',
      wellness,
      illness,
      illnessSince: Number.isFinite(raw.illnessSince) ? raw.illnessSince as number : null,
      lastUpdated,
      diedAt: Number.isFinite(raw.diedAt) ? raw.diedAt as number : lastUpdated,
    };
  }
  const hasRealValues = Number.isFinite(raw.wellness)
    && Number.isFinite(raw.illness)
    && Number.isFinite(raw.lastUpdated);
  if (!hasRealValues) {
    return createHealthState(savedAt);
  }
  const wellness = clamp(raw.wellness as number, 1, 100);
  const illness = clamp(raw.illness as number, 0, 100);
  return {
    status: 'alive',
    stage: deriveHealthStage(wellness, illness),
    wellness,
    illness,
    illnessSince: Number.isFinite(raw.illnessSince) ? raw.illnessSince as number : illness >= 22 ? savedAt : null,
    lastUpdated: raw.lastUpdated as number,
    diedAt: null,
  };
}

export function getHealthStage(state: GameState): HealthStage {
  return deriveHealthStage(state.health.wellness, state.health.illness);
}

export function getIllnessIntensity(state: GameState): number {
  return clamp(state.health.illness, 0, 100) / 100;
}

export function isDead(state: GameState): boolean {
  return state.health.status === 'dead';
}

function departureMemory(state: GameState, now: number): Memory {
  return {
    id: `mem-departure-${now}`,
    timestamp: now,
    content: 'the room fell quiet',
    importance: 10,
    emotionalValence: -0.4,
    tags: ['life', 'departure'],
    mentioned: false,
    understood: true,
    compressed: false,
  };
}

/**
 * The single health transition. Driven only by the existing physiology cadence
 * (App) and the offline pass — it owns no timer. Elapsed time is real time in
 * both modes, so active and offline progression use the exact same model.
 */
export function advanceHealth(state: GameState, now = Date.now()): GameState {
  if (state.development.stage === 'egg' || !state.development.hatched) return state;
  if (isDead(state)) return state;

  const from = Number.isFinite(state.health.lastUpdated)
    ? state.health.lastUpdated
    : Number.isFinite(state.needsUpdatedAt)
      ? state.needsUpdatedAt
      : state.lastSaved;
  const elapsedMinutes = Math.max(0, now - from) / 60_000;
  if (elapsedMinutes <= 0) return { ...state, health: { ...state.health, lastUpdated: now } };

  const pressure = bodyPressure(state);
  const illness = state.health.illness;
  const pressured = pressure + (illness / 100) * ILLNESS_PRESSURE_FEEDBACK;

  let wellness = state.health.wellness;
  if (pressured > WELLNESS_DRAIN_FLOOR) {
    wellness -= (pressured - WELLNESS_DRAIN_FLOOR) * WELLNESS_DRAIN_RATE * elapsedMinutes;
  } else if (pressure < WELLNESS_RECOVERY_CEILING) {
    wellness += (WELLNESS_RECOVERY_CEILING - pressure) * WELLNESS_RECOVERY_RATE * elapsedMinutes;
  }

  let nextIllness = illness;
  if (pressure > ILLNESS_ACCUMULATION_TRIGGER) {
    nextIllness += (pressure - ILLNESS_ACCUMULATION_TRIGGER) * ILLNESS_ACCUMULATION_RATE * elapsedMinutes;
  } else if (pressure < ILLNESS_DECAY_CEILING) {
    nextIllness -= (ILLNESS_DECAY_CEILING - pressure) * ILLNESS_DECAY_RATE * elapsedMinutes;
  }

  wellness = clamp(wellness, 0, 100);
  nextIllness = clamp(nextIllness, 0, 100);

  if (wellness <= 0) {
    return {
      ...state,
      health: {
        status: 'dead',
        stage: 'critical',
        wellness: 0,
        illness: nextIllness,
        illnessSince: state.health.illnessSince ?? (nextIllness >= 22 ? now : null),
        lastUpdated: now,
        diedAt: now,
      },
      memories: [...state.memories, departureMemory(state, now)].slice(-200),
      emotionalState: 'neutral',
      creatureBehavior: 'idle',
      currentActivity: null,
    };
  }

  return {
    ...state,
    health: {
      status: 'alive',
      stage: deriveHealthStage(wellness, nextIllness),
      wellness,
      illness: nextIllness,
      illnessSince: state.health.illnessSince ?? (nextIllness >= 22 ? now : null),
      lastUpdated: now,
      diedAt: null,
    },
  };
}

// === Qualitative visibility ===
// No raw values ever leave this module. The UI and the mind read bands only.

export type HealthBand = 'well' | 'under_the_weather' | 'unwell' | 'gravely_unwell';

export function getHealthBand(state: GameState): HealthBand {
  switch (getHealthStage(state)) {
    case 'healthy': return 'well';
    case 'strained': return 'under_the_weather';
    case 'ill': return 'unwell';
    case 'critical': return 'gravely_unwell';
  }
}

export interface HealthCue {
  icon: string;
  labelEn: string;
  labelPl: string;
  tone: 'notice' | 'attention';
}

export function getHealthCue(state: GameState): HealthCue | null {
  switch (getHealthStage(state)) {
    case 'healthy': return null;
    case 'strained': return {
      icon: '◌',
      labelEn: 'moves more slowly than usual',
      labelPl: 'rusza się wolniej niż zwykle',
      tone: 'notice',
    };
    case 'ill': return {
      icon: '◌',
      labelEn: 'is unwell and keeps to the warm spots',
      labelPl: 'jest chore i trzyma się ciepłych miejsc',
      tone: 'attention',
    };
    case 'critical': return {
      icon: '◌',
      labelEn: 'is very weak and barely lifts its head',
      labelPl: 'jest bardzo słabe i ledwo unosi głowę',
      tone: 'attention',
    };
  }
}

export function getHealthCareLine(state: GameState, polish: boolean): string | null {
  switch (getHealthStage(state)) {
    case 'healthy': return null;
    case 'strained': return polish
      ? 'Jego ciało wciąż dźwiga ostatnie ciężkie dni. Odpoczynek i regularne jedzenie pomogą.'
      : 'Its body is still carrying the last hard days. Rest and steady meals will help.';
    case 'ill': return polish
      ? 'Jest chore. Ciepło, cisza, jedzenie i woda pomogą mu wrócić do sił.'
      : 'It is unwell. Warmth, quiet, food and water will help it mend.';
    case 'critical': return polish
      ? 'Jest bardzo słabe. Potrzebuje teraz łagodnej, spokojnej opieki.'
      : 'It is very weak. It needs gentle, steady care now.';
  }
}

// === Behaviour effects of illness (all bounded, no meters) ===
// Illness makes the body cost more: appetite drops, energy drains faster and
// rests back slower, movement turns heavy, and self-care waits a little longer.

export function getAppetiteFactor(state: GameState): number {
  return 1 - getIllnessIntensity(state) * 0.4;
}

export function getMovementFatigue(state: GameState): number {
  return 1 + getIllnessIntensity(state) * 0.3;
}

export function getNeedRateFactor(state: GameState, key: 'hunger' | 'hydration' | 'energy' | 'hygiene', restoring: boolean): number {
  const illness = getIllnessIntensity(state);
  if (illness <= 0) return 1;
  if (restoring) return key === 'energy' ? 1 - illness * 0.25 : 1;
  return 1 + illness * 0.3;
}

export function getSelfCareThreshold(state: GameState, base: number): number {
  return base * (1 - getIllnessIntensity(state) * 0.35);
}
