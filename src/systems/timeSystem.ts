import { WorldEnvironment } from '../types';
import { getEffectiveStimulus, weatherFreshness } from './environmentSystem';

export type DayPhase = 'night' | 'dawn' | 'day' | 'golden_hour' | 'dusk';

export interface TimeOfDay {
  phase: DayPhase;
  phaseProgress: number;
  minuteOfDay: number;
  localDateKey: string;
  timezoneOffsetMinutes: number;
  timezone: string | null;
  sunriseMinute: number;
  sunsetMinute: number;
  solarFactor: number;
  twilightWarmth: number;
}

export interface RoomLighting {
  wallTop: string;
  wallBottom: string;
  floorTop: string;
  floorBottom: string;
  skyTop: string;
  skyBottom: string;
  ambientGlow: string;
  veil: string;
  starOpacity: number;
  brightness: number;
  cloudOpacity: number;
  fogOpacity: number;
}

type Palette = Omit<RoomLighting, 'ambientGlow' | 'veil' | 'cloudOpacity' | 'fogOpacity'> & {
  ambient: [number, number, number, number];
  veilColor: [number, number, number, number];
};

const MINUTE = 60_000;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / Math.max(0.001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function defaultTimezoneOffset(timestamp: number) {
  return new Date(timestamp).getTimezoneOffset();
}

function localDateFromOffset(timestamp: number, timezoneOffsetMinutes: number) {
  return new Date(timestamp - timezoneOffsetMinutes * MINUTE);
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezoneOffsetMinutes: number;
}

function partsFromZone(timestamp: number, timezone: string): LocalParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    });
    const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    const hour = Number(values.hour);
    const minute = Number(values.minute);
    const second = Number(values.second);
    if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const offsetFromUtc = Math.round((localAsUtc - timestamp) / MINUTE);
    return { year, month, day, hour, minute, second, timezoneOffsetMinutes: -offsetFromUtc };
  } catch {
    return null;
  }
}

function partsFromOffset(timestamp: number, timezoneOffsetMinutes: number): LocalParts {
  const date = localDateFromOffset(timestamp, timezoneOffsetMinutes);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    timezoneOffsetMinutes,
  };
}

function worldTimezone(world: WorldEnvironment | null | undefined) {
  if (world?.settings.mode !== 'device' && world?.settings.mode !== 'city') return null;
  const value = world?.current?.timezone ?? world?.settings.location?.timezone;
  return value && value !== 'auto' ? value : null;
}

function localParts(
  timestamp: number,
  worldOrOffset?: WorldEnvironment | number | null,
  fallbackOffset = defaultTimezoneOffset(timestamp),
): { parts: LocalParts; timezone: string | null } {
  if (typeof worldOrOffset === 'number') return { parts: partsFromOffset(timestamp, worldOrOffset), timezone: null };
  const timezone = worldTimezone(worldOrOffset);
  const zoned = timezone ? partsFromZone(timestamp, timezone) : null;
  return { parts: zoned ?? partsFromOffset(timestamp, fallbackOffset), timezone: zoned ? timezone : null };
}

