import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  beginOutdoorVisit,
  beginWeatherRefresh,
  chooseEnvironmentReaction,
  classifyWeatherCode,
  createWorldEnvironment,
  deriveEnvironmentalStimulus,
  disableWeather,
  endOutdoorVisit,
  failWeatherRefresh,
  getEffectiveStimulus,
  markWeatherPermissionFailure,
  outdoorVisitBlocked,
  receiveWeatherSnapshot,
  recordEnvironmentReaction,
  setWeatherLocation,
  shouldEndOutdoorVisit,
  shouldRefreshWeather,
  wantsOutdoors,
  WEATHER_REFRESH_MS,
} from '../src/systems/environmentSystem';
import {
  buildForecastUrl,
  fetchWeather,
  requestCurrentWeatherLocation,
  roundCoordinates,
  searchCities,
  WeatherServiceError,
} from '../src/systems/weatherService';
import { advanceNeeds } from '../src/systems/needsSystem';
import { getRoomLighting, getTimeOfDay } from '../src/systems/timeSystem';
import { migrateGameState } from '../src/systems/persistence';
import { GameState, WeatherLocation, WeatherSnapshot } from '../src/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const now = Date.UTC(2026, 7, 23, 12, 15);
const location: WeatherLocation = {
  source: 'city',
  name: 'Dublin',
  latitude: 53.35,
  longitude: -6.26,
  timezone: 'UTC',
  countryCode: 'IE',
  country: 'Ireland',
};

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  const code = overrides.weatherCode ?? 0;
  return {
    locationKey: '53.35,-6.26',
    fetchedAt: now,
    observedAt: now,
    timezone: 'UTC',
    utcOffsetSeconds: 0,
    temperatureC: 18,
    apparentTemperatureC: 18,
    precipitationMm: 0,
    precipitationProbability: 10,
    weatherCode: code,
    condition: classifyWeatherCode(code),
    cloudCover: 10,
    windSpeedKph: 8,
    isDay: true,
    sunrise: '2026-08-23T06:20',
    sunset: '2026-08-23T20:10',
    dailyDate: '2026-08-23',
    dailyMinC: 11,
    dailyMaxC: 21,
    ...overrides,
  };
}

function worldWith(weather: WeatherSnapshot) {
  return receiveWeatherSnapshot(setWeatherLocation(createWorldEnvironment(), location, 'unknown'), weather);
}

assert.equal(classifyWeatherCode(0), 'clear');
assert.equal(classifyWeatherCode(45), 'fog');
assert.equal(classifyWeatherCode(63), 'rain');
assert.equal(classifyWeatherCode(75), 'snow');
assert.equal(classifyWeatherCode(95), 'storm');

assert.deepEqual(roundCoordinates(53.349805, -6.26031), { latitude: 53.35, longitude: -6.26 });
const forecastUrl = buildForecastUrl({ latitude: 53.349805, longitude: -6.26031 });
assert.ok(forecastUrl.includes('latitude=53.35'));
assert.ok(forecastUrl.includes('longitude=-6.26'));
assert.ok(!forecastUrl.includes('53.349805'), 'precise device coordinates must never enter the API URL');
assert.ok(forecastUrl.includes('current=temperature_2m'));
assert.ok(forecastUrl.includes('hourly=precipitation_probability'));
assert.ok(forecastUrl.includes('daily=sunrise'));

const forecastPayload = {
  timezone: 'Europe/Dublin',
  utc_offset_seconds: 3600,
  current: {
    time: '2026-08-23T12:15',
    temperature_2m: 17.4,
    apparent_temperature: 15.9,
    precipitation: 0.4,
    weather_code: 61,
    cloud_cover: 84,
    wind_speed_10m: 26,
    is_day: 1,
  },
  hourly: {
    time: ['2026-08-23T12:00', '2026-08-23T13:00'],
    precipitation_probability: [38, 62],
  },
  daily: {
    time: ['2026-08-23', '2026-08-24'],
    sunrise: ['2026-08-23T06:17', '2026-08-24T06:19'],
    sunset: ['2026-08-23T20:36', '2026-08-24T20:34'],
    temperature_2m_min: [11.2, 12.1],
    temperature_2m_max: [19.6, 20.1],
    precipitation_probability_max: [74, 48],
  },
};
const forecastFetcher = (async () => new Response(JSON.stringify(forecastPayload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})) as typeof fetch;
const fetched = await fetchWeather(location, forecastFetcher, now);
assert.equal(fetched.temperatureC, 17.4);
assert.equal(fetched.apparentTemperatureC, 15.9);
assert.equal(fetched.precipitationMm, 0.4);
assert.equal(fetched.precipitationProbability, 38);
assert.equal(fetched.condition, 'rain');
assert.equal(fetched.cloudCover, 84);
assert.equal(fetched.windSpeedKph, 26);
assert.equal(fetched.isDay, true);
assert.equal(fetched.sunrise, '2026-08-23T06:17');
assert.equal(fetched.sunset, '2026-08-23T20:36');
assert.equal(fetched.dailyMinC, 11.2);
assert.equal(fetched.dailyMaxC, 19.6);

