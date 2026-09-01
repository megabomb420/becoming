export type PointerRelease = 'hold' | 'stroke' | 'tap';

export const POINTER_STROKE_THRESHOLD = 20;

// Pure projection of a pointer-up decision: takes its inputs explicitly and
// holds no closure state, so a stale handler cannot misclassify a release.
// Mirrors the tap / stroke / hold branch in Room's handlePointerUp.
export function resolvePointerRelease(
  didHold: boolean,
  distance: number,
  strokeThreshold = POINTER_STROKE_THRESHOLD,
): PointerRelease {
  if (didHold) return 'hold';
  if (distance > strokeThreshold) return 'stroke';
  return 'tap';
}
