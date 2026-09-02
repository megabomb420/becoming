import { authoritativeNow } from './authoritativeTime';
import {
  WeatherDailyForecast,
  WeatherHourlyForecast,
  WeatherLocation,
  WeatherSnapshot,
} from '../types';
import { classifyWeatherCode, weatherLocationKey } from './environmentSystem';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const REQUEST_TIMEOUT_MS = 12_000;

export class WeatherServiceError extends Error {
  constructor(
    public readonly code: 'permission_denied' | 'location_unavailable' | 'weather_unavailable' | 'city_not_found',
    message: string,
  ) {
    super(message);
    this.name = 'WeatherServiceError';
  }
}

export interface CitySearchResult extends WeatherLocation {
  id: number;
  admin1: string | null;
}

export function roundCoordinates(latitude: number, longitude: number) {
  return {
    latitude: Math.round(Math.max(-90, Math.min(90, latitude)) * 100) / 100,
    longitude: Math.round(Math.max(-180, Math.min(180, longitude)) * 100) / 100,
  };
}

export function buildForecastUrl(location: Pick<WeatherLocation, 'latitude' | 'longitude'>) {
  const rounded = roundCoordinates(location.latitude, location.longitude);
  const params = new URLSearchParams({
    latitude: rounded.latitude.toFixed(2),
    longitude: rounded.longitude.toFixed(2),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'is_day',
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'precipitation_probability',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    daily: 'sunrise,sunset,temperature_2m_min,temperature_2m_max,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '2',
  });
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WeatherServiceError('weather_unavailable', 'Invalid weather response.');
  return value as Record<string, unknown>;
}

function requiredNumber(value: unknown, field: string) {
  if (!Number.isFinite(value)) throw new WeatherServiceError('weather_unavailable', `Missing ${field}.`);
  return Number(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value) throw new WeatherServiceError('weather_unavailable', `Missing ${field}.`);
  return value;
}

function arrayValue<T>(value: unknown, index: number, guard: (item: unknown) => item is T, field: string) {
  if (!Array.isArray(value) || !guard(value[index])) throw new WeatherServiceError('weather_unavailable', `Missing ${field}.`);
  return value[index];
}

function localTimestampValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function nearestHourlyProbability(hourly: Record<string, unknown>, currentTime: string): number | null {
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const probabilities = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const target = localTimestampValue(currentTime);
  if (!Number.isFinite(target)) return null;
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < times.length; index += 1) {
    if (typeof times[index] !== 'string' || !Number.isFinite(probabilities[index])) continue;
    const distance = Math.abs(localTimestampValue(times[index]) - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return nearestIndex >= 0 && nearestDistance <= 90 * 60_000 ? Math.max(0, Math.min(100, Number(probabilities[nearestIndex]))) : null;
}

function optionalNumberAt(value: unknown, index: number): number | null {
  return Array.isArray(value) && Number.isFinite(value[index]) ? Number(value[index]) : null;
}

function parseHourlyForecast(hourly: Record<string, unknown>): WeatherHourlyForecast[] {
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  return times.flatMap((time, index) => {
    const temperatureC = optionalNumberAt(hourly.temperature_2m, index);
    const weatherCode = optionalNumberAt(hourly.weather_code, index);
    if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) || temperatureC === null || weatherCode === null) return [];
    const probability = optionalNumberAt(hourly.precipitation_probability, index);
    const windSpeed = optionalNumberAt(hourly.wind_speed_10m, index);
    const windDirection = optionalNumberAt(hourly.wind_direction_10m, index);
    return [{
      localTime: time,
      temperatureC,
      weatherCode,
      condition: classifyWeatherCode(weatherCode),
      precipitationProbability: probability === null ? null : Math.max(0, Math.min(100, probability)),
      windSpeedKph: windSpeed === null ? null : Math.max(0, windSpeed),
      windDirectionDeg: windDirection === null ? null : ((windDirection % 360) + 360) % 360,
    }];
  });
}

function parseDailyForecast(daily: Record<string, unknown>): WeatherDailyForecast[] {
  const dates = Array.isArray(daily.time) ? daily.time : [];
  return dates.flatMap((date, index) => {
    const sunrise = Array.isArray(daily.sunrise) ? daily.sunrise[index] : null;
    const sunset = Array.isArray(daily.sunset) ? daily.sunset[index] : null;
    const minC = optionalNumberAt(daily.temperature_2m_min, index);
    const maxC = optionalNumberAt(daily.temperature_2m_max, index);
    if (typeof date !== 'string' || typeof sunrise !== 'string' || typeof sunset !== 'string' || minC === null || maxC === null) return [];
    return [{ date, sunrise, sunset, minC, maxC }];
  });
}

