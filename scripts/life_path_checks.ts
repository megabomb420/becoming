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
  migrateInnerLifeState,
  revealPrivateThoughtIfAsked,
} from '../src/systems/innerLifeSystem';
import { appendCreatureMessage, beginConversationTurn } from '../src/systems/conversationSystem';
import { getDueOpenLoop, markOpenLoopAsked, migrateContinuityState } from '../src/systems/continuitySystem';

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

let bilingual = createHatchedCreature(createNewCreature('Bilingual', 88));
bilingual = beginConversationTurn(bilingual, 'Hello, I want to talk with you today.', 1_800_030_000_000).state;
assert.equal(bilingual.conversation.language, 'en');
bilingual = beginConversationTurn(bilingual, 'Cześć, chcę teraz rozmawiać po polsku.', 1_800_030_001_000).state;
assert.equal(bilingual.conversation.language, 'pl');
bilingual = beginConversationTurn(bilingual, 'Hello, I want to switch back to English.', 1_800_030_002_000).state;
assert.equal(bilingual.conversation.language, 'en');

let continuous = createHatchedCreature(createNewCreature('Continuity', 404));
continuous = {
  ...continuous,
  development: { ...continuous.development, cognitiveLevel: 60, languageLevel: 55, stage: 'sentences' },
  memories: [{
    id: 'old-small-memory',
    timestamp: continuous.identity.birthTimestamp - 1_000,
    content: 'a small old moment',
    importance: 3,
    emotionalValence: 0,
    tags: ['old'],
    mentioned: false,
    understood: true,
    compressed: false,
  }],
};
const continuityStart = 1_800_040_000_000;
const continuityMessages = [
  'I want to finish the book.',
  'I really like games.',
  'Work was busy today.',
  'Music helped me focus.',
  'I went for a walk in nature.',
  'I talked with a friend.',
  'The project is moving forward.',
  'I feel calm about it now.',
];
continuityMessages.forEach((message, index) => {
  continuous = beginConversationTurn(continuous, message, continuityStart + index * 1_000).state;
});
assert.equal(continuous.continuity.chapters.length, 1);
assert.ok(continuous.continuity.chapters[0].summary.length > 20);
assert.equal(continuous.memories.find(memory => memory.id === 'old-small-memory')?.compressed, true);
const dueLoop = getDueOpenLoop(continuous, continuityStart + 13 * 60 * 60_000);
assert.equal(dueLoop?.kind, 'goal');
continuous = markOpenLoopAsked(continuous, dueLoop!.id, continuityStart + 13 * 60 * 60_000);
assert.equal(continuous.continuity.openLoops.find(loop => loop.id === dueLoop!.id)?.askCount, 1);
continuous = beginConversationTurn(continuous, 'I finished the book. It is done.', continuityStart + 14 * 60 * 60_000).state;
assert.ok(continuous.continuity.openLoops.some(loop => loop.kind === 'goal' && loop.resolvedAt));

let mirrorMind = createHatchedCreature(createNewCreature('Mirror', 909));
mirrorMind = { ...mirrorMind, development: { ...mirrorMind.development, cognitiveLevel: 60, stage: 'sentences' } };
for (let index = 0; index < 7; index += 1) {
  mirrorMind = evolveInnerLifeFromObject(mirrorMind, 'mirror', 'curious', 1_800_050_000_000 + index * 1_000);
}
assert.equal(mirrorMind.innerLife.selfAwareness.stage, 'reflective');
assert.ok(mirrorMind.innerLife.selfAwareness.recognizedAt);
assert.ok(mirrorMind.memories.some(memory => memory.tags.includes('recognized')));
assert.ok(mirrorMind.memories.some(memory => memory.tags.includes('reflective')));

const migratedInner = migrateInnerLifeState({ dreams: [], opinions: [], privateThoughts: [] }, 1_800_060_000_000);
assert.equal(migratedInner.selfAwareness.stage, 'unaware');
const migratedContinuity = migrateContinuityState(null);
assert.deepEqual(migratedContinuity.chapters, []);
assert.deepEqual(migratedContinuity.openLoops, []);

console.log('Life path, inner life, continuity, and mirror checks passed.');
