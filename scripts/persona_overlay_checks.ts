import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { beginConversationTurn, migrateConversationState } from '../src/systems/conversationSystem';
import {
  buildCreatureMindRequest,
  shouldCreatureSelfSpeak,
} from '../src/systems/llmConversation';
import {
  evolveLifePath,
  evolveLifePathFromCreatureStatement,
  getLifePathTitle,
} from '../src/systems/lifePathSystem';

const NOW = 1_825_100_000_000;

function hatched(name: string, seed: number) {
  const creature = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...creature,
    conversation: { ...creature.conversation, language: 'pl' as const },
    development: { ...creature.development, cognitiveLevel: 58, languageLevel: 52, stage: 'sentences' as const },
  };
}

function withMessage(state: ReturnType<typeof hatched>, text: string) {
  return beginConversationTurn(state, text, NOW, { worldAction: true }).state;
}

const unwritten = withMessage(hatched('Unwritten', 101), 'Cześć.');
const unwrittenBody = buildCreatureMindRequest(unwritten);
assert.equal(unwrittenBody.lifePath, undefined, 'unwritten creatures send a thin request');
assert.equal(unwrittenBody.influence, undefined);
assert.equal(unwrittenBody.innerLife, undefined);
assert.equal(unwrittenBody.continuity, undefined);
assert.equal(unwrittenBody.creations, undefined);
assert.equal(unwrittenBody.presence, undefined);
assert.equal(unwrittenBody.care, undefined);
assert.equal(unwrittenBody.sharedLanguage, undefined);
assert.equal(unwrittenBody.facts, undefined);
assert.equal(unwrittenBody.habits, undefined);
assert.equal(unwrittenBody.weather, undefined);
assert.deepEqual(Object.keys(unwrittenBody.creature).sort(), ['ageDays', 'clock', 'language', 'mood', 'name', 'stage']);
assert.equal(unwrittenBody.creature.clock?.schedule, 'diurnal');
assert.equal(typeof unwrittenBody.creature.clock?.rest, 'boolean');
assert.ok(unwrittenBody.messages.length >= 1);
assert.equal(shouldCreatureSelfSpeak(unwritten), false);
assert.equal(shouldCreatureSelfSpeak({ ...unwritten, sleepState: 'sleeping' }), false);
assert.equal(buildCreatureMindRequest({ ...unwritten, sleepState: 'sleeping' }).creature.mood, 'asleep');
assert.equal(buildCreatureMindRequest({ ...unwritten, sleepState: 'drowsy' }).creature.mood, 'sleepy');
assert.equal(shouldCreatureSelfSpeak(unwritten, Date.UTC(2026, 7, 27, 1, 30)), false, 'no idle self-speak on an ordinary night');

let mentioned = hatched('Mention', 202);
mentioned = evolveLifePath(mentioned, 'zapalmy', NOW);
const mentionedBody = buildCreatureMindRequest(withMessage(mentioned, 'zapalmy'));
assert.equal(mentioned.lifePath.primary, null);
assert.equal(mentioned.lifePath.evidence.stoner.creaturePreferences, 0);
assert.equal(mentionedBody.lifePath, undefined, 'a user invitation must not attach a stoner overlay');
assert.doesNotMatch(JSON.stringify(mentionedBody), /Jaracz|Stoner/);

let curious = hatched('Curious', 303);
curious = evolveLifePathFromCreatureStatement(curious, 'Ciekawi mnie jarać?', NOW);
const curiousBody = buildCreatureMindRequest(withMessage(curious, 'Co myślisz?'));
assert.equal(curiousBody.lifePath?.layer, 'curiosity');
assert.equal(curiousBody.lifePath?.id, 'stoner');
assert.equal(curiousBody.lifePath?.title, undefined, 'curiosity is one line, not a costume');
assert.doesNotMatch(JSON.stringify(curiousBody.lifePath), /Jaracz/);

let leaning = hatched('Leaning', 404);
leaning = evolveLifePathFromCreatureStatement(leaning, 'Lubię jarać.', NOW);
const leaningBody = buildCreatureMindRequest(withMessage(leaning, 'I co?'));
assert.equal(leaningBody.lifePath?.layer, 'leaning', 'a creature preference leans without becoming Jaracz');
assert.equal(leaningBody.lifePath?.id, 'stoner');
assert.doesNotMatch(JSON.stringify(leaningBody.lifePath), /Jaracz/);
assert.notEqual(getLifePathTitle(leaning, 'pl'), 'Jaracz');

let jaracz = hatched('Stable', 505);
for (let index = 0; index < 7; index += 1) {
  jaracz = evolveLifePathFromCreatureStatement(
    jaracz,
    'Wybieram palić zioło. To moja decyzja.',
    NOW + index * 2 * 60 * 60_000,
  );
}
assert.equal(jaracz.lifePath.primary, 'stoner');
assert.equal(getLifePathTitle(jaracz, 'pl'), 'Jaracz');
const jaraczBody = buildCreatureMindRequest(withMessage(jaracz, 'Jak się czujesz?'));
assert.equal(jaraczBody.lifePath?.layer, 'identity');
assert.equal(jaraczBody.lifePath?.title, 'Jaracz');
assert.ok(jaraczBody.lifePath?.description);
assert.ok(jaraczBody.influence, 'a real flawed primary in a meaningful band earns influence');
if (jaracz.lifePath.phase === 'committed' || jaracz.lifePath.phase === 'embodied') {
  assert.ok(jaraczBody.lifePath?.cost, 'committed or embodied identity includes the cost');
}

