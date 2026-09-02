// Object pointer semantics: a tap uses, a drag moves, and dragging a room
// object onto the inventory target puts it away. The release decision is a
// pure projection of its current inputs so it can be tested deterministically
// and can never be misclassified by a stale handler.

export type ObjectReleaseOutcome = 'place_auto' | 'place_at' | 'use' | 'put_away' | 'reposition';

export const DRAG_THRESHOLD_PX = 12;

/** A small pointer jitter stays a tap; real movement beyond the threshold is a drag. */
export function isObjectDragMoved(distance: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return distance > threshold;
}

export function isPointInRect(
  x: number,
  y: number,
  rect: { left: number; right: number; top: number; bottom: number },
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Decides what a pointer release means for the current drag session:
 * - inventory tap -> place on an auto slot; inventory drag -> place at the spot
 * - room tap -> Use (the shelf being open never changes a tap: care and object
 *   use stay available while the tray is up)
 * - room drag -> reposition, or Put away when released over the inventory target
 * A drag never falls through to Use. Put-away by keyboard (activating a room
 * object while the shelf is open) is handled separately by the button itself.
 */
export function resolveObjectRelease(
  session: { source: 'inventory' | 'room'; moved: boolean; objectId?: string },
  overInventoryTarget: boolean,
): ObjectReleaseOutcome | null {
  if (session.source === 'inventory') return session.moved ? 'place_at' : 'place_auto';
  if (!session.objectId) return null;
  if (session.moved) return overInventoryTarget ? 'put_away' : 'reposition';
  return 'use';
}