export function selectWeatherDay(snapshot: WeatherSnapshot, localDateKey: string) {
  const daily = snapshot.dailyForecast?.find(day => day.date === localDateKey)
    ?? (snapshot.dailyDate === localDateKey ? {
      date: snapshot.dailyDate,
      sunrise: snapshot.sunrise,
      sunset: snapshot.sunset,
      minC: snapshot.dailyMinC,
      maxC: snapshot.dailyMaxC,
    } : null);
  if (!daily) return null;
  return {
    ...daily,
    hours: (snapshot.hourlyForecast ?? []).filter(hour => hour.localTime.slice(0, 10) === localDateKey),
  };
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new WeatherServiceError('weather_unavailable', `Weather request failed (${response.status}).`);
    return await response.json();
  } catch (error) {
    if (error instanceof WeatherServiceError) throw error;
    throw new WeatherServiceError('weather_unavailable', error instanceof Error ? error.message : 'Weather request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWeather(
  location: WeatherLocation,
  fetcher: typeof fetch = fetch,
  now = authoritativeNow(),
): Promise<WeatherSnapshot> {
  const payload = asRecord(await fetchJson(buildForecastUrl(location), fetcher));
  const current = asRecord(payload.current);
  const daily = asRecord(payload.daily);
  const hourly = asRecord(payload.hourly);
  const currentTime = requiredString(current.time, 'current.time');
  const currentDate = currentTime.slice(0, 10);
  const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
  const matchingDay = dailyTimes.findIndex(value => value === currentDate);
  const dayIndex = matchingDay >= 0 ? matchingDay : 0;
  const code = requiredNumber(current.weather_code, 'weather_code');
  const hourlyProbability = nearestHourlyProbability(hourly, currentTime);
  const dailyProbability = Array.isArray(daily.precipitation_probability_max) && Number.isFinite(daily.precipitation_probability_max[dayIndex])
    ? Math.max(0, Math.min(100, Number(daily.precipitation_probability_max[dayIndex])))
    : null;

  return {
    locationKey: weatherLocationKey(location),
    fetchedAt: now,
    // Current Open-Meteo conditions describe the latest model interval. The
    // fetch time is retained as an absolute timestamp; current.time remains
    // useful for choosing the corresponding hourly probability.
    observedAt: now,
    timezone: requiredString(payload.timezone, 'timezone'),
    utcOffsetSeconds: requiredNumber(payload.utc_offset_seconds, 'utc_offset_seconds'),
    temperatureC: requiredNumber(current.temperature_2m, 'temperature_2m'),
    apparentTemperatureC: requiredNumber(current.apparent_temperature, 'apparent_temperature'),
    precipitationMm: Math.max(0, requiredNumber(current.precipitation, 'precipitation')),
    precipitationProbability: hourlyProbability ?? dailyProbability,
    weatherCode: code,
    condition: classifyWeatherCode(code),
    cloudCover: Math.max(0, Math.min(100, requiredNumber(current.cloud_cover, 'cloud_cover'))),
    windSpeedKph: Math.max(0, requiredNumber(current.wind_speed_10m, 'wind_speed_10m')),
    windDirectionDeg: Number.isFinite(current.wind_direction_10m)
      ? ((Number(current.wind_direction_10m) % 360) + 360) % 360
      : null,
    isDay: requiredNumber(current.is_day, 'is_day') === 1,
    sunrise: arrayValue(daily.sunrise, dayIndex, (value): value is string => typeof value === 'string', 'sunrise'),
    sunset: arrayValue(daily.sunset, dayIndex, (value): value is string => typeof value === 'string', 'sunset'),
    dailyDate: arrayValue(daily.time, dayIndex, (value): value is string => typeof value === 'string', 'daily.time'),
    dailyMinC: arrayValue(daily.temperature_2m_min, dayIndex, (value): value is number => Number.isFinite(value), 'temperature_2m_min'),
    dailyMaxC: arrayValue(daily.temperature_2m_max, dayIndex, (value): value is number => Number.isFinite(value), 'temperature_2m_max'),
    hourlyForecast: parseHourlyForecast(hourly),
    dailyForecast: parseDailyForecast(daily),
  };
}

export function buildGeocodingUrl(query: string, language: 'pl' | 'en') {
  const params = new URLSearchParams({
    name: query.trim().slice(0, 80),
    count: '6',
    language,
    format: 'json',
  });
  return `${GEOCODING_ENDPOINT}?${params.toString()}`;
}

export async function searchCities(
  query: string,
  language: 'pl' | 'en',
  fetcher: typeof fetch = fetch,
): Promise<CitySearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const payload = asRecord(await fetchJson(buildGeocodingUrl(normalized, language), fetcher));
  if (!Array.isArray(payload.results)) return [];
  return payload.results.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const result = value as Record<string, unknown>;
    if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude) || typeof result.name !== 'string') return [];
    const rounded = roundCoordinates(Number(result.latitude), Number(result.longitude));
    return [{
      id: Number.isFinite(result.id) ? Number(result.id) : Math.round((rounded.latitude + 90) * 100_000 + (rounded.longitude + 180) * 100),
      source: 'city' as const,
      name: result.name.slice(0, 100),
      ...rounded,
      timezone: typeof result.timezone === 'string' ? result.timezone : null,
      countryCode: typeof result.country_code === 'string' ? result.country_code.slice(0, 2).toUpperCase() : null,
      country: typeof result.country === 'string' ? result.country.slice(0, 80) : null,
      admin1: typeof result.admin1 === 'string' && result.admin1 ? result.admin1.slice(0, 80) : null,
    }];
  });
}

export async function requestCurrentWeatherLocation(
  geolocation: Geolocation | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
  timezone = typeof Intl === 'undefined' ? null : Intl.DateTimeFormat().resolvedOptions().timeZone || null,
): Promise<WeatherLocation> {
  if (!geolocation) throw new WeatherServiceError('location_unavailable', 'Geolocation is unavailable.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30 * 60_000,
    });
  }).catch((error: GeolocationPositionError) => {
    if (error?.code === 1) throw new WeatherServiceError('permission_denied', 'Location permission was denied.');
    throw new WeatherServiceError('location_unavailable', error?.message || 'Location is unavailable.');
  });
  const rounded = roundCoordinates(position.coords.latitude, position.coords.longitude);
  return {
    source: 'device',
    name: 'Current area',
    ...rounded,
    timezone,
    countryCode: null,
    country: null,
  };
}
