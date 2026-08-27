import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { evolveCreationFromObject, getCreationMastery, migrateCreations } from '../src/systems/creationSystem';
import { applyWorldObjectReaction, parseWorldIntent } from '../src/systems/worldActionSystem';
import { chooseObjectReaction } from '../src/systems/relationshipSystem';
import { beginConversationTurn } from '../src/systems/conversationSystem';

const NOW = 1_825_300_000_000;

function ready(name: string, seed: number) {
  const creature = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...creature,
    conversation: { ...creature.conversation, language: 'en' as const },
    development: { ...creature.development, cognitiveLevel: 60, languageLevel: 50, stage: 'sentences' as const },
  };
}

function withObject(state: ReturnType<typeof ready>, type: 'box' | 'stone' | 'ball' | 'paper' | 'pencil', x = 48) {
  return {
    ...state,
    roomObjects: [
      ...state.roomObjects.filter(object => object.type !== type),
      { id: `${type}-test`, type, x, y: 64, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: false },
    ],
  };
}

let box = withObject(ready('Boxer', 2121), 'box');
for (const interactions of [3, 7]) {
  box = {
    ...box,
    objectPreferences: { ...box.objectPreferences, box: { ...box.objectPreferences.box, interactions, affinity: 14, lastOutcome: 'love' } },
  };
  box = evolveCreationFromObject(box, 'box', NOW + interactions);
}
assert.deepEqual(box.creations.map(creation => creation.stage), ['hideaway', 'den']);
assert.equal(box.roomObjects.find(object => object.type === 'box')?.state.status, 'den');
assert.match(getCreationMastery(box, 'en'), /den/i);
assert.equal(box.lifePath.primary, ready('Boxer', 2121).lifePath.primary);

let stone = withObject(ready('Keeper', 3232), 'stone');
stone = {
  ...stone,
  objectPreferences: { ...stone.objectPreferences, stone: { ...stone.objectPreferences.stone, interactions: 4, affinity: 16, lastOutcome: 'love' } },
};
stone = evolveCreationFromObject(stone, 'stone', NOW + 20);
assert.deepEqual(stone.creations.map(creation => creation.stage), ['keepsake']);
assert.match(getCreationMastery(stone, 'pl'), /kamie/i);

let ball = withObject(ready('Player', 4343), 'ball');
ball = {
  ...ball,
  objectPreferences: { ...ball.objectPreferences, ball: { ...ball.objectPreferences.ball, interactions: 8, affinity: 20, lastOutcome: 'love' } },
};
const alone = evolveCreationFromObject(ball, 'ball', NOW + 30, false);
assert.equal(alone.creations.length, 0, 'solitary play is not a shared game');
const together = evolveCreationFromObject(ball, 'ball', NOW + 31, true);
assert.deepEqual(together.creations.map(creation => creation.stage), ['shared_game']);
assert.match(getCreationMastery(together), /game|return/i);

const musicTalk = beginConversationTurn(ready('Listener', 5454), 'I love making music on the guitar.', NOW + 40);
assert.equal(musicTalk.state.creations.length, 0, 'talking about music must not invent a music creation');

assert.deepEqual(migrateCreations([{ stage: 'mark', title: 'Old mark', description: 'a line', glyph: '∿', inspiration: 'the room', createdAt: NOW }]).map(item => item.stage), ['mark']);
assert.deepEqual(migrateCreations([{ stage: 'den' as never }]).map(item => item.stage), ['den']);

const playIntent = parseWorldIntent('Please play with the ball');
assert.deepEqual(playIntent, { kind: 'use_object', objectType: 'ball' });
const playing = withObject({
  ...ready('World play', 6565),
  needs: { ...ready('World play', 6565).needs, hunger: 80, hydration: 80, energy: 80, bladder: 80, bowel: 80 },
}, 'ball');
const originalPrimary = playing.lifePath.primary;
const reaction = chooseObjectReaction(playing, 'ball');
const afterPlay = applyWorldObjectReaction(playing, 'ball-test', reaction, { x: 50, y: 64 }, reaction.label, true, NOW + 50);
assert.equal(afterPlay.lifePath.primary, originalPrimary, 'collaborative play must not assign a life path');

const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
assert.doesNotMatch(roomSource, /evolveCreationFromObject/, 'creation still grows from object use, not a Room loop');
assert.doesNotMatch(readFileSync('src/systems/creationSystem.ts', 'utf8'), /guitar|piano|synth/i);

console.log('Creation mastery checks passed.');
