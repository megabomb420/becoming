import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  advanceNeeds,
  cleanRoomMess,
  feedCreature,
  migrateRoomMess,
  useToilet,
  washCreature,
} from '../src/systems/needsSystem';
import { beginConversationTurn } from '../src/systems/conversationSystem';
import { parseImportedGameState, serializeGameState } from '../src/systems/persistence';

let creature = createHatchedCreature(createNewCreature('Care', 2525));
assert.equal(creature.roomMess.length, 0);
assert.ok(creature.needs.hygiene > 0 && creature.needs.bladder > 0 && creature.needs.bowel > 0);

creature = {
  ...creature,
  needs: { ...creature.needs, hygiene: 70, bladder: 0.1, bowel: 0.1 },
  position: { x: 52, y: 64 },
};
const accident = advanceNeeds(creature, 1, 1_820_000_000_000);
assert.deepEqual(accident.accidents.sort(), ['pee', 'poop']);
assert.equal(accident.state.roomMess.length, 2);
assert.ok(accident.state.needs.bladder > 60 && accident.state.needs.bowel > 70);
assert.ok(accident.state.needs.hygiene < 45);
assert.ok(accident.state.roomMess.every(mess => mess.x >= 14 && mess.x <= 86 && mess.y >= 57 && mess.y <= 76));

const bounded = advanceNeeds({
  ...creature,
  needs: { ...creature.needs, bladder: 1, bowel: 1 },
  roomMess: [],
}, 10_000, 1_820_000_100_000, 'offline');
assert.equal(bounded.state.roomMess.length, 2, 'a long absence must create at most one trace of each kind');

let toiletState = createHatchedCreature(createNewCreature('Toilet', 2626));
toiletState = { ...toiletState, needs: { ...toiletState.needs, bladder: 18, bowel: 44 } };
const toilet = useToilet(toiletState, 1_820_000_200_000);
assert.equal(toilet.performed, true);
assert.equal(toilet.result, 'both');
assert.equal(toilet.state.needs.bladder, 100);
assert.equal(toilet.state.needs.bowel, 100);
assert.equal(toilet.state.memories.filter(memory => memory.tags.includes('first-toilet')).length, 1);
const toiletAgain = useToilet({ ...toilet.state, needs: { ...toilet.state.needs, bladder: 20 } }, 1_820_000_300_000);
assert.equal(toiletAgain.state.memories.filter(memory => memory.tags.includes('first-toilet')).length, 1);

const fed = feedCreature({ ...toiletAgain.state, needs: { ...toiletAgain.state.needs, hunger: 20, bladder: 80, bowel: 80 } }, 'broccoli');
assert.ok(fed.needs.hunger > 20);
assert.ok(fed.needs.bladder < 80 && fed.needs.bowel < 80, 'food should feed the later bathroom cycle');

const washed = washCreature({ ...accident.state, needs: { ...accident.state.needs, hygiene: 12 } });
assert.equal(washed.performed, true);
assert.equal(washed.state.needs.hygiene, 100);
const oneCleaned = cleanRoomMess(washed.state, washed.state.roomMess[0].id);
assert.equal(oneCleaned.count, 1);
assert.equal(oneCleaned.state.roomMess.length, 1);
const allCleaned = cleanRoomMess(oneCleaned.state);
assert.equal(allCleaned.state.roomMess.length, 0);
assert.equal(cleanRoomMess(allCleaned.state).performed, false);

const migratedMess = migrateRoomMess([
  { type: 'pee', x: -200, y: 900 },
  { type: 'not-real', x: 50, y: 60 },
]);
assert.equal(migratedMess.length, 1);
assert.equal(migratedMess[0].x, 12);
assert.equal(migratedMess[0].y, 77);

const legacyEnvelope = JSON.parse(serializeGameState(toiletState));
delete legacyEnvelope.state.needs.hygiene;
delete legacyEnvelope.state.needs.bladder;
delete legacyEnvelope.state.needs.bowel;
delete legacyEnvelope.state.roomMess;
const migratedLegacy = parseImportedGameState(JSON.stringify(legacyEnvelope));
assert.equal(migratedLegacy.needs.hygiene, 82);
assert.equal(migratedLegacy.needs.bladder, 76);
assert.equal(migratedLegacy.needs.bowel, 82);
assert.deepEqual(migratedLegacy.roomMess, []);

const polishCare = beginConversationTurn({
  ...toiletState,
  conversation: { ...toiletState.conversation, language: 'pl' },
  needs: { ...toiletState.needs, bladder: 8 },
}, 'Jak się czujesz?', 1_820_000_400_000);
assert.match(polishCare.reply, /siku/i);

console.log('Hidden physiology, bounded accidents, toilet, washing, cleaning, feeding effects, chat awareness, and legacy migration checks passed.');
