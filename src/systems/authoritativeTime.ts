const REAL_MINUTE_MS = 60_000;

// Vite's DEV bit is always false in a production build, including a build
// invoked with --mode simulation. Optional access preserves direct esbuild
// system-check imports, where import.meta.env is absent.
const DEV_SIMULATION_ENABLED = import.meta.env?.DEV === true && import.meta.env?.MODE === 'simulation';
const DEV_TIME_SCALE = DEV_SIMULATION_ENABLED ? 1440 : 1;

export interface AuthoritativeTimeSource {
  now: () => number;
  simulationActive: boolean;
  scale: number;
}

/**
 * A small injectable clock used by deterministic checks as well as the dev
 * harness. Production receives scale=1 at build time and remains Date.now().
 */
export function createAuthoritativeTimeSource(
  realNow: () => number = Date.now,
  simulationActive = false,
  scale = 1,
  epoch?: { real: number; authoritative: number },
): AuthoritativeTimeSource {
  if (!simulationActive || !Number.isFinite(scale) || scale <= 1) {
    return { now: realNow, simulationActive: false, scale: 1 };
  }
  const currentReal = realNow();
  const realEpoch = Number.isFinite(epoch?.real) ? epoch!.real : currentReal;
  const simulatedEpoch = Number.isFinite(epoch?.authoritative) ? epoch!.authoritative : currentReal;
  return {
    now: () => simulatedEpoch + Math.max(0, realNow() - realEpoch) * scale,
    simulationActive: true,
    scale,
  };
}

function devSessionEpoch(): { real: number; authoritative: number } | undefined {
  if (!DEV_SIMULATION_ENABLED || typeof sessionStorage === 'undefined') return undefined;
  const key = 'becoming-dev-time-session-v1';
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { real?: unknown; authoritative?: unknown } | null;
    if (stored && Number.isFinite(stored.real) && Number.isFinite(stored.authoritative)) {
      return { real: Number(stored.real), authoritative: Number(stored.authoritative) };
    }
    const real = Date.now();
    const epoch = { real, authoritative: real };
    sessionStorage.setItem(key, JSON.stringify(epoch));
    return epoch;
  } catch {
    return undefined;
  }
}

const source = createAuthoritativeTimeSource(Date.now, DEV_SIMULATION_ENABLED, DEV_TIME_SCALE, devSessionEpoch());

/** The only gameplay clock. Production is exactly the real wall clock. */
export const authoritativeNow = source.now;

export function isDevTimeSimulationActive() {
  return source.simulationActive;
}

export function authoritativeTimeScale() {
  return source.scale;
}

/** Reuses an existing cadence; simulation mode only shortens its delay. */
export function cadenceDelay(productionDelayMs: number, simulationDelayMs = 1_000) {
  return source.simulationActive ? simulationDelayMs : productionDelayMs;
}

/** Keeps development age advancing at the same rate as the authoritative clock. */
export function developmentMinutesPerCadence(productionDelayMs = 30_000) {
  const realDelay = cadenceDelay(productionDelayMs);
  return realDelay * source.scale / REAL_MINUTE_MS;
}
