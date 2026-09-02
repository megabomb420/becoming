import { authoritativeNow } from './authoritativeTime';
import { BondEventType, GameState, Memory, TouchBoundaryState } from '../types';

const WINDOW_MS = 12_000;
const OVERWHELMED_MS = 20_000;
const BOUNDARY_MEMORY_GAP_MS = 6 * 60 * 60_000;

export function createTouchBoundaryState(): TouchBoundaryState {
  return {
    windowStartedAt: 0,
    touchesInWindow: 0,
    overwhelmedUntil: 0,
    lastBoundaryAt: 0,
    boundariesShown: 0,
  };
}

export function migrateTouchBoundaryState(value: Partial<TouchBoundaryState> | null | undefined): TouchBoundaryState {
  const base = createTouchBoundaryState();
  if (!value) return base;
  return {
    windowStartedAt: Math.max(0, Number(value.windowStartedAt) || 0),
    touchesInWindow: Math.max(0, Math.min(20, Number(value.touchesInWindow) || 0)),
    overwhelmedUntil: Math.max(0, Number(value.overwhelmedUntil) || 0),
    lastBoundaryAt: Math.max(0, Number(value.lastBoundaryAt) || 0),
    boundariesShown: Math.max(0, Number(value.boundariesShown) || 0),
  };
}

export interface TouchBoundaryResult {
  state: GameState;
  accepted: boolean;
  label: string | null;
}

function touchLimit(state: GameState): number {
  const bondBase = state.bond.stage === 'bonded' ? 9 : state.bond.stage === 'close' ? 7 : state.bond.stage === 'familiar' ? 5 : 4;
  const independenceCost = state.personality.independence >= 72 ? 1 : 0;
  const affectionBonus = state.personality.affection >= 70 ? 1 : 0;
  return Math.max(3, bondBase - independenceCost + affectionBonus);
}

function boundaryLabel(state: GameState, startled: boolean): string {
  const polish = state.conversation.language === 'pl';
  if (startled) return polish ? 'cofa się od trzymania — jeszcze nie teraz' : 'pulls away from being held — not yet';
  return polish ? 'odsuwa się odrobinę i prosi o chwilę przestrzeni' : 'shifts back a little and asks for a moment of space';
}

function recordBoundary(state: GameState, boundary: TouchBoundaryState, now: number, startled: boolean): GameState {
  const shouldRemember = boundary.lastBoundaryAt === 0 || now - boundary.lastBoundaryAt >= BOUNDARY_MEMORY_GAP_MS;
  const nextBoundary = {
    ...boundary,
    overwhelmedUntil: now + (startled ? 8_000 : OVERWHELMED_MS),
    lastBoundaryAt: now,
    boundariesShown: boundary.boundariesShown + 1,
  };
  const memory: Memory | null = shouldRemember ? {
    id: `mem-boundary-${now}`,
    timestamp: now,
    content: startled ? 'showed that being held requires more trust' : 'asked for a little space after too much touch',
    importance: 6,
    emotionalValence: 0,
    tags: ['boundary', 'touch'],
    mentioned: false,
    understood: state.development.cognitiveLevel >= 20,
    compressed: false,
  } : null;
  return {
    ...state,
    touchBoundaries: nextBoundary,
    emotionalState: 'uncertain',
    memories: memory ? [...state.memories, memory].slice(-200) : state.memories,
  };
}

export function evaluateTouchBoundary(state: GameState, type: Extract<BondEventType, 'tap' | 'stroke' | 'hold'>, now = authoritativeNow()): TouchBoundaryResult {
  const saved = migrateTouchBoundaryState(state.touchBoundaries);
  const resetWindow = saved.windowStartedAt === 0 || now - saved.windowStartedAt >= WINDOW_MS;
  const boundary = resetWindow ? { ...saved, windowStartedAt: now, touchesInWindow: 0 } : saved;
  const startled = type === 'hold'
    && state.bond.stage === 'tentative'
    && state.personality.caution >= 62
    && state.bond.totalInteractions < 4;
  const needsSpace = now < boundary.overwhelmedUntil || boundary.touchesInWindow >= touchLimit(state);

  if (startled || needsSpace) {
    const next = recordBoundary(state, boundary, now, startled);
    return { state: next, accepted: false, label: boundaryLabel(next, startled) };
  }

  return {
    state: { ...state, touchBoundaries: { ...boundary, touchesInWindow: boundary.touchesInWindow + 1 } },
    accepted: true,
    label: null,
  };
}
