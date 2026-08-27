import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { beginConversationTurn } from '../src/systems/conversationSystem';
import { beginOutdoorVisit } from '../src/systems/environmentSystem';
import { receiveWeatherSnapshot, setWeatherLocation, createWorldEnvironment } from '../src/systems/environmentSystem';
import { evolveLifePathFromCreatureStatement, getLifePathTitle } from '../src/systems/lifePathSystem';
import { buildCreatureMindRequest } from '../src/systems/llmConversation';

const NOW = 1_825_200_000_000;

function hatched(name: string, seed: number) {
  const creature = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...creature,
    conversation: { ...creature.conversation, language: 'en' as const },
    development: { ...creature.development, cognitiveLevel: 58, languageLevel: 50, stage: 'sentences' as const },
  };
}

function talk(state: ReturnType<typeof hatched>, lines: string[], start: number) {
  let next = state;
  lines.forEach((line, index) => {
    next = beginConversationTurn(next, line, start + index * 1_000).state;
  });
  return next;
}

const filler = [
  'The morning was slow.',
  'I made tea again.',
  'The room felt ordinary.',
  'Nothing dramatic happened.',
  'I sat with it for a while.',
  'That was enough for today.',
];

const unwritten = talk(hatched('Chapters', 808), [
  'I want to finish the book.',
  'I really like games.',
  ...filler,
], NOW);
assert.equal(unwritten.continuity.chapters.length, 1);
assert.ok(unwritten.continuity.chapters[0].summary.length > 20);
assert.doesNotMatch(unwritten.continuity.chapters[0].summary, /Unwritten|Nieukształtowany/);
assert.doesNotMatch(unwritten.continuity.chapters[0].title, /Unwritten|Nieukształtowany/);
assert.match(unwritten.continuity.chapters[0].summary, /book|games/i);
assert.doesNotMatch(unwritten.continuity.chapters[0].summary, /I am a gamer|Gracz|Jaracz/i, 'user likes are not the creature\'s identity');

const weatherLocation = {
  source: 'city' as const,
  name: 'Dublin',
  latitude: 53.35,
  longitude: -6.26,
  timezone: 'UTC',
  countryCode: 'IE',
  country: 'Ireland',
};
let outdoor = hatched('Outside chapter', 909);
outdoor = {
  ...outdoor,
  world: receiveWeatherSnapshot(setWeatherLocation(createWorldEnvironment(), weatherLocation, 'unknown'), {
    locationKey: '53.35,-6.26',
    fetchedAt: NOW,
    observedAt: NOW,
    timezone: 'UTC',
    utcOffsetSeconds: 0,
    temperatureC: 12,
    apparentTemperatureC: 11,
    precipitationMm: 1.4,
    precipitationProbability: 70,
    weatherCode: 63,
    condition: 'rain',
    cloudCover: 88,
    windSpeedKph: 16,
    isDay: true,
    sunrise: '2026-08-27T06:20',
    sunset: '2026-08-27T20:10',
    dailyDate: '2026-08-27',
    dailyMinC: 8,
    dailyMaxC: 14,
  }),
};
outdoor = beginOutdoorVisit(outdoor, NOW + 500);
outdoor = talk(outdoor, ['The kettle clicked.', ...filler, 'I am home again.'], NOW + 2_000);
assert.equal(outdoor.continuity.chapters.length, 1);
assert.match(outdoor.continuity.chapters[0].summary, /outside|rain/i);
assert.doesNotMatch(outdoor.continuity.chapters[0].summary, /wet grass|smell|walked through/i);
assert.match(outdoor.continuity.chapters[0].title, /outside/i);

let jaracz = hatched('Path chapter', 1010);
jaracz = { ...jaracz, conversation: { ...jaracz.conversation, language: 'pl' } };
for (let index = 0; index < 7; index += 1) {
  jaracz = evolveLifePathFromCreatureStatement(jaracz, 'Wybieram palić zioło. To moja decyzja.', NOW + index * 2 * 60 * 60_000);
}
assert.equal(getLifePathTitle(jaracz, 'pl'), 'Jaracz');
jaracz = talk(jaracz, [
  'Cześć, jak tam.',
  'Opowiem ci o dniu.',
  'To była zwykła rozmowa.',
  'Nic pilnego.',
  'Wróciłem później.',
  'Herbata ostygła.',
  'Siedzieliśmy chwilę.',
  'To tyle na dziś.',
], NOW + 20 * 60 * 60_000);
assert.equal(jaracz.continuity.chapters.length, 1);
assert.match(jaracz.continuity.chapters[0].summary, /Jaracz/);
assert.doesNotMatch(jaracz.continuity.chapters[0].summary, /Unwritten|Nieukształtowany/);

const overlay = buildCreatureMindRequest(unwritten);
assert.ok(overlay.continuity);
assert.ok((overlay.continuity as { chapters: Array<{ summary: string }> }).chapters[0].summary.length <= 320);

const continuitySource = readFileSync('src/systems/continuitySystem.ts', 'utf8');
assert.doesNotMatch(continuitySource, /requestCreatureReply|buildCreatureMindRequest/, 'chapters stay local and must not add a model call');

console.log('Chapter quality checks passed.');
