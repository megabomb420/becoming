import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { chooseObjectReaction } from '../src/systems/relationshipSystem';
import { beginConversationTurn, isRestingChatGate } from '../src/systems/conversationSystem';
import {
  applyWorldObjectReaction,
  beginWorldObjectApproach,
  beginComeHere,
  groundedWorldReply,
  offerObjectFromInventory,
  parseWorldIntent,
  performImmediateWorldAction,
  resultFromObjectReaction,
  semanticActionToWorldIntent,
} from '../src/systems/worldActionSystem';
import {
  createWorldEnvironment,
  receiveWeatherSnapshot,
  setWeatherLocation,
  shouldEndOutdoorVisit,
} from '../src/systems/environmentSystem';

const NOW = Date.UTC(2026, 7, 27, 12, 0);
const base = createHatchedCreature(createNewCreature('World', 4117));

assert.deepEqual(parseWorldIntent('Masz, dam ci jabłko.'), { kind: 'offer_object', objectType: 'apple' });
assert.deepEqual(parseWorldIntent('Please play with the ball'), { kind: 'use_object', objectType: 'ball' });
assert.deepEqual(parseWorldIntent('Napij się wody'), { kind: 'drink', objectType: 'water_bowl' });
assert.deepEqual(parseWorldIntent('idź spać'), { kind: 'sleep' });
assert.deepEqual(parseWorldIntent('go to sleep'), { kind: 'sleep' });
assert.deepEqual(parseWorldIntent('użyj poduszki'), { kind: 'use_object', objectType: 'cushion' });
assert.deepEqual(parseWorldIntent('play with the jingle toy'), { kind: 'use_object', objectType: 'jingle_toy' });
assert.deepEqual(parseWorldIntent('daj mi szczotkę'), { kind: 'offer_object', objectType: 'brush' });
assert.equal(parseWorldIntent('Lubię jabłka, ale ty nie musisz.'), null, 'an object mention is not automatically a command');
// The local fast path stays conservative: first-person, negated, and
// third-person toilet statements are ordinary conversation, not commands.
assert.equal(parseWorldIntent('ja idę się wysrać'), null);
assert.equal(parseWorldIntent('nie wysraj się'), null);
assert.equal(parseWorldIntent('mój pies zrobił kupę'), null);
assert.equal(parseWorldIntent('chyba chce ci się kupę'), null);

// Semantic world actions map to canonical local intents; invalid or
// unallowlisted model actions are rejected before any state changes.
assert.deepEqual(semanticActionToWorldIntent({ type: 'toilet', target: 'poop' }), { kind: 'toilet', objectType: 'litter_box', target: 'poop' });
assert.deepEqual(semanticActionToWorldIntent({ type: 'drink' }), { kind: 'drink', objectType: 'water_bowl' });
assert.deepEqual(semanticActionToWorldIntent({ type: 'use_object', target: 'cushion' }), { kind: 'use_object', objectType: 'cushion' });
assert.equal(semanticActionToWorldIntent({ type: 'use_object', target: 'guitar' }), null);
assert.equal(semanticActionToWorldIntent({ type: 'reset_save' }), null);
assert.equal(semanticActionToWorldIntent(null), null);

const semanticToiletIntent = semanticActionToWorldIntent({ type: 'toilet', target: 'poop' });
assert.ok(semanticToiletIntent);
const semanticToilet = performImmediateWorldAction(
  { ...base, needs: { ...base.needs, bowel: 10, bladder: 90 } },
  semanticToiletIntent,
  NOW,
);
assert.equal(semanticToilet.result.status, 'success');
assert.ok(semanticToilet.state.needs.bowel > 70);
assert.deepEqual(semanticToilet.state.personality, base.personality, 'a semantic world action must not rewrite personality');
assert.equal(semanticToilet.state.lifePath.primary, base.lifePath.primary, 'a semantic world action must not assign a life path');

