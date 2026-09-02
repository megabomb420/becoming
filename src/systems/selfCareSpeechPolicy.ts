import type { GameState } from '../types';
import type { SelfCareKind } from './llmConversation';

const MEANINGFUL_NEED_CHANGE = 10;

type AttemptStatus = 'underway' | 'completed' | 'failed' | 'spoken';

interface SelfCareSpeechSnapshot {
  value: number;
  status: AttemptStatus;
}

interface ActiveSelfCareSpeech {
  action: SelfCareKind;
  token: number;
}

export interface SelfCareSpeechPolicy {
  nextToken: number;
  active: ActiveSelfCareSpeech | null;
  lastByAction: Partial<Record<SelfCareKind, SelfCareSpeechSnapshot>>;
}

export function createSelfCareSpeechPolicy(): SelfCareSpeechPolicy {
  return { nextToken: 1, active: null, lastByAction: {} };
}

function needValue(state: GameState, action: SelfCareKind): number {
  if (action === 'drink') return state.needs.hydration;
  if (action === 'pee') return state.needs.bladder;
  if (action === 'poop') return state.needs.bowel;
  if (action === 'eat') return state.needs.hunger;
  if (action === 'wash') return state.needs.hygiene;
  return state.needs.energy;
}

export function dominantSpokenCareNeed(state: GameState): SelfCareKind | null {
  if (state.needs.bowel < 24) return 'poop';
  if (state.needs.bladder < 30) return 'pee';
  if (state.needs.hunger < 42) return 'eat';
  if (state.needs.hygiene < 45) return 'wash';
  return null;
}

export function canSpeakSelfCare(
  policy: SelfCareSpeechPolicy,
  state: GameState,
  action: SelfCareKind,
): boolean {
  if (policy.active) return false;
  const previous = policy.lastByAction[action];
  if (!previous) return true;
  return previous.status !== 'underway'
    && Math.abs(needValue(state, action) - previous.value) >= MEANINGFUL_NEED_CHANGE;
}

export function beginSelfCareSpeech(
  policy: SelfCareSpeechPolicy,
  state: GameState,
  action: SelfCareKind,
): number | null {
  if (!canSpeakSelfCare(policy, state, action)) return null;
  const token = policy.nextToken;
  policy.nextToken += 1;
  policy.active = { action, token };
  policy.lastByAction[action] = { value: needValue(state, action), status: 'underway' };
  return token;
}

export function finishSelfCareSpeech(
  policy: SelfCareSpeechPolicy,
  token: number,
  status: 'completed' | 'failed',
): void {
  if (policy.active?.token !== token) return;
  const previous = policy.lastByAction[policy.active.action];
  if (previous) policy.lastByAction[policy.active.action] = { ...previous, status };
  policy.active = null;
}

export function failActiveSelfCareSpeech(policy: SelfCareSpeechPolicy): void {
  if (policy.active) finishSelfCareSpeech(policy, policy.active.token, 'failed');
}

export function isSelfCareSpeechCurrent(policy: SelfCareSpeechPolicy, token: number): boolean {
  return policy.active?.token === token;
}

export function recordStandaloneSelfCareSpeech(
  policy: SelfCareSpeechPolicy,
  state: GameState,
  action: SelfCareKind,
): void {
  policy.lastByAction[action] = { value: needValue(state, action), status: 'spoken' };
}
