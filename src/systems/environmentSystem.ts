import {
  EnvironmentalStimulus,
  GameState,
  Memory,
  Needs,
  WeatherCondition,
  WeatherErrorCode,
  WeatherLocation,
  WeatherPreference,
  WeatherSnapshot,
  WorldEnvironment,
} from '../types';

const WEATHER_CONDITIONS: WeatherCondition[] = [
  'clear',
  'partly_cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'storm',
  'unknown',
];

export const WEATHER_REFRESH_MS = 45 * 60_000;
export const WEATHER_RETRY_MS = 15 * 60_000;
export const WEATHER_STALE_MS = 2 * 60 * 60_000;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function finite(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function emptyPreference(): WeatherPreference {
  return {
    affinity: 0,
    exposures: 0,
    positiveResponses: 0,
    waryResponses: 0,
    lastExperiencedAt: 0,
  };
}

function createWeatherPreferences(): Record<WeatherCondition, WeatherPreference> {
  return Object.fromEntries(WEATHER_CONDITIONS.map(condition => [condition, emptyPreference()])) as Record<WeatherCondition, WeatherPreference>;
}

export const NEUTRAL_ENVIRONMENTAL_STIMULUS: EnvironmentalStimulus = {
  condition: 'unknown',
  thermal: 'mild',
  intensity: 0,
  precipitation: 0,
  cloudiness: 0.25,
  wind: 0,
  temperatureStress: 0,
  cozyPotential: 0,
  novelty: 0,
};

export function createWorldEnvironment(): WorldEnvironment {
  return {
    settings: {
      mode: 'unconfigured',
      onboardingSeen: false,
      permission: 'unknown',
      location: null,
    },
    current: null,
    stimulus: { ...NEUTRAL_ENVIRONMENTAL_STIMULUS },
    preferences: createWeatherPreferences(),
    status: 'idle',
    lastAttemptAt: 0,
    nextRefreshAt: 0,
    lastError: null,
    lastReactionAt: 0,
    recentReactionKeys: [],
    place: 'indoor',
    lastOutdoorAt: 0,
    outdoorUntil: 0,
  };
}

export const OUTDOOR_VISIT_MIN_MS = 32_000;
export const OUTDOOR_VISIT_MAX_MS = 48_000;
export const OUTDOOR_COOLDOWN_MS = 8 * 60_000;
export const WINDOW_PLACE = { x: 50, y: 50 };
export const OUTDOOR_PLACE = { x: 50, y: 40 };
export const INDOOR_RETURN_PLACE = { x: 50, y: 64 };

export function classifyWeatherCode(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly_cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'unknown';
}

export function weatherLocationKey(location: WeatherLocation) {
  return `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
}

export function deriveEnvironmentalStimulus(snapshot: WeatherSnapshot | null): EnvironmentalStimulus {
  if (!snapshot) return { ...NEUTRAL_ENVIRONMENTAL_STIMULUS };

  const apparent = snapshot.apparentTemperatureC;
  const thermal: EnvironmentalStimulus['thermal'] = apparent <= 4
    ? 'cold'
    : apparent <= 11
      ? 'cool'
      : apparent >= 30
        ? 'hot'
        : apparent >= 24
          ? 'warm'
          : 'mild';
  const coldStress = apparent < 10 ? clamp((10 - apparent) / 22) : 0;
  const heatStress = apparent > 24 ? clamp((apparent - 24) / 16) : 0;
  const precipitation = clamp(Math.max(snapshot.precipitationMm / 4, (snapshot.precipitationProbability ?? 0) / 140));
  const cloudiness = clamp(snapshot.cloudCover / 100);
  const wind = clamp((snapshot.windSpeedKph - 10) / 45);
  const conditionIntensity: Record<WeatherCondition, number> = {
    clear: 0.08,
    partly_cloudy: 0.14,
    overcast: 0.25,
    fog: 0.62,
    drizzle: 0.48,
    rain: 0.72,
    snow: 0.82,
    storm: 1,
    unknown: 0.12,
  };
  const novelty: Record<WeatherCondition, number> = {
    clear: 0.05,
    partly_cloudy: 0.08,
    overcast: 0.12,
    fog: 0.6,
    drizzle: 0.25,
    rain: 0.34,
    snow: 1,
    storm: 0.82,
    unknown: 0,
  };

  return {
    condition: snapshot.condition,
    thermal,
    intensity: clamp(Math.max(conditionIntensity[snapshot.condition], precipitation, wind * 0.8, coldStress * 0.45, heatStress * 0.45)),
    precipitation,
    cloudiness,
    wind,
    temperatureStress: heatStress - coldStress,
    cozyPotential: clamp((snapshot.condition === 'rain' || snapshot.condition === 'drizzle' ? 0.58 : 0) + cloudiness * 0.18 - wind * 0.22),
    novelty: novelty[snapshot.condition],
  };
}

function validLocation(value: unknown): WeatherLocation | null {
  const candidate = value as Partial<WeatherLocation> | null;
  if (!candidate || !Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude)) return null;
  const latitude = clamp(Number(candidate.latitude), -90, 90);
  const longitude = clamp(Number(candidate.longitude), -180, 180);
  return {
    source: candidate.source === 'device' ? 'device' : 'city',
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim().slice(0, 100) : 'Selected place',
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    timezone: typeof candidate.timezone === 'string' && candidate.timezone ? candidate.timezone : null,
    countryCode: typeof candidate.countryCode === 'string' ? candidate.countryCode.slice(0, 2).toUpperCase() : null,
    country: typeof candidate.country === 'string' ? candidate.country.slice(0, 80) : null,
  };
}

function validSnapshot(value: unknown): WeatherSnapshot | null {
  const candidate = value as Partial<WeatherSnapshot> | null;
  if (!candidate || typeof candidate.locationKey !== 'string' || !Number.isFinite(candidate.fetchedAt)) return null;
  const code = finite(candidate.weatherCode, -1);
  const condition = WEATHER_CONDITIONS.includes(candidate.condition as WeatherCondition)
    ? candidate.condition as WeatherCondition
    : classifyWeatherCode(code);
  if (typeof candidate.sunrise !== 'string' || typeof candidate.sunset !== 'string') return null;
  return {
    locationKey: candidate.locationKey,
    fetchedAt: finite(candidate.fetchedAt, 0),
    observedAt: finite(candidate.observedAt, finite(candidate.fetchedAt, 0)),
    timezone: typeof candidate.timezone === 'string' && candidate.timezone ? candidate.timezone : 'auto',
    utcOffsetSeconds: finite(candidate.utcOffsetSeconds, 0),
    temperatureC: finite(candidate.temperatureC, 18),
    apparentTemperatureC: finite(candidate.apparentTemperatureC, finite(candidate.temperatureC, 18)),
    precipitationMm: Math.max(0, finite(candidate.precipitationMm, 0)),
    precipitationProbability: Number.isFinite(candidate.precipitationProbability) ? clamp(Number(candidate.precipitationProbability), 0, 100) : null,
    weatherCode: code,
    condition,
    cloudCover: clamp(finite(candidate.cloudCover, 25), 0, 100),
    windSpeedKph: Math.max(0, finite(candidate.windSpeedKph, 0)),
    isDay: Boolean(candidate.isDay),
    sunrise: candidate.sunrise,
    sunset: candidate.sunset,
    dailyDate: typeof candidate.dailyDate === 'string' ? candidate.dailyDate : candidate.sunrise.slice(0, 10),
    dailyMinC: finite(candidate.dailyMinC, finite(candidate.temperatureC, 18)),
    dailyMaxC: finite(candidate.dailyMaxC, finite(candidate.temperatureC, 18)),
  };
}

export function migrateWorldEnvironment(value: unknown): WorldEnvironment {
  const base = createWorldEnvironment();
  const source = value as Partial<WorldEnvironment> | null;
  if (!source) return base;
  const settings = source.settings as Partial<WorldEnvironment['settings']> | undefined;
  const mode = settings?.mode === 'device' || settings?.mode === 'city' || settings?.mode === 'disabled'
    ? settings.mode
    : 'unconfigured';
  const permission = settings?.permission === 'prompt'
    || settings?.permission === 'granted'
    || settings?.permission === 'denied'
    || settings?.permission === 'unavailable'
    ? settings.permission
    : 'unknown';
  const location = validLocation(settings?.location);
  const current = validSnapshot(source.current);
  const preferences = createWeatherPreferences();
  for (const condition of WEATHER_CONDITIONS) {
    const old = source.preferences?.[condition];
    if (!old) continue;
    preferences[condition] = {
      affinity: clamp(finite(old.affinity, 0), -100, 100),
      exposures: Math.max(0, Math.floor(finite(old.exposures, 0))),
      positiveResponses: Math.max(0, Math.floor(finite(old.positiveResponses, 0))),
      waryResponses: Math.max(0, Math.floor(finite(old.waryResponses, 0))),
      lastExperiencedAt: Math.max(0, finite(old.lastExperiencedAt, 0)),
    };
  }
  const enabled = (mode === 'device' || mode === 'city') && location;
  const status = mode === 'disabled'
    ? 'disabled'
    : current
      ? (Date.now() - current.fetchedAt > WEATHER_STALE_MS ? 'stale' : 'ready')
      : enabled
        ? 'idle'
        : 'idle';
  return {
    settings: {
      mode,
      onboardingSeen: Boolean(settings?.onboardingSeen),
      permission,
      location,
    },
    current,
    stimulus: current ? deriveEnvironmentalStimulus(current) : { ...NEUTRAL_ENVIRONMENTAL_STIMULUS },
    preferences,
    status,
    lastAttemptAt: Math.max(0, finite(source.lastAttemptAt, 0)),
    nextRefreshAt: Math.max(0, finite(source.nextRefreshAt, current ? current.fetchedAt + WEATHER_REFRESH_MS : 0)),
    lastError: source.lastError ?? null,
    lastReactionAt: Math.max(0, finite(source.lastReactionAt, 0)),
    recentReactionKeys: Array.isArray(source.recentReactionKeys)
      ? source.recentReactionKeys.filter(key => typeof key === 'string').slice(-8)
      : [],
    place: source.place === 'outdoors' && mode !== 'disabled' ? 'outdoors' : 'indoor',
    lastOutdoorAt: Math.max(0, finite(source.lastOutdoorAt, 0)),
    outdoorUntil: Math.max(0, finite(source.outdoorUntil, 0)),
  };
}

export function setWeatherLocation(
  world: WorldEnvironment,
  location: WeatherLocation,
  permission: WorldEnvironment['settings']['permission'],
): WorldEnvironment {
  const safeLocation = validLocation(location)!;
  const nextKey = weatherLocationKey(safeLocation);
  const keepsSnapshot = world.current?.locationKey === nextKey;
  return {
    ...world,
    settings: {
      mode: safeLocation.source,
      onboardingSeen: true,
      permission,
      location: safeLocation,
    },
    current: keepsSnapshot ? world.current : null,
    stimulus: keepsSnapshot ? world.stimulus : { ...NEUTRAL_ENVIRONMENTAL_STIMULUS },
    status: 'idle',
    nextRefreshAt: 0,
    lastError: null,
  };
}

export function disableWeather(world: WorldEnvironment): WorldEnvironment {
  return {
    ...world,
    settings: { ...world.settings, mode: 'disabled', onboardingSeen: true },
    stimulus: { ...NEUTRAL_ENVIRONMENTAL_STIMULUS },
    status: 'disabled',
    nextRefreshAt: 0,
    lastError: null,
    place: 'indoor',
    outdoorUntil: 0,
  };
}

export function markWeatherPermissionFailure(
  world: WorldEnvironment,
  error: Extract<WeatherErrorCode, 'permission_denied' | 'location_unavailable'>,
): WorldEnvironment {
  return {
    ...world,
    settings: {
      ...world.settings,
      permission: error === 'permission_denied' ? 'denied' : 'unavailable',
    },
    status: world.current ? 'stale' : 'error',
    lastError: error,
  };
}

export function beginWeatherRefresh(world: WorldEnvironment, now = Date.now()): WorldEnvironment {
  return { ...world, status: 'loading', lastAttemptAt: now, lastError: null };
}

export function receiveWeatherSnapshot(world: WorldEnvironment, snapshot: WeatherSnapshot): WorldEnvironment {
  return {
    ...world,
    current: snapshot,
    stimulus: deriveEnvironmentalStimulus(snapshot),
    status: 'ready',
    lastAttemptAt: snapshot.fetchedAt,
    nextRefreshAt: snapshot.fetchedAt + WEATHER_REFRESH_MS,
    lastError: null,
  };
}

export function failWeatherRefresh(
  world: WorldEnvironment,
  error: Extract<WeatherErrorCode, 'offline' | 'weather_unavailable'>,
  now = Date.now(),
): WorldEnvironment {
  return {
    ...world,
    status: world.current ? 'stale' : 'error',
    lastAttemptAt: now,
    nextRefreshAt: now + WEATHER_RETRY_MS,
    lastError: error,
  };
}

export function shouldRefreshWeather(world: WorldEnvironment, now = Date.now(), online = true) {
  if (!online || (world.settings.mode !== 'device' && world.settings.mode !== 'city')) return false;
  if (!world.settings.location || world.status === 'loading') return false;
  if (!world.current) return now >= world.nextRefreshAt;
  if (world.current.locationKey !== weatherLocationKey(world.settings.location)) return true;
  return now >= Math.max(world.nextRefreshAt, world.current.fetchedAt + WEATHER_REFRESH_MS);
}

export function weatherFreshness(world: WorldEnvironment, now = Date.now()) {
  if ((world.settings.mode !== 'device' && world.settings.mode !== 'city') || !world.current) return 0;
  const age = Math.max(0, now - world.current.fetchedAt);
  if (age <= WEATHER_STALE_MS) return 1;
  if (age <= 12 * 60 * 60_000) return 1 - ((age - WEATHER_STALE_MS) / (10 * 60 * 60_000)) * 0.45;
  if (age <= 48 * 60 * 60_000) return 0.55 - ((age - 12 * 60 * 60_000) / (36 * 60 * 60_000)) * 0.35;
  return 0.15;
}

export function getEffectiveStimulus(world: WorldEnvironment, now = Date.now()): EnvironmentalStimulus {
  const freshness = weatherFreshness(world, now);
  if (freshness <= 0) return { ...NEUTRAL_ENVIRONMENTAL_STIMULUS };
  return {
    ...world.stimulus,
    intensity: world.stimulus.intensity * freshness,
    precipitation: world.stimulus.precipitation * freshness,
    cloudiness: world.stimulus.cloudiness * freshness + 0.25 * (1 - freshness),
    wind: world.stimulus.wind * freshness,
    temperatureStress: world.stimulus.temperatureStress * freshness,
    cozyPotential: world.stimulus.cozyPotential * freshness,
    novelty: world.stimulus.novelty * freshness,
  };
}

export function getEnvironmentalNeedMultiplier(
  state: Pick<GameState, 'world' | 'personality'>,
  key: keyof Needs,
  now = Date.now(),
) {
  const stimulus = getEffectiveStimulus(state.world, now);
  let multiplier = 1;
  const heat = Math.max(0, stimulus.temperatureStress);
  const cold = Math.max(0, -stimulus.temperatureStress);

  if (key === 'hydration') multiplier += heat * 0.46;
  if (key === 'energy') multiplier += heat * 0.14 + cold * 0.06;
  if (key === 'comfort') {
    multiplier += cold * (0.16 + state.personality.caution / 360);
    if (stimulus.condition === 'storm') {
      multiplier += stimulus.intensity * clamp((state.personality.caution - state.personality.curiosity + 55) / 260, 0, 0.42);
    }
    if ((stimulus.condition === 'rain' || stimulus.condition === 'drizzle') && state.personality.calmness > 55) {
      multiplier -= stimulus.cozyPotential * 0.16;
    }
  }
  if (key === 'stimulation' && (stimulus.condition === 'snow' || stimulus.condition === 'fog')) {
    multiplier -= stimulus.novelty * state.personality.curiosity / 650;
  }
  return clamp(multiplier, 0.72, 1.5);
}

export interface EnvironmentReaction {
  key: string;
  condition: WeatherCondition;
  icon: string;
  label: string;
  behavior: GameState['creatureBehavior'];
  emotion: string;
  duration: number;
  response: 'positive' | 'wary' | 'neutral';
  preferenceDelta: number;
  needDelta: Partial<Needs>;
  memorable: boolean;
  positionHint: 'window' | 'shelter' | 'warm' | 'cool' | null;
}

function pick<T>(items: T[], seed: number) {
  const index = Math.abs(Math.floor(seed)) % items.length;
  return items[index];
}

export function chooseEnvironmentReaction(
  state: GameState,
  language: 'pl' | 'en',
  now = Date.now(),
): EnvironmentReaction | null {
  const stimulus = getEffectiveStimulus(state.world, now);
  if (!state.world.current || stimulus.intensity < 0.14 || now - state.world.lastReactionAt < 12 * 60_000) return null;

  const preference = state.world.preferences[stimulus.condition] ?? emptyPreference();
  const rememberedWeather = state.memories.filter(memory => memory.tags.includes(`weather:${stimulus.condition}`));
  const rememberedValence = rememberedWeather.length > 0
    ? rememberedWeather.reduce((total, memory) => total + memory.emotionalValence, 0) / rememberedWeather.length
    : 0;
  const curiousScore = state.personality.curiosity
    + state.personality.confidence * 0.2
    - state.personality.caution * 0.34
    + preference.affinity * 0.35
    + Math.max(0, rememberedValence) * 12;
  const cozyScore = state.personality.calmness
    + state.personality.affection * 0.25
    + stimulus.cozyPotential * 35
    + (state.world.current.isDay ? 0 : 18)
    + Math.max(0, rememberedValence) * 10
    - Math.max(0, 55 - state.needs.comfort) * 0.25;
  const waryScore = state.personality.caution
    + (100 - state.personality.confidence) * 0.22
    - preference.affinity * 0.3
    + Math.max(0, -rememberedValence) * 14;
  const variantSeed = state.identity.seed + Math.floor(now / (20 * 60_000)) + preference.exposures * 7;
  const local = (en: string, pl: string) => language === 'pl' ? pl : en;

  if (stimulus.condition === 'storm') {
    if (curiousScore > waryScore + 12) {
      return {
        key: `storm-curious-${preference.exposures}`,
        condition: 'storm', icon: 'ϟ',
        label: pick([
          local('leans toward the window and counts the thunder', 'przysuwa się do okna i liczy grzmoty'),
          local('watches for the next white flash', 'wypatruje następnego białego błysku'),
        ], variantSeed),
        behavior: 'observing', emotion: 'curious', duration: 3600,
        response: 'positive', preferenceDelta: 3, needDelta: { stimulation: 2 }, memorable: preference.exposures === 0,
        positionHint: 'window',
      };
    }
    if (waryScore > 64) {
      return {
        key: `storm-shelter-${preference.exposures}`,
        condition: 'storm', icon: 'ϟ',
        label: local('finds a sheltered corner and listens from there', 'znajduje osłonięty kąt i stamtąd nasłuchuje'),
        behavior: 'reacting', emotion: 'uncertain', duration: 3800,
        response: 'wary', preferenceDelta: -1, needDelta: {}, memorable: preference.exposures === 0,
        positionHint: 'shelter',
      };
    }
    return {
      key: `storm-steady-${preference.exposures}`,
      condition: 'storm', icon: 'ϟ',
      label: local('pauses at each rumble, then carries on', 'przystaje przy każdym grzmocie, po czym wraca do swojego zajęcia'),
      behavior: 'reacting', emotion: 'neutral', duration: 3200,
      response: 'neutral', preferenceDelta: 1, needDelta: {}, memorable: preference.exposures === 0,
      positionHint: null,
    };
  }

  if (stimulus.condition === 'snow') {
    const playful = curiousScore + state.personality.optimism * 0.25 > waryScore;
    return playful ? {
      key: `snow-wonder-${preference.exposures}`,
      condition: 'snow', icon: '✣',
      label: pick([
        local('follows one snowflake all the way down the glass', 'śledzi jeden płatek aż do samego dołu szyby'),
        local('keeps returning to the window as the snow gathers', 'co chwilę wraca do okna, gdy śniegu przybywa'),
      ], variantSeed),
      behavior: 'observing', emotion: 'happy', duration: 3900,
      response: 'positive', preferenceDelta: 4, needDelta: { stimulation: 3 }, memorable: preference.exposures === 0,
      positionHint: 'window',
    } : {
      key: `snow-careful-${preference.exposures}`,
      condition: 'snow', icon: '✣',
      label: local('studies the strange white world from a safe distance', 'ogląda dziwny biały świat z bezpiecznej odległości'),
      behavior: 'observing', emotion: 'curious', duration: 3600,
      response: 'neutral', preferenceDelta: 1, needDelta: { stimulation: 1 }, memorable: preference.exposures === 0,
      positionHint: 'shelter',
    };
  }

  if (stimulus.condition === 'rain' || stimulus.condition === 'drizzle') {
    const cozy = cozyScore >= curiousScore || state.needs.energy < 48;
    return cozy ? {
      key: `rain-cozy-${preference.exposures}`,
      condition: stimulus.condition, icon: '⌇',
      label: pick([
        local('curls up where the rain sounds softest', 'zwija się tam, gdzie deszcz brzmi najciszej'),
        local('settles near the window and listens to the drops', 'układa się przy oknie i słucha kropli'),
      ], variantSeed),
      behavior: 'reacting', emotion: 'neutral', duration: 3500,
      response: 'positive', preferenceDelta: 2, needDelta: { comfort: 2 }, memorable: preference.exposures === 2 && preference.affinity >= 3,
      positionHint: cozyScore > 65 ? 'window' : 'warm',
    } : {
      key: `rain-watch-${preference.exposures}`,
      condition: stimulus.condition, icon: '⌇',
      label: local('watches the rain draw paths down the glass', 'obserwuje ścieżki deszczu spływające po szybie'),
      behavior: 'observing', emotion: 'curious', duration: 3400,
      response: 'positive', preferenceDelta: 2, needDelta: { stimulation: 1 }, memorable: false,
      positionHint: 'window',
    };
  }

  if (stimulus.condition === 'fog') {
    const curious = curiousScore >= waryScore;
    return {
      key: `fog-${curious ? 'curious' : 'careful'}-${preference.exposures}`,
      condition: 'fog', icon: '≋',
      label: curious
        ? local('searches the pale distance for shapes', 'szuka kształtów w bladej oddali')
        : local('checks the faded window, then stays near familiar things', 'sprawdza zamglone okno, po czym zostaje blisko znajomych rzeczy'),
      behavior: 'observing', emotion: curious ? 'curious' : 'uncertain', duration: 3500,
      response: curious ? 'positive' : 'wary', preferenceDelta: curious ? 2 : -1, needDelta: { stimulation: curious ? 1 : 0 }, memorable: preference.exposures === 0,
      positionHint: curious ? 'window' : 'shelter',
    };
  }

  if (stimulus.wind > 0.62) {
    const enjoysWind = state.personality.confidence + state.personality.curiosity * 0.35 > state.personality.caution;
    return {
      key: `wind-${enjoysWind ? 'listen' : 'shelter'}-${preference.exposures}`,
      condition: stimulus.condition, icon: '≈',
      label: enjoysWind
        ? local('turns an ear toward every gust', 'nastawia ucho na każdy podmuch')
        : local('keeps low while the wind worries the window', 'trzyma się nisko, gdy wiatr szarpie oknem'),
      behavior: enjoysWind ? 'observing' : 'reacting', emotion: enjoysWind ? 'curious' : 'uncertain', duration: 3200,
      response: enjoysWind ? 'positive' : 'wary', preferenceDelta: enjoysWind ? 1 : -1, needDelta: {}, memorable: false,
      positionHint: enjoysWind ? 'window' : 'shelter',
    };
  }

  if (stimulus.thermal === 'hot') {
    return {
      key: `heat-${preference.exposures}`,
      condition: stimulus.condition, icon: '◉',
      label: local('finds the coolest patch of floor and slows down', 'znajduje najchłodniejszy fragment podłogi i zwalnia'),
      behavior: 'reacting', emotion: 'neutral', duration: 3300,
      response: 'neutral', preferenceDelta: -1, needDelta: {}, memorable: false,
      positionHint: 'cool',
    };
  }

  if (stimulus.thermal === 'cold') {
    return {
      key: `cold-${preference.exposures}`,
      condition: stimulus.condition, icon: '⌁',
      label: local('tucks in close and looks for the warmest place', 'kuli się i szuka najcieplejszego miejsca'),
      behavior: 'reacting', emotion: 'neutral', duration: 3400,
      response: cozyScore > 58 ? 'positive' : 'neutral', preferenceDelta: 0, needDelta: {}, memorable: false,
      positionHint: 'warm',
    };
  }

  if (stimulus.condition === 'overcast' && cozyScore > 65) {
    return {
      key: `overcast-quiet-${preference.exposures}`,
      condition: 'overcast', icon: '◌',
      label: local('lets the quiet grey light slow the room down', 'pozwala, by ciche szare światło uspokoiło pokój'),
      behavior: 'reacting', emotion: 'neutral', duration: 3000,
      response: 'positive', preferenceDelta: 1, needDelta: { comfort: 1 }, memorable: false,
      positionHint: null,
    };
  }

  return null;
}

function reactionMemory(state: GameState, reaction: EnvironmentReaction, now: number): Memory {
  const content = reaction.condition === 'snow'
    ? `saw snow outside and ${reaction.response === 'positive' ? 'watched it with wonder' : 'studied it carefully'}`
    : reaction.condition === 'storm'
      ? `experienced a storm and responded with ${reaction.response === 'wary' ? 'caution' : reaction.response === 'positive' ? 'curiosity' : 'steady attention'}`
      : `began forming a preference for ${reaction.condition.replace('_', ' ')} weather`;
  return {
    id: `mem-weather-${reaction.condition}-${now}`,
    timestamp: now,
    content,
    importance: reaction.condition === 'snow' || reaction.condition === 'storm' ? 6 : 4,
    emotionalValence: reaction.response === 'positive' ? 0.55 : reaction.response === 'wary' ? -0.15 : 0.1,
    tags: ['weather', `weather:${reaction.condition}`],
    mentioned: false,
    understood: state.development.cognitiveLevel > 18,
    compressed: false,
  };
}

export function recordEnvironmentReaction(state: GameState, reaction: EnvironmentReaction, now = Date.now()): GameState {
  const previous = state.world.preferences[reaction.condition] ?? emptyPreference();
  const preference: WeatherPreference = {
    affinity: clamp(previous.affinity + reaction.preferenceDelta, -100, 100),
    exposures: previous.exposures + 1,
    positiveResponses: previous.positiveResponses + (reaction.response === 'positive' ? 1 : 0),
    waryResponses: previous.waryResponses + (reaction.response === 'wary' ? 1 : 0),
    lastExperiencedAt: now,
  };
  const alreadyRemembered = state.memories.some(memory => memory.tags.includes(`weather:${reaction.condition}`));
  const memories = reaction.memorable && !alreadyRemembered
    ? [...state.memories, reactionMemory(state, reaction, now)].slice(-200)
    : state.memories;
  return {
    ...state,
    memories,
    world: {
      ...state.world,
      preferences: { ...state.world.preferences, [reaction.condition]: preference },
      lastReactionAt: now,
      recentReactionKeys: [...state.world.recentReactionKeys, reaction.key].slice(-8),
    },
  };
}

export function getWeatherConditionLabel(condition: WeatherCondition, language: 'pl' | 'en') {
  const labels: Record<WeatherCondition, [string, string]> = {
    clear: ['clear', 'bezchmurnie'],
    partly_cloudy: ['broken light', 'przejaśnienia'],
    overcast: ['overcast', 'pochmurno'],
    fog: ['fog', 'mgła'],
    drizzle: ['drizzle', 'mżawka'],
    rain: ['rain', 'deszcz'],
    snow: ['snow', 'śnieg'],
    storm: ['storm', 'burza'],
    unknown: ['outside', 'na zewnątrz'],
  };
  return labels[condition][language === 'pl' ? 1 : 0];
}

export function getWeatherIcon(condition: WeatherCondition) {
  const icons: Record<WeatherCondition, string> = {
    clear: '○',
    partly_cloudy: '◔',
    overcast: '●',
    fog: '≋',
    drizzle: '⌇',
    rain: '⌇',
    snow: '✣',
    storm: 'ϟ',
    unknown: '·',
  };
  return icons[condition];
}

/**
 * Their wake, not a weather grind. A solar or last-known sky is enough.
 * Callers pass restPhase from the creature's clock so this file does not
 * import timeSystem (timeSystem already reads weather stimulus).
 */
export function wantsOutdoors(state: GameState, restPhase = false, nightLife = false) {
  if (restPhase || state.sleepState === 'sleeping') return false;
  if (state.world.place === 'outdoors') return false;
  if (state.world.settings.mode === 'disabled') return false;
  if (outdoorVisitBlocked(state)) return false;
  const current = state.world.current;
  if (current?.condition === 'storm' && state.personality.caution > state.personality.curiosity + 12) return false;
  const preference = current ? state.world.preferences[current.condition] : null;
  const likesSky = Boolean(
    current
    && preference
    && preference.exposures >= 2
    && preference.affinity >= 8
    && (
      current.condition === 'clear'
      || current.condition === 'partly_cloudy'
      || current.condition === 'snow'
      || preference.affinity >= 12
    ),
  );
  if (likesSky) return true;
  if (!state.development.hatched) return false;
  if (nightLife) return state.needs.stimulation < 64;
  return state.needs.stimulation < 38;
}

export function outdoorVisitBlocked(state: GameState): 'unavailable' | 'sleeping' | 'need' | 'wary' | null {
  if (state.sleepState === 'sleeping') return 'sleeping';
  if (state.needs.hunger < 24 || state.needs.bladder < 30 || state.needs.bowel < 24 || state.needs.hygiene < 24) return 'need';
  if (state.world.current?.condition === 'storm' && state.personality.caution > state.personality.curiosity + 12) return 'wary';
  return null;
}

export function shouldEndOutdoorVisit(state: GameState, now = Date.now()) {
  if (state.world.place !== 'outdoors') return false;
  if (state.sleepState === 'sleeping') return true;
  if (state.world.settings.mode === 'disabled') return true;
  if (now >= (state.world.outdoorUntil || 0)) return true;
  if (state.needs.hunger < 24 || state.needs.bladder < 30 || state.needs.bowel < 24 || state.needs.hygiene < 24) return true;
  return false;
}

/**
 * Outdoor time stays short enough for Room's existing cadence, but no longer
 * snaps every creature back inside after the same 24 seconds. Weather colours
 * the visit instead of gating it: rain can shorten a wary visit or lengthen a
 * calm one, while only a storm can still be refused before stepping out.
 */
export function getOutdoorVisitDurationMs(state: GameState) {
  const condition = state.world.current?.condition ?? 'unknown';
  const preference = state.world.current ? state.world.preferences[condition] : null;
  let duration = 36_000;

  if (condition === 'rain' || condition === 'drizzle') duration += 2_000;
  if (condition === 'snow') duration += 4_000;
  if (condition === 'storm') duration -= 4_000;

  duration += (state.personality.curiosity - 50) * 80;
  duration += (state.personality.calmness - 50) * 50;
  duration -= (state.personality.caution - 50) * 35;
  duration += clamp(preference?.affinity ?? 0, -20, 40) * 120;

  return Math.round(clamp(duration, OUTDOOR_VISIT_MIN_MS, OUTDOOR_VISIT_MAX_MS) / 1000) * 1000;
}

function outdoorActivity(state: GameState) {
  const language = state.conversation.language === 'pl' ? 'pl' : 'en';
  const condition = state.world.current?.condition ?? 'unknown';
  const label = getWeatherConditionLabel(condition, language);
  return language === 'pl' ? `na dworze (${label})` : `outside (${label})`;
}

export function beginOutdoorVisit(state: GameState, now = Date.now()): GameState {
  if (state.world.place === 'outdoors') return state;
  const condition = state.world.current?.condition ?? 'unknown';
  const alreadyRemembered = state.memories.some(memory => memory.tags.includes('outdoors'));
  const memory: Memory = {
    id: `mem-outdoors-${condition}-${now}`,
    timestamp: now,
    content: `stepped outside into ${condition.replace('_', ' ')}`,
    importance: 5,
    emotionalValence: condition === 'storm' ? -0.1 : 0.35,
    tags: ['weather', `weather:${condition}`, 'outdoors'],
    mentioned: false,
    understood: state.development.cognitiveLevel > 18,
    compressed: false,
  };
  return {
    ...state,
    currentActivity: outdoorActivity(state),
    creatureBehavior: 'observing',
    memories: alreadyRemembered ? state.memories : [...state.memories, memory].slice(-200),
    world: {
      ...state.world,
      place: 'outdoors',
      lastOutdoorAt: now,
      outdoorUntil: now + getOutdoorVisitDurationMs(state),
    },
  };
}

export function endOutdoorVisit(state: GameState, now = Date.now()): GameState {
  if (state.world.place !== 'outdoors') return state;
  return {
    ...state,
    currentActivity: null,
    creatureBehavior: state.sleepState === 'sleeping' ? 'sleeping' : 'idle',
    world: {
      ...state.world,
      place: 'indoor',
      lastOutdoorAt: now,
      outdoorUntil: 0,
    },
  };
}
