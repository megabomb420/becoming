import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  ensureDailyMoment,
  evolveLifePath,
  getLifePathTitle,
  resolveDailyMoment,
} from '../src/systems/lifePathSystem';

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

console.log('Life path checks passed.');