const geocodePayload = {
  results: [{
    id: 2964574,
    name: 'Dublin',
    latitude: 53.33306,
    longitude: -6.24889,
    timezone: 'Europe/Dublin',
    country_code: 'IE',
    country: 'Ireland',
    admin1: 'Leinster',
  }],
};
const geocodeFetcher = (async () => new Response(JSON.stringify(geocodePayload), { status: 200 })) as typeof fetch;
const cities = await searchCities('Dublin', 'en', geocodeFetcher);
assert.equal(cities.length, 1);
assert.equal(cities[0].latitude, 53.33);
assert.equal(cities[0].longitude, -6.25);
assert.equal(cities[0].timezone, 'Europe/Dublin');

let geolocationOptions: PositionOptions | undefined;
const geolocation = {
  getCurrentPosition(success: PositionCallback, _failure?: PositionErrorCallback | null, options?: PositionOptions) {
    geolocationOptions = options;
    success({ coords: { latitude: 51.507351, longitude: -0.127758 } } as GeolocationPosition);
  },
} as Geolocation;
const currentArea = await requestCurrentWeatherLocation(geolocation, 'Europe/London');
assert.equal(currentArea.latitude, 51.51);
assert.equal(currentArea.longitude, -0.13);
assert.equal(currentArea.timezone, 'Europe/London');
assert.equal(geolocationOptions?.enableHighAccuracy, false);

const deniedGeolocation = {
  getCurrentPosition(_success: PositionCallback, failure?: PositionErrorCallback | null) {
    failure?.({ code: 1, message: 'denied' } as GeolocationPositionError);
  },
} as Geolocation;
await assert.rejects(
  requestCurrentWeatherLocation(deniedGeolocation),
  (error: unknown) => error instanceof WeatherServiceError && error.code === 'permission_denied',
);
const permissionFallback = markWeatherPermissionFailure(createWorldEnvironment(), 'permission_denied');
assert.equal(permissionFallback.settings.onboardingSeen, false, 'a denied location prompt must keep the manual-city fallback visible');
assert.equal(permissionFallback.settings.permission, 'denied');

let cached = setWeatherLocation(createWorldEnvironment(), location, 'unknown');
assert.equal(shouldRefreshWeather(cached, now, true), true);
cached = receiveWeatherSnapshot(beginWeatherRefresh(cached, now), snapshot());
assert.equal(shouldRefreshWeather(cached, now + WEATHER_REFRESH_MS - MINUTE, true), false);
assert.equal(shouldRefreshWeather(cached, now + WEATHER_REFRESH_MS, true), true);
assert.equal(shouldRefreshWeather(cached, now + 4 * HOUR, false), false);
const failed = failWeatherRefresh(cached, 'offline', now + WEATHER_REFRESH_MS);
assert.equal(failed.current, cached.current, 'network failure must retain the last known weather snapshot');
assert.equal(failed.status, 'stale');
assert.ok(getEffectiveStimulus(failed, now + 24 * HOUR).intensity > 0, 'offline mode should retain a softened last-known environment');
assert.equal(getEffectiveStimulus(disableWeather(cached), now).intensity, 0);

const rainStimulus = deriveEnvironmentalStimulus(snapshot({ weatherCode: 63, condition: 'rain', precipitationMm: 2.5, cloudCover: 92 }));
assert.ok(rainStimulus.precipitation > 0.6);
const hotStimulus = deriveEnvironmentalStimulus(snapshot({ apparentTemperatureC: 35, temperatureC: 33 }));
assert.equal(hotStimulus.thermal, 'hot');
const coldStimulus = deriveEnvironmentalStimulus(snapshot({ apparentTemperatureC: -3, temperatureC: 0 }));
assert.equal(coldStimulus.thermal, 'cold');

const solarWorld = worldWith(snapshot());
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 5, 0), solarWorld).phase, 'night');
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 6, 0), solarWorld).phase, 'dawn');
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 12, 0), solarWorld).phase, 'day');
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 19, 30), solarWorld).phase, 'golden_hour');
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 20, 40), solarWorld).phase, 'dusk');
assert.equal(getTimeOfDay(Date.UTC(2026, 7, 23, 22, 0), solarWorld).phase, 'night');

