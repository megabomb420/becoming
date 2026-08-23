import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { chooseObjectReaction } from '../src/systems/relationshipSystem';
import { beginConversationTurn } from '../src/systems/conversationSystem';
import {
  applyWorldObjectReaction,
  beginComeHere,
  groundedWorldReply,
  offerObjectFromInventory,
  parseWorldIntent,
  performImmediateWorldAction,
  resultFromObjectReaction,
} from '../src/systems/worldActionSystem';

const NOW = 1_825_000_000_000;
const base = createHatchedCreature(createNewCreature('World', 4117));

assert.deepEqual(parseWorldIntent('Masz, dam ci jabłko.'), { kind: 'offer_object', objectType: 'apple' });
assert.deepEqual(parseWorldIntent('Please play with the ball'), { kind: 'use_object', objectType: 'ball' });
assert.deepEqual(parseWorldIntent('Napij się wody'), { kind: 'drink', objectType: 'water_bowl' });
assert.equal(parseWorldIntent('Lubię jabłka, ale ty nie musisz.'), null, 'an object mention is not automatically a command');

const spokenOffer = beginConversationTurn(base, 'Masz, dam ci jabłko.', NOW, { worldAction: true }).state;
assert.deepEqual(spokenOffer.personality, base.personality, 'a world command must not directly rewrite creature personality');
assert.equal(spokenOffer.lifePath.activePath, base.lifePath.activePath, 'a world command must not directly assign a life path');

const originalPaths = structuredClone(base.lifePath);
const originalPersonality = structuredClone(base.personality);
const offered = offerObjectFromInventory(base, 'apple', { x: 45, y: 65 }, NOW);
assert.equal(offered.result.status, 'offered');
assert.equal(offered.state.inventory.includes('apple'), false);
assert.equal(offered.state.roomObjects.some(object => object.type === 'apple'), true);
assert.deepEqual(offered.state.lifePath, originalPaths, 'placing an object through conversation must not directly change a life path');
assert.deepEqual(offered.state.personality, originalPersonality, 'placing an object through conversation must not directly change personality');

const apple = offered.state.roomObjects.find(object => object.type === 'apple')!;
const hungry = {
  ...offered.state,
  needs: { ...offered.state.needs, hunger: 12 },
  objectPreferences: {
    ...offered.state.objectPreferences,
    apple: { ...offered.state.objectPreferences.apple, affinity: 35, interactions: 4 },
  },
};
const eatReaction = chooseObjectReaction(hungry, 'apple');
assert.equal(eatReaction.consumes, true);
const eaten = applyWorldObjectReaction(hungry, apple.id, eatReaction, { x: 40, y: 64 }, eatReaction.label, true, NOW + 1);
assert.equal(eaten.roomObjects.some(object => object.id === apple.id), false, 'a consumed apple must disappear from the room');
assert.ok(eaten.needs.hunger > hungry.needs.hunger);
const eatenResult = resultFromObjectReaction({ kind: 'offer_object', objectType: 'apple' }, apple, eatReaction.outcome, true);
assert.match(groundedWorldReply(eatenResult, 'en'), /ate the apple/i);

const refusedOffer = offerObjectFromInventory({
  ...base,
  needs: { ...base.needs, hunger: 96 },
}, 'apple', { x: 55, y: 65 }, NOW + 2);
const refusedApple = refusedOffer.state.roomObjects.find(object => object.type === 'apple')!;
const refusal = chooseObjectReaction(refusedOffer.state, 'apple');
assert.equal(refusal.outcome, 'avoid');
const leftBehind = applyWorldObjectReaction(refusedOffer.state, refusedApple.id, refusal, { x: 60, y: 64 }, refusal.label, true, NOW + 3);
assert.equal(leftBehind.roomObjects.some(object => object.id === refusedApple.id), true, 'refusal must leave the offered object in the room');
const refusedResult = resultFromObjectReaction({ kind: 'offer_object', objectType: 'apple' }, refusedApple, refusal.outcome, false);
assert.match(groundedWorldReply(refusedResult, 'en'), /leave it here/i);

const unavailable = offerObjectFromInventory({ ...base, inventory: base.inventory.filter(type => type !== 'apple') }, 'apple', { x: 50, y: 64 }, NOW);
assert.equal(unavailable.result.status, 'unavailable');

const waterOffer = offerObjectFromInventory({
  ...base,
  needs: { ...base.needs, hydration: 8 },
}, 'water_bowl', { x: 50, y: 65 }, NOW + 4);
const water = waterOffer.state.roomObjects.find(object => object.type === 'water_bowl')!;
const drinkReaction = chooseObjectReaction(waterOffer.state, 'water_bowl');
const drank = applyWorldObjectReaction(waterOffer.state, water.id, drinkReaction, { x: 45, y: 64 }, drinkReaction.label, true, NOW + 5);
assert.ok(drank.needs.hydration > waterOffer.state.needs.hydration, 'drink must change real hydration');
assert.equal(drank.roomObjects.some(object => object.id === water.id), true, 'the water bowl remains in the room');

const sleepBlocked = performImmediateWorldAction({
  ...base,
  needs: { ...base.needs, hunger: 3, energy: 12 },
}, { kind: 'sleep' }, NOW);
assert.equal(sleepBlocked.result.status, 'blocked');
assert.equal(sleepBlocked.state.sleepState, 'awake');

const cameCloser = beginComeHere(base, { x: 50, y: 74 });
assert.deepEqual(cameCloser.position, { x: 50, y: 74 });
assert.equal(cameCloser.creatureBehavior, 'walking');

const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
const cssSource = readFileSync('src/index.css', 'utf8');
assert.match(roomSource, /const roomSpeech = state\.conversation\.lastCreatureMessage/);
assert.match(roomSource, /room-header relative z-30 safe-top/);
assert.match(roomSource, /room-conversation-zone/);
assert.doesNotMatch(roomSource, /setTimeout\(\(\) => setSpeech\(null\)/, 'the last utterance must not disappear on a timer');
assert.match(cssSource, /min-height: calc\(7\.25rem \+ env\(safe-area-inset-top\)\)/, 'the mobile header must reserve safe-area space');

console.log('World action and room-first conversation checks passed.');
