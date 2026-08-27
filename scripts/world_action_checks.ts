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
import {
  createWorldEnvironment,
  receiveWeatherSnapshot,
  setWeatherLocation,
} from '../src/systems/environmentSystem';

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

assert.deepEqual(parseWorldIntent('Chodźmy na dwór.'), { kind: 'go_outside' });
assert.deepEqual(parseWorldIntent('go outside and tell me what the weather is like'), { kind: 'go_outside' });
assert.deepEqual(parseWorldIntent('Please come back inside'), { kind: 'come_inside' });
assert.deepEqual(parseWorldIntent('go look in the box'), { kind: 'use_object', objectType: 'box' });
assert.deepEqual(parseWorldIntent('Look inside the box'), { kind: 'use_object', objectType: 'box' });
assert.equal(parseWorldIntent('Lubię deszcz za oknem.'), null, 'a weather mention is not automatically a command');

const outdoorNow = NOW + 80_000;
const weatherLocation = {
  source: 'city' as const,
  name: 'Dublin',
  latitude: 53.35,
  longitude: -6.26,
  timezone: 'UTC',
  countryCode: 'IE',
  country: 'Ireland',
};
const weatherReady = {
  ...base,
  world: receiveWeatherSnapshot(setWeatherLocation(createWorldEnvironment(), weatherLocation, 'unknown'), {
    locationKey: '53.35,-6.26',
    fetchedAt: outdoorNow,
    observedAt: outdoorNow,
    timezone: 'UTC',
    utcOffsetSeconds: 0,
    temperatureC: 18,
    apparentTemperatureC: 18,
    precipitationMm: 0,
    precipitationProbability: 10,
    weatherCode: 0,
    condition: 'clear',
    cloudCover: 10,
    windSpeedKph: 8,
    isDay: true,
    sunrise: '2026-08-27T06:20',
    sunset: '2026-08-27T20:10',
    dailyDate: '2026-08-27',
    dailyMinC: 11,
    dailyMaxC: 21,
  }),
};
const spokenOut = beginConversationTurn(weatherReady, 'Chodźmy na dwór.', outdoorNow, { worldAction: true }).state;
assert.deepEqual(spokenOut.personality, weatherReady.personality, 'an outdoor command must not rewrite personality');
assert.equal(spokenOut.lifePath.primary, weatherReady.lifePath.primary, 'an outdoor command must not assign a life path');

const wentOut = performImmediateWorldAction(weatherReady, { kind: 'go_outside' }, outdoorNow);
assert.equal(wentOut.result.status, 'success');
assert.equal(wentOut.state.world.place, 'outdoors');
assert.match(groundedWorldReply(wentOut.result, 'en'), /outside|clear/i);
assert.deepEqual(wentOut.state.lifePath, weatherReady.lifePath);

const alreadyOut = performImmediateWorldAction(wentOut.state, { kind: 'go_outside' }, outdoorNow + 1);
assert.equal(alreadyOut.result.status, 'already_satisfied');

const cameInside = performImmediateWorldAction(wentOut.state, { kind: 'come_inside' }, outdoorNow + 2);
assert.equal(cameInside.result.status, 'success');
assert.equal(cameInside.state.world.place, 'indoor');

const solarSky = performImmediateWorldAction(base, { kind: 'go_outside' }, outdoorNow);
assert.equal(solarSky.result.status, 'success', 'a solar sky is enough to go outside');
assert.equal(solarSky.state.world.place, 'outdoors');
assert.doesNotMatch(groundedWorldReply(solarSky.result, 'en'), /there is no outside from here yet/i);

const staleWeather = performImmediateWorldAction({
  ...weatherReady,
  world: { ...weatherReady.world, status: 'error', lastError: 'weather_unavailable' },
}, { kind: 'go_outside' }, outdoorNow);
assert.equal(staleWeather.result.status, 'success', 'last-known sky must still allow an outdoor visit');

assert.doesNotMatch(groundedWorldReply({
  intent: { kind: 'use_object', objectType: 'box' },
  status: 'success',
  objectType: 'box',
}, 'en'), /bell|crinkle|tiny/i);
assert.match(groundedWorldReply({
  intent: { kind: 'use_object', objectType: 'box' },
  status: 'success',
  objectType: 'box',
}, 'en'), /checked the box/i);

const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
const cssSource = readFileSync('src/index.css', 'utf8');
assert.match(roomSource, /const roomSpeech = state\.conversation\.lastCreatureMessage/);
assert.match(roomSource, /room-header relative z-30 safe-top/);
assert.match(roomSource, /room-conversation-zone/);
assert.doesNotMatch(roomSource, /setTimeout\(\(\) => setSpeech\(null\)/, 'the last utterance must not disappear on a timer');
assert.match(cssSource, /min-height: calc\(7\.25rem \+ env\(safe-area-inset-top\)\)/, 'the mobile header must reserve safe-area space');
assert.match(roomSource, /beginOutdoorVisit/);
assert.match(roomSource, /shouldEndOutdoorVisit/);

console.log('World action and room-first conversation checks passed.');