const tokyoLocation: WeatherLocation = { ...location, name: 'Tokyo', latitude: 35.68, longitude: 139.69, timezone: 'Asia/Tokyo', countryCode: 'JP', country: 'Japan' };
const tokyoSnapshot = snapshot({
  locationKey: '35.68,139.69', timezone: 'Asia/Tokyo', utcOffsetSeconds: 9 * 3600,
  sunrise: '2026-08-23T05:05', sunset: '2026-08-23T18:20', dailyDate: '2026-08-23',
});
const tokyoWorld = receiveWeatherSnapshot(setWeatherLocation(createWorldEnvironment(), tokyoLocation, 'unknown'), tokyoSnapshot);
assert.equal(Math.floor(getTimeOfDay(Date.UTC(2026, 7, 23, 12, 0), tokyoWorld).minuteOfDay / 60), 21);
assert.equal(Math.floor(getTimeOfDay(Date.UTC(2026, 7, 23, 12, 0), disableWeather(tokyoWorld), 0).minuteOfDay / 60), 12, 'turning weather off must return to the device-local clock');

const summerWorld = worldWith(snapshot({
  fetchedAt: Date.UTC(2026, 5, 21, 12), observedAt: Date.UTC(2026, 5, 21, 12),
  dailyDate: '2026-06-21', sunrise: '2026-06-21T04:45', sunset: '2026-06-21T21:55',
}));
const winterWorld = worldWith(snapshot({
  fetchedAt: Date.UTC(2026, 11, 21, 12), observedAt: Date.UTC(2026, 11, 21, 12),
  dailyDate: '2026-12-21', sunrise: '2026-12-21T08:35', sunset: '2026-12-21T16:08',
}));
assert.equal(getTimeOfDay(Date.UTC(2026, 5, 21, 17, 0), summerWorld).phase, 'day');
assert.equal(getTimeOfDay(Date.UTC(2026, 11, 21, 17, 0), winterWorld).phase, 'night');

const beforeDusk = getRoomLighting(getTimeOfDay(Date.UTC(2026, 7, 23, 20, 21), solarWorld), solarWorld, Date.UTC(2026, 7, 23, 20, 21));
const afterDusk = getRoomLighting(getTimeOfDay(Date.UTC(2026, 7, 23, 20, 22), solarWorld), solarWorld, Date.UTC(2026, 7, 23, 20, 22));
assert.ok(Math.abs(beforeDusk.brightness - afterDusk.brightness) < 0.02, 'sunset phase labels must not cause a lighting jump');
const clearLight = getRoomLighting(getTimeOfDay(now, solarWorld), solarWorld, now);
const overcastWorld = worldWith(snapshot({ weatherCode: 3, condition: 'overcast', cloudCover: 100 }));
const overcastLight = getRoomLighting(getTimeOfDay(now, overcastWorld), overcastWorld, now);
assert.ok(overcastLight.brightness < clearLight.brightness);
assert.ok(overcastLight.cloudOpacity > clearLight.cloudOpacity);

const baseState = createHatchedCreature(createNewCreature('Weather', 404));
const needsStart: GameState = {
  ...baseState,
  needsUpdatedAt: now,
  lastSaved: now,
  needs: { hunger: 90, hydration: 90, energy: 90, bladder: 90, bowel: 90, hygiene: 90, comfort: 90, stimulation: 90, social: 90 },
};
const mildState = { ...needsStart, world: worldWith(snapshot()) };
const hotState = { ...needsStart, world: worldWith(snapshot({ temperatureC: 34, apparentTemperatureC: 36 })) };
const mildHour = advanceNeeds(mildState, now + HOUR);
const hotHour = advanceNeeds(hotState, now + HOUR);
assert.ok(hotHour.needs.hydration < mildHour.needs.hydration, 'heat must raise thirst pressure through the needs interpreter');
assert.equal(hotState.needs.hydration, mildState.needs.hydration, 'receiving weather must never directly mutate a need');