export function getLocalDateKey(
  timestamp: number,
  worldOrOffset: WorldEnvironment | number | null = defaultTimezoneOffset(timestamp),
) {
  const { parts } = localParts(timestamp, worldOrOffset);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function dayOfYear(parts: LocalParts) {
  const current = Date.UTC(parts.year, parts.month - 1, parts.day);
  const first = Date.UTC(parts.year, 0, 1);
  return Math.floor((current - first) / 86_400_000) + 1;
}

function parseLocalMinute(value: string) {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

// NOAA-style solar approximation used only when today's Open-Meteo sunrise
// and sunset are unavailable. It responds to date, latitude, longitude and
// timezone, so the fallback is never another fixed 08:00/20:00 switch.
export function estimateSolarTimes(
  timestamp: number,
  latitude: number | null,
  longitude: number | null,
  timezoneOffsetMinutes = defaultTimezoneOffset(timestamp),
) {
  const parts = partsFromOffset(timestamp, timezoneOffsetMinutes);
  const ordinal = dayOfYear(parts);
  const localUtcOffset = -timezoneOffsetMinutes;
  const safeLatitude = clamp(latitude ?? 45, -66, 66);
  const safeLongitude = longitude ?? localUtcOffset / 4;
  const latitudeRadians = safeLatitude * Math.PI / 180;
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (ordinal + 10)) * Math.PI / 180;
  const cosineHourAngle = clamp(-Math.tan(latitudeRadians) * Math.tan(declination), -1, 1);
  const daylightMinutes = 24 * 60 * Math.acos(cosineHourAngle) / Math.PI;
  const equationOfTime = 9.87 * Math.sin(2 * (2 * Math.PI * (ordinal - 81) / 364))
    - 7.53 * Math.cos(2 * Math.PI * (ordinal - 81) / 364)
    - 1.5 * Math.sin(2 * Math.PI * (ordinal - 81) / 364);
  const solarNoon = 720 - 4 * safeLongitude - equationOfTime + localUtcOffset;
  return {
    sunriseMinute: clamp(solarNoon - daylightMinutes / 2, 1, 1438),
    sunsetMinute: clamp(solarNoon + daylightMinutes / 2, 2, 1439),
  };
}

function solarSchedule(timestamp: number, world: WorldEnvironment | null | undefined, parts: LocalParts) {
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const snapshot = world?.current;
  const weatherEnabled = world?.settings.mode === 'device' || world?.settings.mode === 'city';
  if (weatherEnabled && snapshot && snapshot.dailyDate === dateKey) {
    const sunriseMinute = parseLocalMinute(snapshot.sunrise);
    const sunsetMinute = parseLocalMinute(snapshot.sunset);
    if (Number.isFinite(sunriseMinute) && Number.isFinite(sunsetMinute) && sunsetMinute > sunriseMinute) {
      return { sunriseMinute, sunsetMinute };
    }
  }
  return estimateSolarTimes(
    timestamp,
    weatherEnabled ? world?.settings.location?.latitude ?? null : null,
    weatherEnabled ? world?.settings.location?.longitude ?? null : null,
    parts.timezoneOffsetMinutes,
  );
}

export function getTimeOfDay(
  timestamp = Date.now(),
  worldOrOffset: WorldEnvironment | number | null = null,
  fallbackOffset = defaultTimezoneOffset(timestamp),
): TimeOfDay {
  const world = typeof worldOrOffset === 'object' ? worldOrOffset : null;
  const { parts, timezone } = localParts(timestamp, worldOrOffset, fallbackOffset);
  const minuteOfDay = parts.hour * 60 + parts.minute + parts.second / 60;
  const { sunriseMinute, sunsetMinute } = solarSchedule(timestamp, world, parts);
  const daylightMinutes = Math.max(180, sunsetMinute - sunriseMinute);
  const dawnLead = clamp(daylightMinutes * 0.075, 45, 75);
  const dawnTail = clamp(daylightMinutes * 0.035, 22, 38);
  const goldenLead = clamp(daylightMinutes * 0.075, 45, 80);
  const duskTail = clamp(daylightMinutes * 0.065, 42, 75);
  const dawnStart = sunriseMinute - dawnLead;
  const dawnEnd = sunriseMinute + dawnTail;
  const goldenStart = sunsetMinute - goldenLead;
  const goldenEnd = sunsetMinute + 12;
  const duskEnd = sunsetMinute + duskTail;

  let phase: DayPhase;
  let phaseProgress: number;
  if (minuteOfDay < dawnStart || minuteOfDay >= duskEnd) {
    phase = 'night';
    const nightStart = duskEnd;
    const minutesSinceNight = minuteOfDay >= nightStart ? minuteOfDay - nightStart : minuteOfDay + 1440 - nightStart;
    phaseProgress = clamp(minutesSinceNight / Math.max(1, dawnStart + 1440 - nightStart));
  } else if (minuteOfDay < dawnEnd) {
    phase = 'dawn';
    phaseProgress = clamp((minuteOfDay - dawnStart) / Math.max(1, dawnEnd - dawnStart));
  } else if (minuteOfDay < goldenStart) {
    phase = 'day';
    phaseProgress = clamp((minuteOfDay - dawnEnd) / Math.max(1, goldenStart - dawnEnd));
  } else if (minuteOfDay < goldenEnd) {
    phase = 'golden_hour';
    phaseProgress = clamp((minuteOfDay - goldenStart) / Math.max(1, goldenEnd - goldenStart));
  } else {
    phase = 'dusk';
    phaseProgress = clamp((minuteOfDay - goldenEnd) / Math.max(1, duskEnd - goldenEnd));
  }

  const morningLight = smoothstep(dawnStart, dawnEnd, minuteOfDay);
  const eveningDark = smoothstep(goldenEnd, duskEnd, minuteOfDay);
  let solarFactor = clamp(morningLight * (1 - eveningDark));
  // is_day is retained as a low-weight sanity signal while the observation is
  // fresh. Sunrise/sunset and the continuously advancing local clock remain
  // authoritative, avoiding a hard change when a cached flag flips.
  if (world?.current && Math.abs(timestamp - world.current.observedAt) < 90 * 60_000 && weatherFreshness(world, timestamp) > 0.8) {
    solarFactor = world.current.isDay ? Math.max(solarFactor, 0.12) : Math.min(solarFactor, 0.88);
  }
  const dawnWarmth = clamp(1 - Math.abs(minuteOfDay - (sunriseMinute + 5)) / 95);
  const sunsetWarmth = clamp(1 - Math.abs(minuteOfDay - (sunsetMinute - 8)) / 105);

  return {
    phase,
    phaseProgress,
    minuteOfDay,
    localDateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    timezoneOffsetMinutes: parts.timezoneOffsetMinutes,
    timezone,
    sunriseMinute,
    sunsetMinute,
    solarFactor,
    twilightWarmth: Math.max(dawnWarmth, sunsetWarmth),
  };
}

export function formatLocalClock(time: TimeOfDay) {
  const hours = Math.floor(time.minuteOfDay / 60) % 24;
  const minutes = Math.floor(time.minuteOfDay % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getPhaseLabel(phase: DayPhase, language: 'pl' | 'en') {
  const labels: Record<'pl' | 'en', Record<DayPhase, string>> = {
    en: { night: 'Night', dawn: 'Dawn', day: 'Day', golden_hour: 'Sunset', dusk: 'Dusk' },
    pl: { night: 'Noc', dawn: 'Świt', day: 'Dzień', golden_hour: 'Zachód', dusk: 'Zmierzch' },
  };
  return labels[language][phase];
}

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number];
}

function mixHex(from: string, to: string, amount: number) {
  const a = parseHex(from);
  const b = parseHex(to);
  const mixed = a.map((value, index) => Math.round(value + (b[index] - value) * clamp(amount)));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function mixTuple(from: [number, number, number, number], to: [number, number, number, number], amount: number) {
  return from.map((value, index) => value + (to[index] - value) * clamp(amount)) as [number, number, number, number];
}

function rgba([r, g, b, a]: [number, number, number, number]) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
}

const NIGHT: Palette = {
  wallTop: '#10131b', wallBottom: '#171821', floorTop: '#202027', floorBottom: '#17171d',
  skyTop: '#101a30', skyBottom: '#252944',
  ambient: [112, 142, 190, 0.12], veilColor: [18, 28, 56, 0.26], starOpacity: 0.38, brightness: 0.72,
};
const DAY: Palette = {
  wallTop: '#3a3429', wallBottom: '#29251f', floorTop: '#3b3128', floorBottom: '#2b261f',
  skyTop: '#8399a6', skyBottom: '#c6b995',
  ambient: [236, 199, 142, 0.30], veilColor: [224, 194, 142, 0.03], starOpacity: 0, brightness: 1,
};
const DAWN: Palette = {
  wallTop: '#302b2b', wallBottom: '#28231f', floorTop: '#322a24', floorBottom: '#26211e',
  skyTop: '#6e7187', skyBottom: '#d79b78',
  ambient: [226, 160, 126, 0.25], veilColor: [170, 105, 92, 0.08], starOpacity: 0.07, brightness: 0.91,
};
const GOLDEN: Palette = {
  wallTop: '#352c27', wallBottom: '#29221f', floorTop: '#3b2e25', floorBottom: '#29221f',
  skyTop: '#716e82', skyBottom: '#d48d62',
  ambient: [238, 151, 96, 0.29], veilColor: [142, 76, 82, 0.09], starOpacity: 0.03, brightness: 0.92,
};

export function getRoomLighting(time: TimeOfDay, world: WorldEnvironment | null = null, now = Date.now()): RoomLighting {
  const baseAmount = time.solarFactor;
  const warmPalette = time.minuteOfDay < (time.sunriseMinute + time.sunsetMinute) / 2 ? DAWN : GOLDEN;
  const warmth = time.twilightWarmth * (0.36 + 0.38 * (1 - Math.abs(0.5 - baseAmount) * 2));
  const stimulus = world ? getEffectiveStimulus(world, now) : null;
  const clouds = stimulus?.cloudiness ?? 0;
  const rain = stimulus?.precipitation ?? 0;
  const fog = stimulus?.condition === 'fog' ? stimulus.intensity : 0;
  const storm = stimulus?.condition === 'storm' ? stimulus.intensity : 0;
  const snow = stimulus?.condition === 'snow' ? stimulus.intensity : 0;

  const base = {
    wallTop: mixHex(NIGHT.wallTop, DAY.wallTop, baseAmount),
    wallBottom: mixHex(NIGHT.wallBottom, DAY.wallBottom, baseAmount),
    floorTop: mixHex(NIGHT.floorTop, DAY.floorTop, baseAmount),
    floorBottom: mixHex(NIGHT.floorBottom, DAY.floorBottom, baseAmount),
    skyTop: mixHex(NIGHT.skyTop, DAY.skyTop, baseAmount),
    skyBottom: mixHex(NIGHT.skyBottom, DAY.skyBottom, baseAmount),
    ambient: mixTuple(NIGHT.ambient, DAY.ambient, baseAmount),
    veilColor: mixTuple(NIGHT.veilColor, DAY.veilColor, baseAmount),
    starOpacity: NIGHT.starOpacity + (DAY.starOpacity - NIGHT.starOpacity) * baseAmount,
    brightness: NIGHT.brightness + (DAY.brightness - NIGHT.brightness) * baseAmount,
  };

  const cloudDim = clouds * (0.11 + baseAmount * 0.08) + storm * 0.14;
  const coolWeather = clamp(rain * 0.38 + storm * 0.5 + fog * 0.2);
  let wallTop = mixHex(base.wallTop, warmPalette.wallTop, warmth);
  let wallBottom = mixHex(base.wallBottom, warmPalette.wallBottom, warmth);
  let floorTop = mixHex(base.floorTop, warmPalette.floorTop, warmth);
  let floorBottom = mixHex(base.floorBottom, warmPalette.floorBottom, warmth);
  let skyTop = mixHex(base.skyTop, warmPalette.skyTop, warmth);
  let skyBottom = mixHex(base.skyBottom, warmPalette.skyBottom, warmth);
  if (coolWeather > 0) {
    wallTop = mixHex(wallTop, '#232a31', coolWeather * 0.48);
    wallBottom = mixHex(wallBottom, '#22272b', coolWeather * 0.44);
    floorTop = mixHex(floorTop, '#292c2e', coolWeather * 0.36);
    skyTop = mixHex(skyTop, '#485869', coolWeather * 0.62);
    skyBottom = mixHex(skyBottom, '#727a80', coolWeather * 0.42);
  }
  if (snow > 0) {
    skyBottom = mixHex(skyBottom, '#c4c8c6', snow * 0.45);
    wallTop = mixHex(wallTop, '#444340', snow * 0.12);
  }
  const ambient = mixTuple(base.ambient, warmPalette.ambient, warmth);
  const veil = mixTuple(base.veilColor, warmPalette.veilColor, warmth);
  const reportedNightDim = world?.current && !world.current.isDay && Math.abs(now - world.current.observedAt) < 90 * 60_000 ? 0.025 : 0;

  return {
    wallTop,
    wallBottom,
    floorTop,
    floorBottom,
    skyTop,
    skyBottom,
    ambientGlow: rgba(ambient),
    veil: rgba([
      veil[0] * (1 - coolWeather) + 45 * coolWeather,
      veil[1] * (1 - coolWeather) + 57 * coolWeather,
      veil[2] * (1 - coolWeather) + 72 * coolWeather,
      clamp(veil[3] + cloudDim * 0.22 + fog * 0.08, 0, 0.42),
    ]),
    starOpacity: clamp(base.starOpacity * (1 - clouds * 0.86)),
    brightness: clamp(base.brightness - cloudDim - reportedNightDim + snow * 0.025, 0.58, 1.02),
    cloudOpacity: clamp(clouds * 0.62 + storm * 0.18),
    fogOpacity: clamp(fog * 0.48),
  };
}

export type CircadianDisposition = 'waking' | 'active' | 'quiet' | 'winding_down' | 'ready_to_sleep' | 'sleeping';
export type RestSchedule = 'diurnal' | 'nocturnal';

export function isCreatureRestPhase(time: TimeOfDay, schedule: RestSchedule = 'diurnal'): boolean {
  if (schedule === 'nocturnal') return time.phase === 'day' || time.phase === 'dawn';
  return time.phase === 'night' || time.phase === 'dusk';
}

export function isCreatureWakePhase(time: TimeOfDay, schedule: RestSchedule = 'diurnal'): boolean {
  return !isCreatureRestPhase(time, schedule);
}

export function getCircadianDisposition(
  time: TimeOfDay,
  energy: number,
  sleeping: boolean,
  schedule: RestSchedule = 'diurnal',
): CircadianDisposition {
  if (sleeping) return 'sleeping';
  if (isCreatureRestPhase(time, schedule) || energy < 20) return 'ready_to_sleep';
  if (schedule === 'nocturnal') {
    if (time.phase === 'dusk') return 'waking';
    if (time.phase === 'golden_hour') return energy < 50 ? 'winding_down' : 'quiet';
    return 'active';
  }
  if (time.phase === 'dawn') return energy < 55 ? 'waking' : 'quiet';
  if (time.phase === 'golden_hour') return energy < 55 ? 'winding_down' : 'quiet';
  return 'active';
}

export function shouldBeDrowsy(time: TimeOfDay, energy: number, schedule: RestSchedule = 'diurnal') {
  return energy < 20 || isCreatureRestPhase(time, schedule);
}

/** Their night, not the player's. Exhaustion can still drop them in the day. */
export function creatureMaySleep(time: TimeOfDay, energy: number, schedule: RestSchedule = 'diurnal') {
  return isCreatureRestPhase(time, schedule) || energy < 20;
}

function circularMinuteDistance(a: number, b: number) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1440 - direct);
}