const cushionReaction = chooseObjectReaction({ ...base, needs: { ...base.needs, comfort: 20 } }, 'cushion');
assert.ok(cushionReaction.needDelta.comfort > 0, 'a low-comfort cushion use must restore comfort');
const brushReaction = chooseObjectReaction({ ...base, needs: { ...base.needs, hygiene: 40 } }, 'brush');
assert.ok(brushReaction.needDelta.hygiene > 0, 'a dirty brush use must restore hygiene');
const jingleReaction = chooseObjectReaction({ ...base, needs: { ...base.needs, stimulation: 30 } }, 'jingle_toy');
assert.ok(jingleReaction.needDelta.stimulation > 0, 'a restless jingle toy use must restore stimulation');

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

const sleepAsked = performImmediateWorldAction({
  ...base,
  needs: { ...base.needs, energy: 12 },
}, { kind: 'sleep' }, NOW);
assert.equal(sleepAsked.result.status, 'success');
assert.equal(sleepAsked.state.sleepState, 'awake', 'asking them to rest must not force sleep');

// Commanded sleep may settle a body that is already dozing or visibly tired
// (energy below the attention threshold), but it cannot rewrite their solar
// day: wide awake with energy during their wake, the refusal is a clock line.
const utcNoonWorld = {
  ...base,
  world: {
    ...base.world,
    settings: {
      ...base.world.settings,
      mode: 'city' as const,
      location: {
        source: 'city' as const,
        name: 'UTC',
        latitude: 51.5,
        longitude: 0,
        timezone: 'UTC',
        countryCode: 'GB',
        country: 'UTC',
      },
    },
  },
};
const tiredDaySleep = performImmediateWorldAction({
  ...utcNoonWorld,
  needs: { ...utcNoonWorld.needs, energy: 30 },
}, { kind: 'sleep' }, NOW);
assert.equal(tiredDaySleep.result.status, 'success', 'a visibly tired body (energy below the attention threshold) may be asked to settle during its day');
const drowsySleep = performImmediateWorldAction({
  ...utcNoonWorld,
  sleepState: 'drowsy' as const,
  needs: { ...utcNoonWorld.needs, energy: 90 },
}, { kind: 'sleep' }, NOW);
assert.equal(drowsySleep.result.status, 'success', 'a dozing creature may be asked to settle');
const dayHighEnergy = performImmediateWorldAction(utcNoonWorld, { kind: 'sleep' }, NOW);
assert.equal(dayHighEnergy.result.status, 'refused', 'a wide-awake, full-energy creature cannot be commanded into its night');
assert.equal(dayHighEnergy.result.reason, 'not_tired');
assert.doesNotMatch(groundedWorldReply(dayHighEnergy.result, 'en'), /too much energy/i, 'the English refusal must not claim a fake surplus of energy');
assert.doesNotMatch(groundedWorldReply(dayHighEnergy.result, 'pl'), /za dużo energii|za duzo energii/i, 'the Polish refusal must not claim a fake surplus of energy');
assert.match(groundedWorldReply(dayHighEnergy.result, 'en'), /my day/i, 'the refusal is a clock line about their day');
assert.match(groundedWorldReply(dayHighEnergy.result, 'pl'), /mój dzień/i, 'the Polish refusal is a clock line about their day');
const alreadySleeping = performImmediateWorldAction({
  ...utcNoonWorld,
  sleepState: 'sleeping' as const,
}, { kind: 'sleep' }, NOW);
assert.equal(alreadySleeping.result.status, 'already_satisfied', 'an already sleeping creature simply stays asleep');

const cameCloser = beginComeHere(base, { x: 50, y: 74 });
assert.deepEqual(cameCloser.position, { x: 50, y: 74 });
assert.equal(cameCloser.creatureBehavior, 'walking');

assert.deepEqual(parseWorldIntent('Chodźmy na dwór.'), { kind: 'go_outside' });
assert.deepEqual(parseWorldIntent('go outside and tell me what the weather is like'), { kind: 'go_outside' });
assert.deepEqual(parseWorldIntent('Please come back inside'), { kind: 'come_inside' });
assert.deepEqual(parseWorldIntent('go look in the box'), { kind: 'use_object', objectType: 'box' });
assert.deepEqual(parseWorldIntent('Look inside the box'), { kind: 'use_object', objectType: 'box' });
assert.equal(parseWorldIntent('Lubię deszcz za oknem.'), null, 'a weather mention is not automatically a command');

