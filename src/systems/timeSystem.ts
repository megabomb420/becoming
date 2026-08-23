export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface TimeOfDay {
  phase: DayPhase;
  phaseProgress: number;
  minuteOfDay: number;
  localDateKey: string;
  timezoneOffsetMinutes: number;
}

export interface RoomLighting {
  wallTop: string;
  wallBottom: string;
  floorTop: string;
  floorBottom: string;
  ambientGlow: string;
  veil: string;
  starOpacity: number;
  brightness: number;
}

type Palette = Omit<RoomLighting, 'ambientGlow' | 'veil'> & {
  ambient: [number, number, number, number];
  veilColor: [number, number, number, number];
};

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

function defaultTimezoneOffset(timestamp: number) {
  return new Date(timestamp).getTimezoneOffset();
}

function localDate(timestamp: number, timezoneOffsetMinutes: number) {
  return new Date(timestamp - timezoneOffsetMinutes * MINUTE);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getLocalDateKey(timestamp: number, timezoneOffsetMinutes = defaultTimezoneOffset(timestamp)) {
  const date = localDate(timestamp, timezoneOffsetMinutes);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getTimeOfDay(timestamp = Date.now(), timezoneOffsetMinutes = defaultTimezoneOffset(timestamp)): TimeOfDay {
  const date = localDate(timestamp, timezoneOffsetMinutes);
  const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;

  if (minuteOfDay >= 5 * 60 && minuteOfDay < 8 * 60) {
    return {
      phase: 'dawn',
      phaseProgress: (minuteOfDay - 5 * 60) / (3 * 60),
      minuteOfDay,
      localDateKey: getLocalDateKey(timestamp, timezoneOffsetMinutes),
      timezoneOffsetMinutes,
    };
  }
  if (minuteOfDay >= 8 * 60 && minuteOfDay < 18 * 60) {
    return {
      phase: 'day',
      phaseProgress: (minuteOfDay - 8 * 60) / (10 * 60),
      minuteOfDay,
      localDateKey: getLocalDateKey(timestamp, timezoneOffsetMinutes),
      timezoneOffsetMinutes,
    };
  }
  if (minuteOfDay >= 18 * 60 && minuteOfDay < 21 * 60) {
    return {
      phase: 'dusk',
      phaseProgress: (minuteOfDay - 18 * 60) / (3 * 60),
      minuteOfDay,
      localDateKey: getLocalDateKey(timestamp, timezoneOffsetMinutes),
      timezoneOffsetMinutes,
    };
  }

  const minutesSinceNight = minuteOfDay >= 21 * 60
    ? minuteOfDay - 21 * 60
    : minuteOfDay + 3 * 60;
  return {
    phase: 'night',
    phaseProgress: minutesSinceNight / (8 * 60),
    minuteOfDay,
    localDateKey: getLocalDateKey(timestamp, timezoneOffsetMinutes),
    timezoneOffsetMinutes,
  };
}

export function formatLocalClock(time: TimeOfDay) {
  const hours = Math.floor(time.minuteOfDay / 60) % 24;
  const minutes = Math.floor(time.minuteOfDay % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getPhaseLabel(phase: DayPhase, language: 'pl' | 'en') {
  const labels: Record<'pl' | 'en', Record<DayPhase, string>> = {
    en: { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' },
    pl: { dawn: 'Świt', day: 'Dzień', dusk: 'Zmierzch', night: 'Noc' },
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
  const mixed = a.map((value, index) => Math.round(value + (b[index] - value) * clamp01(amount)));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function mixTuple(from: [number, number, number, number], to: [number, number, number, number], amount: number) {
  return from.map((value, index) => value + (to[index] - value) * clamp01(amount)) as [number, number, number, number];
}

function rgba([r, g, b, a]: [number, number, number, number]) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
}

const NIGHT: Palette = {
  wallTop: '#10131b', wallBottom: '#171821', floorTop: '#202027', floorBottom: '#17171d',
  ambient: [112, 142, 190, 0.12], veilColor: [18, 28, 56, 0.26], starOpacity: 0.34, brightness: 0.72,
};
const DAWN: Palette = {
  wallTop: '#302b2b', wallBottom: '#28231f', floorTop: '#322a24', floorBottom: '#26211e',
  ambient: [226, 160, 126, 0.25], veilColor: [170, 105, 92, 0.08], starOpacity: 0.08, brightness: 0.91,
};
const DAY: Palette = {
  wallTop: '#3a3429', wallBottom: '#29251f', floorTop: '#3b3128', floorBottom: '#2b261f',
  ambient: [236, 199, 142, 0.30], veilColor: [224, 194, 142, 0.03], starOpacity: 0, brightness: 1,
};
const DUSK: Palette = {
  wallTop: '#30272a', wallBottom: '#241f21', floorTop: '#332924', floorBottom: '#251f20',
  ambient: [226, 132, 103, 0.24], veilColor: [112, 64, 98, 0.12], starOpacity: 0.08, brightness: 0.88,
};

const LIGHTING_ANCHORS: Array<{ minute: number; palette: Palette }> = [
  { minute: 0, palette: NIGHT },
  { minute: 5 * 60, palette: NIGHT },
  { minute: 6.5 * 60, palette: DAWN },
  { minute: 8 * 60, palette: DAY },
  { minute: 18 * 60, palette: DAY },
  { minute: 19.5 * 60, palette: DUSK },
  { minute: 21 * 60, palette: NIGHT },
  { minute: DAY_MINUTES, palette: NIGHT },
];

export function getRoomLighting(time: TimeOfDay): RoomLighting {
  const upperIndex = LIGHTING_ANCHORS.findIndex(anchor => anchor.minute >= time.minuteOfDay);
  const upper = LIGHTING_ANCHORS[Math.max(1, upperIndex)];
  const lower = LIGHTING_ANCHORS[Math.max(0, upperIndex - 1)];
  const amount = clamp01((time.minuteOfDay - lower.minute) / Math.max(1, upper.minute - lower.minute));
  const ambient = mixTuple(lower.palette.ambient, upper.palette.ambient, amount);
  const veilColor = mixTuple(lower.palette.veilColor, upper.palette.veilColor, amount);

  return {
    wallTop: mixHex(lower.palette.wallTop, upper.palette.wallTop, amount),
    wallBottom: mixHex(lower.palette.wallBottom, upper.palette.wallBottom, amount),
    floorTop: mixHex(lower.palette.floorTop, upper.palette.floorTop, amount),
    floorBottom: mixHex(lower.palette.floorBottom, upper.palette.floorBottom, amount),
    ambientGlow: rgba(ambient),
    veil: rgba(veilColor),
    starOpacity: lower.palette.starOpacity + (upper.palette.starOpacity - lower.palette.starOpacity) * amount,
    brightness: lower.palette.brightness + (upper.palette.brightness - lower.palette.brightness) * amount,
  };
}

export type CircadianDisposition = 'waking' | 'active' | 'quiet' | 'winding_down' | 'ready_to_sleep' | 'sleeping';

export function getCircadianDisposition(time: TimeOfDay, energy: number, sleeping: boolean): CircadianDisposition {
  if (sleeping) return 'sleeping';
  if (time.phase === 'dawn') return energy < 55 ? 'waking' : 'quiet';
  if (time.phase === 'day') return energy < 24 ? 'ready_to_sleep' : 'active';
  if (time.phase === 'dusk') return energy < 68 ? 'winding_down' : 'quiet';
  return energy < 78 ? 'ready_to_sleep' : 'quiet';
}

export function shouldBeDrowsy(time: TimeOfDay, energy: number) {
  return (time.phase === 'night' && energy < 78)
    || (time.phase === 'dusk' && time.phaseProgress > 0.45 && energy < 58)
    || energy < 20;
}

// Deterministic night overlap for offline simulation. Sampling in 15-minute
// slices lets a caller supply a changing offset (DST or travel) without
// pretending one fixed local clock covered the whole absence.
export function estimateNightRestMs(
  start: number,
  end: number,
  offsetAt: (timestamp: number) => number = defaultTimezoneOffset,
) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const step = 15 * MINUTE;
  let cursor = start;
  let overlap = 0;
  while (cursor < end) {
    const next = Math.min(end, cursor + step);
    const midpoint = cursor + (next - cursor) / 2;
    const local = getTimeOfDay(midpoint, offsetAt(midpoint));
    // The creature naturally rests during the quietest part of night. This is
    // deliberately narrower than the visual night phase.
    if (local.minuteOfDay >= 22 * 60 || local.minuteOfDay < 7 * 60) overlap += next - cursor;
    cursor = next;
  }
  return overlap;
}
