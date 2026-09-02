import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DRAG_THRESHOLD_PX,
  isObjectDragMoved,
  isPointInRect,
  resolveObjectRelease,
} from '../src/systems/objectInput';

// The object release decision is a pure projection of (source, moved, target):
// a tap uses, a drag moves, and a drop on the inventory target puts the object
// away. Opening the shelf never changes a tap. No stale handler can blur tap
// and drag.

const roomTap = { source: 'room' as const, objectId: 'apple-1', moved: false };
const roomDrag = { source: 'room' as const, objectId: 'apple-1', moved: true };
const trayTap = { source: 'inventory' as const, moved: false };
const trayDrag = { source: 'inventory' as const, moved: true };

// 10. Tap on a room object -> Use (no menu, no popup). The shelf being open
//     must not change this: normal care/object use stays available while the
//     tray is up (regression from live QA of the accelerated harness).
assert.equal(resolveObjectRelease(roomTap, false), 'use', 'tap on a room object starts Use');
assert.equal(resolveObjectRelease({ ...roomTap, objectId: 'water-1' }, false), 'use', 'tap still Uses with the shelf open');

// 11. A tap never opens the old Use/Put away popup (no selection state remains).
const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
assert.doesNotMatch(roomSource, /setSelectedObjectId|selectedObject/, 'the selection popup state is gone');
assert.doesNotMatch(roomSource, /Use or put away|Options for|Opcje:/, 'the popup copy is gone');

// 12. Drag a room object -> reposition, never Use.
assert.equal(resolveObjectRelease(roomDrag, false), 'reposition', 'a drag moves the object');

// 13. Drag a room object onto the inventory target -> Put away.
assert.equal(resolveObjectRelease(roomDrag, true), 'put_away', 'dropping on the drag target puts the object away');

// 14. Drag from inventory -> place at the spot; tap from inventory -> auto place.
assert.equal(resolveObjectRelease(trayDrag, true), 'place_at', 'inventory drag places at the release position');
assert.equal(resolveObjectRelease(trayTap, false), 'place_auto', 'inventory tap places on an auto slot');

// Put-away stays reachable without a popup as an explicit, labelled action:
// pointer users drag onto the open tray/drop target; with the shelf open each
// room object also shows a dedicated Put away control that keyboard/AT users
// can activate. Activation of the object itself always means Use.
assert.doesNotMatch(roomSource, /resolveObjectRelease\([^)]*showInventory/, 'the tap decision no longer depends on the shelf state');
assert.doesNotMatch(roomSource, /if \(showInventory\) putAwayRoomObject\(obj\.id\)/, 'activation always means Use — no hidden shelf-state keyboard meaning');
assert.doesNotMatch(roomSource, /title=\{showInventory \? t\('Put away'/, 'the object title no longer disagrees with its tap meaning');
assert.match(roomSource, /Put away \$\{objectLabel\(obj\.type, false\)\}/, 'an explicit labelled Put away control is rendered');
assert.match(roomSource, /putAwayRoomObject\(obj\.id\)/, 'the explicit control is wired to put the object away');

// 15. The movement threshold prevents an accidental Use after a drag: a small
//     jitter stays a tap, movement beyond the threshold becomes a drag.
assert.equal(DRAG_THRESHOLD_PX, 12);
assert.equal(isObjectDragMoved(0), false, 'a stationary release is a tap');
assert.equal(isObjectDragMoved(11), false, 'small finger jitter stays a tap');
assert.equal(isObjectDragMoved(DRAG_THRESHOLD_PX), false, 'movement exactly at the threshold is still a tap');
assert.equal(isObjectDragMoved(13), true, 'movement beyond the threshold is a drag');

// 16. Mobile pointer flow is preserved: pointer capture, no long-press drag,
//     and touch-action isolation.
assert.match(roomSource, /setPointerCapture\(e\.pointerId\)/, 'the session keeps pointer capture');
assert.doesNotMatch(roomSource, /long.?press|onLongPress/i, 'dragging never requires a long press');
assert.match(roomSource, /touchAction: draggingType \? 'none' : 'pan-y'/, 'the room isolates touch during a drag');
assert.match(roomSource, /isObjectDragMoved\(/, 'the shared drag threshold decides moved vs tap');

// The drop-target hit test is pure and bounded.
assert.equal(isPointInRect(10, 10, { left: 0, right: 20, top: 0, bottom: 20 }), true);
assert.equal(isPointInRect(25, 10, { left: 0, right: 20, top: 0, bottom: 20 }), false);
assert.equal(isPointInRect(10, 25, { left: 0, right: 20, top: 0, bottom: 20 }), false);

// Wiring: Room resolves releases through the pure classifier, renders a
// labelled drag-to-inventory target that disappears with the drag, and routes
// the tap straight into the canonical object-use flow.
assert.match(roomSource, /resolveObjectRelease\(/, 'Room resolves releases through the pure classifier');
assert.match(roomSource, /dropTargetRef/, 'a drag-to-inventory drop target exists');
assert.match(roomSource, /t\('Put away', 'Odłóż'\)/, 'the drop target is labelled Put away / Odłóż');
assert.match(roomSource, /dragMoved && draggingObjectId/, 'the drop target only appears while a room object is dragged');
assert.match(roomSource, /beginObjectInteraction\(object, true\)/, 'the tap path uses the canonical object-use flow');
assert.match(roomSource, /beginObjectInteraction\(obj, true\)/, 'the keyboard path uses the same flow');
assert.match(roomSource, /putAwayRoomObject\(session\.objectId\)/, 'a drop on the target puts the object away');

// 17. The object pipeline and its life-path protections still run untouched:
//     reactions come from chooseObjectReaction and the canonical transition.
assert.match(roomSource, /chooseObjectReaction\(stateRef\.current, type\)/, 'object reactions still decide the outcome');
assert.match(roomSource, /applyWorldObjectReaction/, 'the canonical object transition still applies');
const actionSource = readFileSync('src/systems/worldActionSystem.ts', 'utf8');
assert.match(actionSource, /evolveLifePathFromObject/, 'object use still feeds life-path evidence');

console.log('Object interaction and pointer semantics checks passed.');
