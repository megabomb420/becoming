import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { getSelfCareLine } from '../src/systems/selfCareSpeech';

const NOW = 1_825_100_000_000;

function mature(name: string, seed: number) {
  const creature = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...creature,
    development: { ...creature.development, cognitiveLevel: 92, languageLevel: 88, stage: 'mature' as const },
  };
}

// Younger minds still act on their bodies but do not narrate them.
const young = createHatchedCreature(createNewCreature('Young', 7));
assert.equal(getSelfCareLine(young, 'pee', NOW), null);
assert.equal(getSelfCareLine(young, 'sleep', NOW), null);
const sentences = { ...young, development: { ...young.development, cognitiveLevel: 80, languageLevel: 70, stage: 'sentences' as const } };
assert.equal(getSelfCareLine(sentences, 'poop', NOW), null, 'only a mature mind announces self-care');

// A sleeping creature never talks.
const asleep = { ...mature('Asleep', 11), sleepState: 'sleeping' as const };
assert.equal(getSelfCareLine(asleep, 'pee', NOW), null);

// English is the canonical copy; Polish is the bundled translation.
const english = mature('English', 13);
const enLine = getSelfCareLine(english, 'pee', NOW);
assert.ok(enLine && /piss|pee|bathroom|nature/i.test(enLine), `expected an English pee line, got: ${enLine}`);
const polish = { ...english, conversation: { ...english.conversation, language: 'pl' as const } };
const plLine = getSelfCareLine(polish, 'pee', NOW);
assert.ok(plLine && /(siku|siusiu|odla|kąt|natura)/i.test(plLine), `expected a Polish pee line, got: ${plLine}`);
assert.notEqual(enLine, plLine);

// Personality picks the tone: a committed degen is blunt, a monk is soft.
const degen = { ...english, lifePath: { ...english.lifePath, primary: 'degen' as const } };
assert.match(getSelfCareLine(degen, 'poop', NOW) ?? '', /shit/i);
const monk = { ...english, lifePath: { ...english.lifePath, primary: 'monk' as const } };
assert.match(getSelfCareLine(monk, 'poop', NOW) ?? '', /quiet corner|privacy/i);
const monkPl = { ...monk, conversation: { ...monk.conversation, language: 'pl' as const } };
assert.match(getSelfCareLine(monkPl, 'poop', NOW) ?? '', /kąta|prywatności/i);

// The pick is deterministic for the same state and minute.
assert.equal(getSelfCareLine(english, 'sleep', NOW), getSelfCareLine(english, 'sleep', NOW));

console.log('Self-care speech checks passed.');
