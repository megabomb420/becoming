import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { isPrankster, useToiletCommanded } from '../src/systems/needsSystem';
import { groundedWorldReply, parseWorldIntent, performImmediateWorldAction } from '../src/systems/worldActionSystem';

const NOW = Date.UTC(2026, 7, 27, 12, 0);

function toiletState(seed: number) {
  const base = createHatchedCreature(createNewCreature('ToiletCmd', seed));
  return {
    ...base,
    needsUpdatedAt: NOW,
    lastSaved: NOW,
    needs: { ...base.needs, bladder: 18, bowel: 44 },
  };
}

assert.deepEqual(parseWorldIntent('idź siku'), { kind: 'toilet', objectType: 'litter_box' });
assert.deepEqual(parseWorldIntent('zrób kupę'), { kind: 'toilet', objectType: 'litter_box' });
assert.deepEqual(parseWorldIntent('go poop'), { kind: 'toilet', objectType: 'litter_box' });

// No litter box: the need resolves, but the floor takes the mark and the
// player has to clean it.
const noBox = toiletState(701);
const soiledNoBox = useToiletCommanded(noBox, NOW);
assert.equal(soiledNoBox.performed, true);
assert.equal(soiledNoBox.soiled, 'no_box');
assert.ok(soiledNoBox.state.roomMess.length > 0);
assert.ok(soiledNoBox.state.needs.bladder > 60);
assert.ok(soiledNoBox.state.needs.bowel > 70);

const box = { id: 'litter-live', type: 'litter_box' as const, x: 50, y: 68, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: false };
const calm = toiletState(702);
const withBox = {
  ...calm,
  roomObjects: [box],
  personality: { ...calm.personality, impulsiveness: 30, caution: 70 },
};
const used = useToiletCommanded(withBox, NOW);
assert.equal(used.performed, true);
assert.equal(used.soiled, undefined);
assert.equal(used.state.roomMess.length, 0);
assert.equal(used.state.needs.bladder, 100);
assert.equal(used.state.needs.bowel, 100);

// A prankster can still choose the floor even with the box nearby.
const prankster = {
  ...withBox,
  personality: { ...withBox.personality, impulsiveness: 80, caution: 20 },
};
assert.equal(isPrankster(prankster), true);
const soiledPrank = useToiletCommanded(prankster, NOW);
assert.equal(soiledPrank.performed, true);
assert.equal(soiledPrank.soiled, 'prank');
assert.ok(soiledPrank.state.roomMess.length > 0);

const spoken = performImmediateWorldAction(noBox, { kind: 'toilet', objectType: 'litter_box' }, NOW + 1);
assert.equal(spoken.result.status, 'success');
assert.equal(spoken.result.reason, 'soiled_no_box');
assert.match(groundedWorldReply(spoken.result, 'pl'), /kuwety/i);

console.log('Toilet command and room-soiling checks passed.');
