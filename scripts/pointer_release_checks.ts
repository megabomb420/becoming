import assert from 'node:assert/strict';
import { POINTER_STROKE_THRESHOLD, resolvePointerRelease } from '../src/systems/pointerRelease';

// The release decision is a pure projection of its current inputs. A stale
// handler cannot return the wrong classification, because the outcome depends
// only on (didHold, distance) — never on captured closure state.

assert.equal(resolvePointerRelease(true, 3), 'hold', 'a held pointer always releases as hold, even on a tiny move');
assert.equal(resolvePointerRelease(true, 100), 'hold', 'holding dominates any travel distance');
assert.equal(resolvePointerRelease(false, 21), 'stroke', 'a move beyond the threshold is a stroke');
assert.equal(resolvePointerRelease(false, POINTER_STROKE_THRESHOLD), 'tap', 'a move exactly at the threshold is a tap, not a stroke');
assert.equal(resolvePointerRelease(false, 5), 'tap', 'a short move is a tap');
assert.equal(resolvePointerRelease(false, 0), 'tap', 'a stationary release is a tap');
assert.equal(resolvePointerRelease(false, 1_000), 'stroke', 'a long travel is a stroke');
assert.equal(POINTER_STROKE_THRESHOLD, 20);

// Deterministic: the same current inputs always give the same classification.
assert.equal(resolvePointerRelease(false, 25, 20), resolvePointerRelease(false, 25, 20), 'must be deterministic');

console.log('Pointer/drag release checks passed.');
