import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  chooseAutonomousMoment,
  getVisiblePersonalitySignature,
} from '../src/systems/relationshipSystem';
import {
  markMeaningfulFirstAnnounced,
  observeDevelopmentSignals,
  recordAutonomousMoment,
  recordMeaningfulFirst,
} from '../src/systems/developmentSystem';
import { simulateOfflineTime } from '../src/systems/offlineSimulation';
import { consumeReturnTrace, migratePresenceState, registerReturn } from '../src/systems/presenceSystem';
import { parseImportedGameState, serializeGameState } from '../src/systems/persistence';

let careful = createHatchedCreature(createNewCreature('Careful', 90210));
careful = {
  ...careful,
  personality: {
    ...careful.personality,
    curiosity: 82,
    caution: 78,
    confidence: 35,
    impulsiveness: 28,
  },
};
assert.equal(getVisiblePersonalitySignature(careful).id, 'still_forming', 'raw temperament alone must not create a strong visible trait');
for (let index = 0; index < 3; index += 1) {
  careful = recordAutonomousMoment(careful, 'cautious_probe', 1_809_999_000_000 + index * 60_000);
}
assert.equal(getVisiblePersonalitySignature(careful).id, 'careful_explorer');

let bold = createHatchedCreature(createNewCreature('Bold', 90211));
bold = {
  ...bold,
  personality: {
    ...bold.personality,
    curiosity: 84,
    caution: 18,
    confidence: 75,
    impulsiveness: 72,
  },
  roomObjects: [{ id: 'bold-ball', type: 'ball', x: 64, y: 65, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: false }],
};
assert.equal(getVisiblePersonalitySignature(bold).id, 'still_forming');
for (let index = 0; index < 3; index += 1) {
  bold = recordAutonomousMoment(bold, 'bold_test', 1_809_999_000_000 + index * 60_000, 'ball');
}
assert.equal(getVisiblePersonalitySignature(bold).id, 'bold_tinkerer');

const selectionTime = 1_810_000_000_000;
assert.deepEqual(chooseAutonomousMoment(bold, selectionTime), chooseAutonomousMoment(bold, selectionTime), 'autonomy selection must be deterministic for the same state and time bucket');
let firstChoice = null;
let choiceTime = selectionTime;
for (let index = 0; index < 30 && !firstChoice; index += 1) {
  choiceTime = selectionTime + index * 7_000;
  firstChoice = chooseAutonomousMoment(bold, choiceTime);
}
assert.ok(firstChoice, 'a lively creature should eventually choose an autonomous moment');
bold = recordAutonomousMoment(bold, firstChoice!.id, choiceTime, firstChoice!.objectType);
const immediateNext = chooseAutonomousMoment(bold, choiceTime + 7_000);
assert.notEqual(immediateNext?.id, firstChoice!.id, 'cooldown and recency must prevent an immediate repeat');

let firsts = createHatchedCreature(createNewCreature('Firsts', 7007));
firsts = recordMeaningfulFirst(firsts, 'first_spontaneous_approach', 1_810_000_100_000);
firsts = recordMeaningfulFirst(firsts, 'first_spontaneous_approach', 1_810_000_101_000);
assert.equal(firsts.development.experience.firsts.length, 1, 'meaningful firsts must be idempotent');
assert.equal(firsts.memories.filter(memory => memory.tags.includes('first_spontaneous_approach')).length, 1);
firsts = markMeaningfulFirstAnnounced(firsts, 'first_spontaneous_approach');
assert.equal(firsts.development.experience.firsts[0].announced, true);

const beforeSignals = createHatchedCreature(createNewCreature('Signals', 8080));
const afterSignals = {
  ...beforeSignals,
  vocabulary: [{ word: 'home', learnedAt: 1_810_000_200_000, confidence: .4, contexts: ['room'], usageCount: 0 }],
  objectPreferences: {
    ...beforeSignals.objectPreferences,
    blanket: { ...beforeSignals.objectPreferences.blanket, interactions: 3, affinity: 22 },
  },
  creations: [{ id: 'first-mark', stage: 'mark' as const, title: 'First mark', description: 'A line.', glyph: '∿', inspiration: 'room', createdAt: 1_810_000_200_000 }],
};
const observed = observeDevelopmentSignals(beforeSignals, afterSignals, 1_810_000_200_000);
assert.ok(observed.development.experience.firsts.some(first => first.id === 'first_word'));
assert.ok(observed.development.experience.firsts.some(first => first.id === 'first_favorite'));
assert.ok(observed.development.experience.firsts.some(first => first.id === 'first_creation'));
assert.equal(observed.development.experience.favoriteObject, 'blanket');

let returning = createHatchedCreature(createNewCreature('Returning', 4444));
returning = {
  ...returning,
  development: {
    ...returning.development,
    cognitiveLevel: 35,
    experience: { ...returning.development.experience, favoriteObject: 'stone' },
  },
  roomObjects: [
    { id: 'trace-stone', type: 'stone', x: 38, y: 66, state: {}, interactions: 4, placedByUser: true, beingUsedByCreature: false },
    { id: 'trace-blanket', type: 'blanket', x: 65, y: 67, state: {}, interactions: 2, placedByUser: true, beingUsedByCreature: false },
  ],
  objectPreferences: {
    ...returning.objectPreferences,
    stone: { ...returning.objectPreferences.stone, interactions: 4, affinity: 28 },
  },
};
const offline = simulateOfflineTime(returning, 3 * 60 * 60_000);
assert.ok(offline.state.presence.pendingTrace, 'offline life must leave one visible room trace');
assert.ok(offline.activities.length > 0);
const returned = registerReturn(offline.state, 3 * 60 * 60_000, Date.now(), offline.activities);
assert.ok(returned.presence.pendingTrace);
assert.ok(returned.presence.absenceEpisodes.at(-1)?.trace);
assert.ok(returned.presence.pendingGreeting);
assert.equal(returned.presence.pendingGreeting?.includes('Kiedy cię nie było'), false, 'trace detail should wait behind the physical room change');
const traceId = returned.presence.pendingTrace!.id;
const consumed = consumeReturnTrace(returned);
assert.equal(consumed.presence.pendingTrace, null);
assert.equal(consumed.roomObjects.some(object => object.state.returnTraceId === traceId), false);

const migratedPresence = migratePresenceState({
  ...returning.presence,
  pendingTrace: {
    id: 'legacy-trace',
    kind: 'moved_object',
    timestamp: 1_810_000_300_000,
    captionEn: 'Moved.',
    captionPl: 'Przesunięte.',
  },
}, 1_810_000_300_000);
assert.equal(migratedPresence.pendingTrace?.id, 'legacy-trace');

const legacyEnvelope = JSON.parse(serializeGameState(returning));
delete legacyEnvelope.state.development.experience;
delete legacyEnvelope.state.presence.pendingTrace;
const migratedLegacy = parseImportedGameState(JSON.stringify(legacyEnvelope));
assert.deepEqual(migratedLegacy.development.experience.firsts, []);
assert.ok(Number.isFinite(migratedLegacy.development.experience.preferredRestSpot.x));
assert.equal(migratedLegacy.presence.pendingTrace, null);

console.log('Personality signatures, deterministic autonomy, meaningful firsts, return traces, and legacy migration checks passed.');
