import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuthoritativeTimeSource } from '../src/systems/authoritativeTime';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { advanceNeeds, applyCircadianSleep, drinkCreature, feedCreature, useToilet, washCreature } from '../src/systems/needsSystem';
import { advanceHealth, isDead } from '../src/systems/healthSystem';
import { ensureDailyMoment, resolveDailyMoment } from '../src/systems/lifePathSystem';
import { recordAutonomousMoment, updateDevelopment } from '../src/systems/developmentSystem';
import { chooseAutonomousMoment } from '../src/systems/relationshipSystem';
import { getTimeOfDay } from '../src/systems/timeSystem';
import { buildCreatureMindRequest } from '../src/systems/llmConversation';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Production is a transparent wall-clock adapter even if a caller supplies an
// acceleration scale. Only the explicit dev-enabled constructor may scale.
let wallNow = 10_000;
const productionClock = createAuthoritativeTimeSource(() => wallNow, false, 1440);
assert.equal(productionClock.simulationActive, false);
assert.equal(productionClock.scale, 1);
assert.equal(productionClock.now(), wallNow);
wallNow += 1234;
assert.equal(productionClock.now(), wallNow, 'normal production time remains exactly wall time');

const simulatedClock = createAuthoritativeTimeSource(() => wallNow, true, 1440);
const simulatedStart = simulatedClock.now();
wallNow += MINUTE;
assert.equal(simulatedClock.now() - simulatedStart, DAY, 'one real minute advances one creature day');
const reloadedClock = createAuthoritativeTimeSource(() => wallNow, true, 1440, {
  real: wallNow - MINUTE,
  authoritative: simulatedStart,
});
assert.equal(reloadedClock.now(), simulatedStart + DAY, 'a dev-tab reload can retain the same simulated epoch');

// The production boundary is deliberately expressed in build configuration,
// not a browser flag or query parameter. A production build in any mode is
// forced to false and the normal dev command remains real-clock.
const clockSource = readFileSync('src/systems/authoritativeTime.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
assert.match(clockSource, /import\.meta\.env\?\.DEV === true && import\.meta\.env\?\.MODE === 'simulation'/);
assert.match(clockSource, /DEV_SIMULATION_ENABLED \? 1440 : 1/);
assert.match(packageSource, /"dev:simulation": "vite --mode simulation --host --port 7101 --strictPort"/);
assert.match(appSource, /isDevTimeSimulationActive\(\)/, 'simulation activation is visibly labelled in App');
assert.match(appSource, /import\.meta\.env\.DEV && import\.meta\.env\.MODE === 'simulation'/);
assert.doesNotMatch(appSource + roomSource, /Date\.now\(\)/, 'authoritative runtime paths do not bypass the controlled clock');
assert.equal((appSource.match(/setInterval\(/g) ?? []).length, 2, 'simulation adds no App interval');
assert.equal((roomSource.match(/setInterval\(/g) ?? []).length, 4, 'simulation adds no Room interval');

// Fast, deterministic 30-day active-life pass. It composes the same needs,
// health, circadian, development, daily-moment and autonomy transitions used
// by App/Room; the policy only supplies ordinary care through existing actions.
const start = Date.UTC(2026, 0, 1, 12, 0);
let state = createHatchedCreature(createNewCreature('Thirty', 424_242, start));
const resolvedMomentIds = new Set<string>();
const phases = new Set<string>();
let sleepTransitions = 0;
let wakeTransitions = 0;
let autonomousMoments = 0;

for (let step = 1; step <= 30 * 24 * 4; step += 1) {
  const now = start + step * 15 * MINUTE;
  const previousSleep = state.sleepState;
  state = advanceNeeds(state, now);
  state = advanceHealth(state, now);
  state = applyCircadianSleep(state, now);
  state = updateDevelopment(state, 15, now);
  state = ensureDailyMoment(state, now);
  phases.add(getTimeOfDay(now, state.world).phase);

  if (previousSleep !== 'sleeping' && state.sleepState === 'sleeping') sleepTransitions += 1;
  if (previousSleep === 'sleeping' && state.sleepState !== 'sleeping') wakeTransitions += 1;

  if (state.sleepState !== 'sleeping') {
    if (state.needs.hydration < 58) state = drinkCreature(state, now);
    if (state.needs.hunger < 58) state = feedCreature(state, 'apple', now);
    if (state.needs.bladder < 55 || state.needs.bowel < 55) state = useToilet(state, now).state;
    if (state.needs.hygiene < 58) state = washCreature(state, now).state;

    if (step % 4 === 0) {
      const choice = chooseAutonomousMoment(state, now);
      if (choice) {
        state = recordAutonomousMoment(state, choice.id, now, choice.objectType);
        autonomousMoments += 1;
      }
    }
  }

  const dailyMoment = state.lifePath.pendingMoment;
  if (dailyMoment) {
    resolvedMomentIds.add(dailyMoment.id);
    state = resolveDailyMoment(state, dailyMoment.choices[0].id, now);
  }
  assert.equal(isDead(state), false, `supported deterministic care should keep the creature alive through step ${step}`);
}

assert.ok(state.development.chronologicalAge >= 30 * DAY, 'the active system pass reaches thirty creature days');
assert.ok(resolvedMomentIds.size >= 25, 'daily moments recur across the long horizon');
assert.ok(phases.has('day') && phases.has('night') && phases.has('dawn') && phases.has('dusk'), 'solar transitions remain observable');
assert.ok(sleepTransitions >= 25 && wakeTransitions >= 25, 'circadian sleep and wake repeat across the month');
assert.ok(autonomousMoments > 100, 'the existing deterministic autonomy selector remains active');
assert.ok(Object.values(state.needs).every(Number.isFinite), 'needs stay finite');

const sixHoursLater = start + 6 * 60 * MINUTE;
const mind = buildCreatureMindRequest(state, { now: sixHoursLater, kind: 'self' });
const expectedClock = getTimeOfDay(sixHoursLater, state.world);
assert.equal(mind.creature.clock?.phase, expectedClock.phase, 'DeepSeek receives the simulated authoritative solar phase');
assert.equal(mind.situation.place, state.world.place, 'DeepSeek receives the same authoritative situation');

console.log(`Accelerated time checks passed: ${resolvedMomentIds.size} daily moments, ${sleepTransitions}/${wakeTransitions} sleep/wake transitions, ${autonomousMoments} autonomous moments across 30 days.`);