// Offline rest follows solar midnight and remains capped to a nine-hour
// nightly window. Fifteen-minute sampling preserves date and DST changes.
export function estimateNightRestMs(
  start: number,
  end: number,
  offsetAt: (timestamp: number) => number = defaultTimezoneOffset,
  world: WorldEnvironment | null = null,
  schedule: RestSchedule = 'diurnal',
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const step = 15 * MINUTE;
  let cursor = start;
  let overlap = 0;
  while (cursor < end) {
    const next = Math.min(end, cursor + step);
    const midpoint = cursor + (next - cursor) / 2;
    const time = getTimeOfDay(midpoint, world ?? offsetAt(midpoint), offsetAt(midpoint));
    const sunriseAfterSunset = time.sunriseMinute + 1440;
    const solarMidnight = (time.sunsetMinute + (sunriseAfterSunset - time.sunsetMinute) / 2) % 1440;
    const solarNoon = (time.sunriseMinute + time.sunsetMinute) / 2;
    const inCore = schedule === 'nocturnal'
      ? (time.phase === 'day' || time.phase === 'dawn') && circularMinuteDistance(time.minuteOfDay, solarNoon) <= 4.5 * 60
      : time.phase === 'night' && circularMinuteDistance(time.minuteOfDay, solarMidnight) <= 4.5 * 60;
    if (inCore) overlap += next - cursor;
    cursor = next;
  }
  return overlap;
}

/** Wake hours on their clock while the user was away. Complements night rest. */
export function estimateWakeMs(
  start: number,
  end: number,
  offsetAt: (timestamp: number) => number = defaultTimezoneOffset,
  world: WorldEnvironment | null = null,
  schedule: RestSchedule = 'diurnal',
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const elapsed = end - start;
  return Math.max(0, elapsed - estimateNightRestMs(start, end, offsetAt, world, schedule));
}
