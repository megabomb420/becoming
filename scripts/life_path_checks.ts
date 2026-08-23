import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  ensureDailyMoment,
  evolveLifePath,
  getLifePathTitle,
  resolveDailyMoment,
} from '../src/systems/lifePathSystem';
import {
  evolveInnerLifeFromConversation,
  evolveInnerLifeFromObject,
  generateDreamAfterSleep,
  getRankedInterests,
  revealPrivateThoughtIfAsked,
} from '../src/systems/innerLifeSystem';
import { appendCreatureMessage } from '../src/systems/conversationSystem';

let state = createHatchedCreature(createNewCreature('Test', 99117));
state = {
  ...state,
  development: { ...state.development, cognitiveLevel: 55, languageLevel: 50, stage: 'sentences' },
};

for (let index = 0; index < 5; index += 1) {
  state = evolveLifePath(state, 'Palę zioło, bo daje mi chill.', 1_800_000_000_000 + index * 1_000);
}
assert.equal(state.lifePath.primary, 'stoner');
assert.ok(state.lifePath.scores.stoner >= 45);

for (let index = 0; index < 4; index += 1) {
  state = evolveLifePath(state, 'Gram w gry całą noc, to mój kolejny quest.', 1_800_000_010_000 + index * 1_000);
}
assert.deepEqual(
  [state.lifePath.primary, state.lifePath.secondary].sort(),
  ['gamer', 'stoner'],
);
assert.equal(getLifePathTitle(state), 'Fog Gamer');

state = ensureDailyMoment(state, 1_800_000_020_000);
assert.ok(state.lifePath.pendingMoment);
const choice = state.lifePath.pendingMoment!.choices[0];
const memoriesBefore = state.memories.length;
state = resolveDailyMoment(state, choice.id, 1_800_000_021_000);
assert.equal(state.lifePath.pendingMoment, null);
assert.equal(state.memories.length, memoriesBefore + 1);

let risky = createHatchedCreature(createNewCreature('Risk', 441));
risky = { ...risky, development: { ...risky.development, cognitiveLevel: 55, stage: 'sentences' } };
for (let index = 0; index < 5; index += 1) {
  risky = evolveLifePath(risky, 'Piłem alkohol i znowu byłem pijany.', 1_800_001_000_000 + index * 1_000);
}
const alcoholicPeak = risky.lifePath.scores.alcoholic;
risky = evolveLifePath(risky, 'Jestem trzeźwy, nie piję i wybieram recovery.', 1_800_001_010_000);
assert.ok(risky.lifePath.recovery >= 14);
assert.ok(risky.lifePath.scores.alcoholic < alcoholicPeak);

let inner = createHatchedCreature(createNewCreature('Inner', 7123));
inner = {
  ...inner,
  development: { ...inner.development, cognitiveLevel: 58, languageLevel: 50, stage: 'sentences' },
  bond: { ...inner.bond, stage: 'close', score: 70 },
};
for (let index = 0; index < 5; index += 1) {
  inner = evolveInnerLifeFromConversation(inner, 'I really love games and gaming.', 1_800_002_000_000 + index * 1_000);
}
assert.equal(getRankedInterests(inner, 1)[0]?.type, 'games');
assert.ok(getRankedInterests(inner, 1)[0].level >= 48);
assert.ok(inner.innerLife.opinions.some(opinion => opinion.topic === 'games'));
assert.ok(inner.innerLife.privateThoughts.length > 0);

inner = evolveInnerLifeFromObject(inner, 'paper', 'love', 1_800_002_010_000);
assert.ok(inner.interests.some(interest => interest.type === 'art'));

const revealed = revealPrivateThoughtIfAsked(inner, 'Tell me a secret.', 1_800_002_020_000);
assert.ok(revealed.reply);
assert.ok(revealed.state.innerLife.pendingDisclosure);
inner = appendCreatureMessage(revealed.state, revealed.reply!, 1_800_002_021_000);
assert.equal(inner.innerLife.pendingDisclosure, null);

inner = {
  ...inner,
  memories: [...inner.memories, {
    id: 'test-memory',
    timestamp: 1_800_002_030_000,
    content: 'played with the ball beside the user',
    importance: 8,
    emotionalValence: 0.7,
    tags: ['play', 'user'],
    mentioned: false,
    understood: true,
    compressed: false,
  }],
};
inner = generateDreamAfterSleep(inner, 8 * 60 * 60_000, 1_800_020_000_000);
assert.equal(inner.innerLife.dreams.length, 1);
assert.ok(inner.memories.some(memory => memory.tags.includes('dream')));

console.log('Life path and inner life checks passed.');