const box = { id: 'box-live', type: 'box' as const, x: 78, y: 68, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: false };
const boxRoom = { ...base, position: { x: 24, y: 60 }, roomObjects: [box] };
const boxApproach = beginWorldObjectApproach(boxRoom, box);
assert.equal(boxApproach.state.creatureBehavior, 'walking', 'inspect must enter the same walking state as object care');
assert.equal(boxApproach.state.facing, 'right');
assert.equal(boxApproach.target.y, box.y);
assert.ok(Math.abs(boxApproach.target.x - box.x) <= 11, 'inspect walk target must be beside the real box position');

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

const utcNight = Date.UTC(2026, 7, 27, 1, 30);
const utcDay = Date.UTC(2026, 7, 27, 14, 0);
const nightWorld = {
  ...weatherReady,
  world: {
    ...weatherReady.world,
    current: weatherReady.world.current ? { ...weatherReady.world.current, observedAt: utcNight, isDay: false } : null,
  },
};
const nightOut = performImmediateWorldAction(nightWorld, { kind: 'go_outside' }, utcNight);
assert.equal(nightOut.result.status, 'refused', 'an ordinary life does not go out on its night');
assert.equal(nightOut.result.reason, 'night_rest');
assert.match(groundedWorldReply(nightOut.result, 'en'), /night/i);

const dayOut = performImmediateWorldAction(nightWorld, { kind: 'go_outside' }, utcDay);
assert.equal(dayOut.result.status, 'success', 'an ordinary life can go out on its day');