const stormWorld = worldWith(snapshot({
  weatherCode: 95, condition: 'storm', cloudCover: 100, precipitationMm: 5, windSpeedKph: 52,
}));
const curiousState: GameState = {
  ...needsStart,
  world: stormWorld,
  personality: { ...needsStart.personality, curiosity: 100, caution: 0, confidence: 90 },
};
const cautiousState: GameState = {
  ...needsStart,
  world: stormWorld,
  personality: { ...needsStart.personality, curiosity: 0, caution: 100, confidence: 10 },
};
const curiousStorm = chooseEnvironmentReaction(curiousState, 'en', now + MINUTE);
const cautiousStorm = chooseEnvironmentReaction(cautiousState, 'en', now + MINUTE);
assert.equal(curiousStorm?.response, 'positive');
assert.equal(cautiousStorm?.response, 'wary');
assert.notEqual(curiousStorm?.label, cautiousStorm?.label, 'personality must produce visibly different storm reactions');
const rememberedBase: GameState = {
  ...needsStart,
  world: stormWorld,
  personality: { ...needsStart.personality, curiosity: 50, caution: 50, confidence: 50 },
};
const memoryShape = {
  id: 'weather-memory', timestamp: now - HOUR, content: 'remembered storm', importance: 6,
  tags: ['weather', 'weather:storm'], mentioned: false, understood: true, compressed: false,
};
const positiveMemoryReaction = chooseEnvironmentReaction({ ...rememberedBase, memories: [{ ...memoryShape, emotionalValence: 1 }] }, 'en', now + MINUTE);
const negativeMemoryReaction = chooseEnvironmentReaction({ ...rememberedBase, memories: [{ ...memoryShape, emotionalValence: -1 }] }, 'en', now + MINUTE);
assert.notEqual(positiveMemoryReaction?.response, negativeMemoryReaction?.response, 'remembered emotional context must modulate a later reaction');
const rememberedStorm = recordEnvironmentReaction(curiousState, curiousStorm!, now + MINUTE);
assert.equal(rememberedStorm.world.preferences.storm.exposures, 1);
assert.ok(rememberedStorm.world.preferences.storm.affinity > 0);
assert.equal(rememberedStorm.memories.filter(memory => memory.tags.includes('weather:storm')).length, 1);
const rememberedAgain = recordEnvironmentReaction(rememberedStorm, curiousStorm!, now + 2 * MINUTE);
assert.equal(rememberedAgain.memories.filter(memory => memory.tags.includes('weather:storm')).length, 1, 'weather memories must not spam duplicates');

const rainyNight = {
  ...needsStart,
  world: worldWith(snapshot({ weatherCode: 63, condition: 'rain', cloudCover: 90, precipitationMm: 2, isDay: false })),
  personality: { ...needsStart.personality, calmness: 90, affection: 80, curiosity: 25, caution: 30 },
};
assert.ok(chooseEnvironmentReaction(rainyNight, 'en', now + MINUTE)?.key.startsWith('rain-cozy'));

const legacy = createHatchedCreature(createNewCreature('Old world', 505));
delete (legacy as Partial<GameState>).world;
const migrated = migrateGameState(legacy);
assert.equal(migrated.world.settings.mode, 'unconfigured');
assert.equal(migrated.world.settings.onboardingSeen, false);
assert.equal(migrated.world.place, 'indoor');

const indoorBase: GameState = {
  ...needsStart,
  world: {
    ...worldWith(snapshot({ weatherCode: 0, condition: 'clear' })),
    preferences: {
      ...createWorldEnvironment().preferences,
      clear: { affinity: 12, exposures: 3, positiveResponses: 3, waryResponses: 0, lastExperiencedAt: now },
    },
  },
};
assert.equal(indoorBase.world.place ?? 'indoor', 'indoor');
assert.equal(wantsOutdoors(indoorBase), true);
assert.equal(outdoorVisitBlocked(indoorBase), null);

const noWeather = outdoorVisitBlocked(needsStart);
assert.equal(noWeather, 'unavailable');

const waryStormOut: GameState = {
  ...needsStart,
  world: worldWith(snapshot({ weatherCode: 95, condition: 'storm', cloudCover: 100, precipitationMm: 5, windSpeedKph: 52 })),
  personality: { ...needsStart.personality, curiosity: 0, caution: 100, confidence: 10 },
};
assert.equal(outdoorVisitBlocked(waryStormOut), 'wary');

const hungryOut: GameState = {
  ...indoorBase,
  needs: { ...indoorBase.needs, hunger: 8 },
};
assert.equal(outdoorVisitBlocked(hungryOut), 'need');

const steppedOut = beginOutdoorVisit(indoorBase, now + MINUTE);
assert.equal(steppedOut.world.place, 'outdoors');
assert.equal(steppedOut.lifePath.primary, indoorBase.lifePath.primary, 'going outside must not assign a life path');
assert.deepEqual(steppedOut.personality, indoorBase.personality);
assert.ok(steppedOut.memories.some(memory => memory.tags.includes('outdoors')));
assert.equal(shouldEndOutdoorVisit(steppedOut, now + MINUTE + 5_000), false);
assert.equal(shouldEndOutdoorVisit(steppedOut, now + MINUTE + 30_000), true);
const cameIn = endOutdoorVisit(steppedOut, now + MINUTE + 30_000);
assert.equal(cameIn.world.place, 'indoor');
assert.equal(wantsOutdoors({
  ...indoorBase,
  world: { ...indoorBase.world, preferences: createWorldEnvironment().preferences },
}), false, 'unearned weather affinity must not want out');

const disabledWhileOut = disableWeather(steppedOut.world);
assert.equal(disabledWhileOut.place, 'indoor');

console.log('Weather privacy, Open-Meteo parsing, cache/offline, solar phases, lighting, needs, personality, memory, and migration checks passed.');
