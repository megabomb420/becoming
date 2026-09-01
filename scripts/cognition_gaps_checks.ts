import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { extractUserFact } from '../src/systems/conversationSystem';
import { evaluateImitation, parseUserStatement, recordObservation } from '../src/systems/socialLearningSystem';
import { advanceDevelopmentFromConversation, syncDevelopmentWithAge } from '../src/systems/developmentSystem';
import { GameState, ObservedBehaviour } from '../src/types';

const NOW = Date.UTC(2026, 7, 23, 12, 0);

function socialBase(): GameState {
  const base = createHatchedCreature(createNewCreature('Soc', 55));
  return {
    ...base,
    personality: { ...base.personality, curiosity: 70, impulsiveness: 70, caution: 10, independence: 10 },
    development: { ...base.development, cognitiveLevel: 40, languageLevel: 30, stage: 'sentences' as const, hatched: true },
    relationship: { ...base.relationship, attachment: 70, trust: 70 },
    emotionalState: 'happy' as const,
  };
}

// --- Conversation parsing (extractUserFact) ---
assert.deepEqual(extractUserFact('My name is Alice.'), { kind: 'name', value: 'Alice', sentiment: 0.3 });
assert.deepEqual(extractUserFact('Mam na imię Ola.'), { kind: 'name', value: 'Ola', sentiment: 0.3 });
assert.deepEqual(extractUserFact('I like coffee.'), { kind: 'like', value: 'coffee', sentiment: 0.8 });
assert.deepEqual(extractUserFact('Nienawidzę kawy.'), { kind: 'dislike', value: 'kawy', sentiment: -0.8 });
assert.equal(extractUserFact('I feel tired.')?.kind, 'feeling');
assert.equal(extractUserFact('I feel tired.')?.value, 'tired');
const goal = extractUserFact('I want to get fit because it matters.');
assert.equal(goal?.kind, 'goal');
assert.equal(goal?.value, 'get fit', 'a trailing justification must be trimmed from a learned fact');
assert.equal(extractUserFact('Hello, how are you?'), null, 'a plain greeting is not a fact');

// --- Behaviour parsing (parseUserStatement) ---
assert.equal(parseUserStatement('Piję kawę, bo lubię.')?.action, 'drink');
assert.equal(parseUserStatement('Piję kawę, bo lubię.')?.target, 'kawę');
assert.equal(parseUserStatement('Piję kawę, bo lubię.')?.perceivedReward, 0.6);
assert.equal(parseUserStatement('Jarałem zioło i się relaksuję.')?.action, 'smoke');
assert.equal(parseUserStatement('Jarałem zioło i się relaksuję.')?.target, 'zioło');
assert.equal(parseUserStatement('Biegam codziennie rano.')?.action, 'exercise');
assert.equal(parseUserStatement('A very normal Tuesday.'), null);

// --- Social learning: observations accumulate and become patterns ---
const first = recordObservation(socialBase(), 'Piję kawę, bo lubię.');
const firstObs = first.socialLearning.observations.find(obs => obs.action === 'drink' && obs.target === 'kawę');
assert.ok(firstObs, 'recordObservation must create a first observation');
assert.equal(firstObs?.frequency, 'once');
assert.equal(firstObs?.exposureCount, 1);
assert.ok(first.socialLearning.activeCuriosities.includes('kawę'), 'a curious mind records a new behaviour as an active curiosity');

const second = recordObservation(first, 'Znowu piłem kawę.');
const secondObs = second.socialLearning.observations.find(obs => obs.action === 'drink' && obs.target === 'kawę');
assert.equal(secondObs?.exposureCount, 2);
assert.equal(secondObs?.frequency, 'sometimes', 'repeating behaviour must escalate frequency');

// --- Imitation decision is bounded and reads the evidence ---
const strong: ObservedBehaviour = {
  id: 'obs-strong', behaviourType: 'activity', action: 'play', target: 'gry', context: 'gaming',
  frequency: 'often', exposureCount: 5, timestamp: 0, perceivedUserEmotion: 'positive',
  perceivedReward: 0.8, perceivedNegativeOutcome: 0, confidence: 0.9, userExplanation: '',
  mentioned: false, imitated: false, creatureOpinion: null, lastThoughtAbout: 0,
};
assert.equal(evaluateImitation(socialBase(), strong).shouldImitate, true, 'a rewarding, repeated behaviour can be imitated');
assert.equal(
  evaluateImitation({ ...socialBase(), development: { ...socialBase().development, cognitiveLevel: 5 } }, strong).shouldImitate,
  false,
  'a mind too young cannot imitate',
);

// --- Age floors: real time raises a non-regressing minimum, never lowers ---
const fortyDays = 40 * 24 * 60 * 60 * 1000;
const aged = {
  ...socialBase(),
  identity: { ...socialBase().identity, birthTimestamp: NOW - fortyDays },
  development: { ...socialBase().development, cognitiveLevel: 5, languageLevel: 0, emotionalLevel: 0, independence: 0 },
};
const synced = syncDevelopmentWithAge(aged, NOW);
assert.equal(synced.development.chronologicalAge, fortyDays);
assert.ok(synced.development.cognitiveLevel >= 75, 'a 40-day-old life must meet the 30-day cognitive floor');
assert.ok(synced.development.languageLevel >= 65);
assert.ok(synced.development.independence >= 52);
assert.equal(
  syncDevelopmentWithAge({ ...aged, development: { ...aged.development, cognitiveLevel: 92 } }, NOW).development.cognitiveLevel,
  92,
  'age floors must never lower a precocious creature',
);

// One conversation is a learning event, and it never regresses.
const afterConvo = advanceDevelopmentFromConversation(synced, NOW);
assert.ok(afterConvo.development.cognitiveLevel > synced.development.cognitiveLevel, 'a conversation advances cognition');
assert.ok(afterConvo.development.languageLevel > synced.development.languageLevel, 'a conversation advances language');
assert.ok(afterConvo.development.cognitiveLevel >= synced.development.cognitiveLevel, 'conversation growth must not regress');

console.log('Conversation parsing, social learning, and age-floor checks passed.');