const partyNight = {
  ...nightWorld,
  lifePath: {
    ...nightWorld.lifePath,
    primary: 'party_animal' as const,
    phase: 'committed' as const,
    scores: { ...nightWorld.lifePath.scores, party_animal: 52 },
  },
};
const partyOut = performImmediateWorldAction(partyNight, { kind: 'go_outside' }, utcNight);
assert.equal(partyOut.result.status, 'success', 'a settled party life goes out after dark');
assert.equal(shouldEndOutdoorVisit({ ...partyOut.state, sleepState: 'sleeping' }), true, 'sleeping outside must come back in');

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
assert.match(cssSource, /min-height: calc\(6rem \+ env\(safe-area-inset-top\)\)/, 'the compact mobile header still reserves safe-area space');
assert.match(cssSource, /font-size: \.8125rem/, 'the speech bubble must stay compact and less oversized');
assert.match(roomSource, /beginOutdoorVisit/);
assert.match(roomSource, /shouldEndOutdoorVisit/);
assert.match(roomSource, /wantsOutdoors\(currentState, isCreatureRestPhase/, 'autonomous outside must use their rest, not only weather affinity');
assert.match(roomSource, /schedule === 'nocturnal'/, 'a settled night life must be able to want the dark');
const becomingSource = readFileSync('src/components/BecomingView.tsx', 'utf8');
assert.match(becomingSource, /getLivedClockNote/, 'Becoming must portrait their day and night');
assert.match(roomSource, /beginWorldObjectApproach/);
assert.doesNotMatch(roomSource, /Put creature to sleep/);
assert.doesNotMatch(roomSource, /handleSleepToggle/);
assert.match(roomSource, /settleIfSleepy/);
assert.match(roomSource, /isRestingChatGate/, 'talk must not call DeepSeek while they sleep');
assert.match(roomSource, /if \(quietTalkReply \|\| showChat \|\| initiatedTopic\) return;/, 'rest must not initiate a how-was-your-day');
assert.match(roomSource, /if \(isDead\(state\) \|\| !greeting \|\| state\.presence\.pendingTrace \|\| initiatedTopic \|\| showChat \|\| quietTalkReply\) return;/, 'return greetings must wait for wake, not merely an awake body');
const sendStart = roomSource.indexOf('const sendConversationMessage');
const sendBody = roomSource.slice(sendStart, roomSource.indexOf('const handleRoomSubmit'));
assert.ok(sendBody.includes('isRestingChatGate'), 'the send path must check rest before the mind');
assert.ok(
  sendBody.indexOf('isRestingChatGate') < sendBody.indexOf('requestCreatureReply(turn.state)'),
  'rest must close the conversation window before any mind request',
);
assert.ok(
  sendBody.indexOf('isRestingChatGate') < sendBody.indexOf('beginConversationTurn(stateRef.current, text, Date.now())'),
  'rest must close before fact learning or conversation evolution',
);

const sleeper = {
  ...base,
  sleepState: 'sleeping' as const,
  conversation: { ...base.conversation, language: 'pl' as const },
  world: {
    ...base.world,
    settings: {
      ...base.world.settings,
      mode: 'city' as const,
      location: {
        source: 'city' as const,
        name: 'UTC',
        latitude: 51.5,
        longitude: 0,
        timezone: 'UTC',
        countryCode: 'GB',
        country: 'UTC',
      },
    },
  },
};
const restNight = Date.UTC(2027, 5, 15, 1, 30);
const restDay = Date.UTC(2027, 5, 15, 14, 0);
assert.equal(isRestingChatGate(sleeper, restNight), true, 'a sleeping creature is a closed conversation window');
assert.equal(isRestingChatGate({ ...sleeper, sleepState: 'awake' }, restDay), false, 'an awake day creature can talk');
assert.equal(isRestingChatGate({ ...sleeper, sleepState: 'awake' }, restNight), true, 'an ordinary night is rest, not a chat');
assert.equal(isRestingChatGate({ ...sleeper, sleepState: 'drowsy' }, restDay), false, 'drowsy during their wake is only dozing, not a closed conversation window');
assert.equal(
  isRestingChatGate({ ...sleeper, sleepState: 'drowsy', needs: { ...sleeper.needs, hunger: 4 } }, restNight),
  true,
  'an urgent body need may keep them awake but must not turn rest into a mind call',
);
assert.equal(
  isRestingChatGate({
    ...sleeper,
    sleepState: 'awake',
    lifePath: {
      ...sleeper.lifePath,
      primary: 'party_animal',
      phase: 'committed',
      scores: { ...sleeper.lifePath.scores, party_animal: 52 },
    },
  }, restNight),
  false,
  'a settled night life can talk after dark',
);
assert.ok(
  sendBody.lastIndexOf('isRestingChatGate') > sendBody.indexOf('requestCreatureReply(turn.state)'),
  'a mind reply that arrives after they settle must be discarded, not spoken',
);
const weatherLayer = readFileSync('src/components/WeatherLayer.tsx', 'utf8');
assert.match(weatherLayer, /expanded/);
assert.match(weatherLayer, /!expanded && \(/);
assert.match(weatherLayer, /window-habitat/, 'the sky sits in a framed window, not a floating rectangle');
assert.match(weatherLayer, /window-disc/, 'the window carries a sun or moon');
assert.match(roomSource, /window-spill/);
assert.match(roomSource, /sleep-motes/);
assert.doesNotMatch(roomSource, />z z z</);
assert.match(roomSource, /room-speech-chip/);
assert.match(cssSource, /\.window-frame/);
assert.match(cssSource, /\.sleep-motes/);
const canvasSource = readFileSync('src/components/CreatureCanvas.tsx', 'utf8');
assert.match(canvasSource, /Contact shadow stays on the floor/);
assert.match(canvasSource, /quadraticCurveTo\(-12, -6/);
assert.match(canvasSource, /A sleeping tail does not wag/);
assert.match(canvasSource, /tailWag = isSleeping/, 'the tail must not keep time while they sleep');
assert.match(canvasSource, /drawEye/, 'awake eyes have iris and pupil, not a black disc');
assert.match(canvasSource, /Tiny paws keep them on the floor/);
assert.match(canvasSource, /Chibi: small body, huge head/);
assert.match(canvasSource, /kawaii teardrop/);
assert.match(canvasSource, /Round moe ears/);
assert.match(canvasSource, /Kawaii head: big circle/);
assert.doesNotMatch(canvasSource, /Fur is volume, not hairs/);
assert.doesNotMatch(canvasSource, /for \(let index = 0; index < 9/, 'radiating hair strokes were not fur');
const chatSource = readFileSync('src/components/ChatInterface.tsx', 'utf8');
assert.match(chatSource, /if \(isRestingChatGate\(state\)\) return;/, 'opening chat during rest must not invent a greeting');

console.log('World action and room-first conversation checks passed.');