let rejected = hatched('Reject', 606);
rejected = evolveLifePath(rejected, 'zapalmy', NOW);
rejected = evolveLifePathFromCreatureStatement(rejected, 'Nie chcę jarać. To nie dla mnie.', NOW + 1_000);
const rejectedBody = buildCreatureMindRequest(withMessage(rejected, 'No to co?'));
assert.equal(rejected.lifePath.primary, null);
assert.equal(rejectedBody.lifePath?.layer, 'rejection');
assert.match(JSON.stringify(rejectedBody.lifePath?.doesNotWant), /Jaracz|stoner/i);
assert.doesNotMatch(JSON.stringify(rejectedBody.lifePath), /"title":"Jaracz"/);
assert.equal(rejectedBody.influence, undefined, 'rejection must peel the flawed costume');

const comfortable = hatched('Comfort', 707);
const comfortableBody = buildCreatureMindRequest(withMessage(comfortable, 'Hej.'));
assert.equal(comfortableBody.care, undefined, 'care overlay is omitted when needs are comfortable');

const hungry = {
  ...comfortable,
  needs: { ...comfortable.needs, hunger: 18 },
};
const hungryBody = buildCreatureMindRequest(withMessage(hungry, 'Hej.'));
assert.ok(hungryBody.care, 'care overlay is present when a need is not comfortable');
assert.equal(hungryBody.care?.hunger, 'very_hungry');
assert.equal(shouldCreatureSelfSpeak(hungry), true);
assert.equal(shouldCreatureSelfSpeak(comfortable), false);

const dirty = {
  ...comfortable,
  needs: { ...comfortable.needs, hygiene: 20 },
};
assert.equal(shouldCreatureSelfSpeak(dirty), true);
assert.ok(buildCreatureMindRequest(withMessage(dirty, 'Hej.')).care);

const bathroom = {
  ...comfortable,
  needs: { ...comfortable.needs, bladder: 12 },
};
assert.equal(shouldCreatureSelfSpeak(bathroom), true);

const outdoors = {
  ...comfortable,
  world: {
    ...comfortable.world,
    settings: { ...comfortable.world.settings, mode: 'city' as const },
    current: {
      locationKey: '53.35,-6.26',
      fetchedAt: NOW,
      observedAt: NOW,
      timezone: 'UTC',
      utcOffsetSeconds: 0,
      temperatureC: 12,
      apparentTemperatureC: 11,
      precipitationMm: 1.2,
      precipitationProbability: 80,
      weatherCode: 63,
      condition: 'rain' as const,
      cloudCover: 90,
      windSpeedKph: 18,
      isDay: true,
      sunrise: '2026-08-27T06:20',
      sunset: '2026-08-27T20:10',
      dailyDate: '2026-08-27',
      dailyMinC: 8,
      dailyMaxC: 14,
    },
    place: 'outdoors' as const,
  },
};
const outdoorBody = buildCreatureMindRequest(withMessage(outdoors, 'Co tam?'));
assert.equal(outdoorBody.weather?.place, 'outdoors');
assert.equal(outdoorBody.weather?.condition, 'rain');

const nightClock = buildCreatureMindRequest({
  ...unwritten,
  world: {
    ...unwritten.world,
    settings: {
      ...unwritten.world.settings,
      mode: 'city',
      location: {
        source: 'city',
        name: 'UTC',
        latitude: 51.5,
        longitude: 0,
        timezone: 'UTC',
        countryCode: 'GB',
        country: 'UTC',
      },
    },
  },
}, { now: Date.UTC(2026, 7, 27, 1, 30) });
assert.equal(nightClock.creature.clock?.phase, 'night');
assert.equal(nightClock.creature.clock?.rest, true, 'an ordinary mind at night is in its rest');
assert.equal(nightClock.creature.clock?.schedule, 'diurnal');

const spokenOffer = beginConversationTurn(comfortable, 'Masz, dam ci jabłko.', NOW + 50_000, { worldAction: true }).state;
assert.deepEqual(spokenOffer.personality, comfortable.personality, 'a world command must not rewrite personality');
assert.equal(spokenOffer.lifePath.primary, comfortable.lifePath.primary);

const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
assert.doesNotMatch(roomSource, /generateCreatureSpeech/, 'canned language-system lines must not fill the room bubble');
assert.doesNotMatch(roomSource, /moment\.utterance/, 'autonomous utterances must not fill the room bubble');
assert.doesNotMatch(roomSource, /trigger:\s*'idle'/, 'local idle chatter must not fill the bubble');
assert.doesNotMatch(roomSource, /triggerSpeech\(turn\.reply\)/, 'worker failure must not invent a local line');
assert.doesNotMatch(roomSource, /Quiet here\.|What now\?/);
assert.match(roomSource, /kind:\s*'self'/, 'rare self-speak must reuse /chat');
assert.match(roomSource, /groundedWorldReply/);
assert.match(roomSource, /resetArmed|Really start over|Na pewno zacząć/, 'start-over must show an in-sheet confirm');
assert.match(readFileSync('src/App.tsx', 'utf8'), /resetForNewLife/);
assert.match(readFileSync('src/systems/persistence.ts', 'utf8'), /deleteDatabase/);
assert.equal(migrateConversationState({ lastCreatureMessage: 'Quiet here.' }).lastCreatureMessage, null);
assert.equal(migrateConversationState({ lastCreatureMessage: 'What now?' }).lastCreatureMessage, null);

console.log('Persona overlay checks passed.');
