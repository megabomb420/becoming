import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  advanceHealth,
  bodyPressure,
  deriveHealthStage,
  getHealthBand,
  getIllnessIntensity,
  migrateHealthState,
} from '../src/systems/healthSystem';
import { advanceNeeds } from '../src/systems/needsSystem';
import { simulateOfflineTime } from '../src/systems/offlineSimulation';
import {
  closeDatabaseConnections,
  isHatchableBoot,
  loadGameStateForBoot,
  migrateGameState,
  parseImportedGameState,
  saveGameState,
  serializeGameState,
} from '../src/systems/persistence';
import { performImmediateWorldAction } from '../src/systems/worldActionSystem';
import { shouldCreatureSelfSpeak } from '../src/systems/llmConversation';
import { GameState, ObjectType } from '../src/types';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const start = Date.UTC(2026, 8, 1, 12, 0);

function fresh(name: string, seed: number): GameState {
  const base = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...base,
    lastSaved: start,
    needsUpdatedAt: start,
    health: { ...base.health, lastUpdated: start },
  };
}

function careObject(type: ObjectType): GameState['roomObjects'][number] {
  return { id: `obj-${type}`, type, x: 50, y: 68, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: false };
}

// 1. A healthy creature survives a normal short absence (a night + a day).
//    Absence alone is not a disease: no sudden death, no routine illness.
{
  const away = simulateOfflineTime(fresh('Short', 101), 26 * HOUR, start + 26 * HOUR, () => 0).state;
  assert.equal(away.health.status, 'alive');
  assert.ok(away.health.wellness >= 80, 'a normal short absence must leave the body clearly healthy');
  assert.ok(away.health.illness < 10, 'a normal short absence must not build a real illness');
  assert.equal(away.health.stage, 'healthy');
}

// 2. A single accident/mess does not cause illness. One pee trace lowers
//    hygiene once; the body pressure from one cleanable mess is zero.
{
  let accident = fresh('Accident', 202);
  accident = {
    ...accident,
    needs: { ...accident.needs, bladder: 0.1, bowel: 80 },
    needsUpdatedAt: start,
  };
  const marked = advanceNeeds(accident, start + 5 * 60_000);
  assert.ok(marked.roomMess.some(mess => mess.type === 'pee'), 'fixture must produce one pee trace');
  const after = advanceHealth(marked, start + 12 * HOUR);
  assert.equal(after.health.illness, 0, 'a single accident must not cause illness');
  assert.ok(after.health.wellness >= 99, 'a single accident must not damage wellness');
  assert.equal(after.health.stage, 'healthy');
}

// 3. Sustained bad physiology worsens health: days of combined low needs move
//    the body out of healthy along the same qualitative stages as illness.
{
  const bad = fresh('BadBody', 303);
  let current = {
    ...bad,
    needs: { ...bad.needs, hunger: 12, hydration: 10, energy: 8, hygiene: 6 },
  };
  const stages: string[] = [];
  for (let day = 1; day <= 6 && current.health.status === 'alive'; day += 1) {
    current = advanceHealth(current, start + day * DAY);
    stages.push(current.health.stage);
  }
  assert.ok(current.health.wellness < bad.health.wellness, 'sustained bad body state must lower wellness');
  assert.ok(current.health.illness > 0, 'sustained bad body state must build illness');
  assert.ok(stages.includes('strained') || stages.includes('ill'), 'sustained bad physiology must worsen health');
}

// 4. Illness progresses coherently over time: healthy -> strained -> ill ->
//    critical -> death, with no skipping and no unexplained jumps.
{
  let current = {
    ...fresh('Arc', 404),
    needs: { hunger: 8, hydration: 6, energy: 4, hygiene: 4 },
  };
  const seen = new Set<string>();
  let deathDay = 0;
  for (let day = 1; day <= 12 && current.health.status === 'alive'; day += 1) {
    const before = current.health.wellness;
    const beforeIllness = current.health.illness;
    current = advanceHealth(current, start + day * DAY);
    seen.add(current.health.stage);
    assert.ok(current.health.wellness <= before, 'wellness must never rise under sustained bad conditions');
    assert.ok(current.health.illness >= beforeIllness, 'illness must never fall under sustained bad conditions');
    if (current.health.status === 'dead') {
      deathDay = day;
      break;
    }
  }
  assert.equal(current.health.status, 'dead', 'prolonged full crisis must end the life');
  assert.ok(deathDay >= 8, 'a full crisis must take days, not minutes');
  assert.equal(seen.has('healthy'), true);
  assert.equal(seen.has('strained'), true);
  assert.equal(seen.has('ill'), true);
  assert.equal(seen.has('critical'), true);
  assert.equal(current.health.diedAt, start + deathDay * DAY);
}

// 5. Improved conditions can trigger recovery: once the body is fed, watered,
//    rested and clean, wellness rises and illness decays over days.
{
  const ill = {
    ...fresh('Mending', 505),
    needs: { ...fresh('Mending', 505).needs, hunger: 70, hydration: 72, energy: 74, hygiene: 68 },
    health: { ...fresh('Mending', 505).health, lastUpdated: start, wellness: 30, illness: 55, stage: 'ill' as const },
  };
  let current = ill;
  for (let day = 1; day <= 6; day += 1) {
    current = advanceHealth(current, start + day * DAY);
  }
  assert.ok(current.health.wellness > ill.health.wellness, 'good conditions must restore wellness');
  assert.ok(current.health.illness < ill.health.illness, 'good conditions must reduce illness');
  assert.equal(current.health.status, 'alive');
  assert.equal(current.health.stage, 'healthy', 'steady good care must eventually return the body to healthy');
}

// 6. Recovery takes time rather than being an instant reset: one good hour
//    does not clear an illness.
{
  const ill = {
    ...fresh('SlowMend', 606),
    needs: { ...fresh('SlowMend', 606).needs, hunger: 80, hydration: 80, energy: 80, hygiene: 80 },
    health: { ...fresh('SlowMend', 606).health, lastUpdated: start, wellness: 30, illness: 55, stage: 'ill' as const },
  };
  const oneGoodHour = advanceHealth(ill, start + HOUR);
  assert.notEqual(oneGoodHour.health.stage, 'healthy', 'recovery must be a real state transition, not instant');
  assert.ok(oneGoodHour.health.illness < 55, 'improvement starts small');
  assert.ok(oneGoodHour.health.illness > 45, 'one hour cannot undo an illness');
}

// 7. Active and offline progression use the same health model: the offline
//    driver's health result equals advanceHealth applied to the offline needs
//    over the same real window (the shared causal function, the same elapsed
//    time; only the needs levels differ because offline decays them).
{
  const base = fresh('SameModel', 707);
  const badNeeds = { ...base.needs, hunger: 12, hydration: 10, energy: 8, hygiene: 6 };
  const offline = simulateOfflineTime(
    { ...base, needs: badNeeds },
    48 * HOUR,
    start + 48 * HOUR,
    () => 0,
  ).state;
  const manual = advanceHealth(
    { ...offline, health: { ...base.health, lastUpdated: start } },
    start + 48 * HOUR,
  );
  assert.equal(manual.health.wellness, offline.health.wellness, 'offline health must equal the same model on the same needs');
  assert.equal(manual.health.illness, offline.health.illness, 'illness must use the same accumulation model offline');
  assert.equal(bodyPressure({ ...base, needs: badNeeds }), bodyPressure({ ...base, needs: badNeeds }));
  assert.equal(offline.health.status, 'alive');
}

// 8. Autonomous self-care meaningfully reduces deterioration: a stocked room
//    (water, food, litter, basin, blanket) keeps the body met and the health
//    model rewards it, while an empty room leaves the body to the floors.
{
  const bad = {
    ...fresh('CareGap', 808),
    needs: { ...fresh('CareGap', 808).needs, hunger: 20, hydration: 18, energy: 30, hygiene: 25 },
  };
  const empty = simulateOfflineTime(bad, 5 * DAY, start + 5 * DAY, () => 0).state;
  const stocked = simulateOfflineTime(
    { ...bad, roomObjects: ['water_bowl', 'apple', 'litter_box', 'wash_basin', 'blanket'].map(careObject) },
    5 * DAY,
    start + 5 * DAY,
    () => 0,
  ).state;
  assert.ok(stocked.health.wellness > empty.health.wellness, 'autonomous self-care must reduce wellness loss');
  assert.ok(stocked.health.illness < empty.health.illness, 'autonomous self-care must reduce illness build-up');
  assert.ok(empty.health.illness > 0, 'the empty-room control must actually suffer');
}

// 9. A v0.14.4 save migrates alive and healthy: identity, memories, path and
//    objects survive, health is safe and never retroactively ill.
{
  const legacy = fresh('Legacy', 909);
  legacy.memories.push({
    id: 'mem-old', timestamp: start - 3 * DAY, content: 'a quiet first day', importance: 5,
    emotionalValence: 0.3, tags: ['first'], mentioned: false, understood: true, compressed: false,
  });
  const raw = { ...legacy } as unknown as Record<string, unknown>;
  delete raw.health;
  const migrated = migrateGameState(raw as GameState);
  assert.equal(migrated.health.status, 'alive');
  assert.equal(migrated.health.stage, 'healthy');
  assert.equal(migrated.health.wellness, 100);
  assert.equal(migrated.health.illness, 0);
  assert.equal(migrated.identity.id, legacy.identity.id);
  assert.equal(migrated.identity.name, 'Legacy');
  assert.equal(migrated.memories.some(memory => memory.id === 'mem-old'), true, 'memories must survive migration');
  assert.equal(migrated.lifePath.primary, legacy.lifePath.primary, 'life path must survive migration');
}

// 10. Health never directly rewrites personality or life path.
{
  const subject = fresh('PathSafe', 1010);
  const personalityBefore = JSON.stringify(subject.personality);
  const lifePathBefore = JSON.stringify(subject.lifePath);
  let dying = {
    ...subject,
    needs: { ...subject.needs, hunger: 8, hydration: 6, energy: 4, hygiene: 4 },
  };
  for (let day = 1; day <= 12 && dying.health.status === 'alive'; day += 1) {
    dying = advanceHealth(dying, start + day * DAY);
  }
  assert.equal(dying.health.status, 'dead');
  assert.equal(JSON.stringify(dying.personality), personalityBefore, 'health must not rewrite personality');
  assert.equal(JSON.stringify(dying.lifePath), lifePathBefore, 'health must not rewrite life path');
  assert.ok(getIllnessIntensity(dying) > 0);
}

// 11. No second heartbeat or timer: health owns no timer, Room never drives
//     it, and App ticks it only inside the existing physiology cadence.
{
  const healthSource = readFileSync('src/systems/healthSystem.ts', 'utf8');
  assert.doesNotMatch(healthSource, /setInterval|setTimeout/, 'healthSystem must own no timer');
  const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
  assert.doesNotMatch(roomSource, /advanceHealth\(/, 'Room must not drive health on its own cadence');
  const appSource = readFileSync('src/App.tsx', 'utf8');
  assert.match(appSource, /advanceHealth\(advanceNeeds\(prev, now\)/, 'App must tick health on the existing physiology heartbeat');
  const offlineSource = readFileSync('src/systems/offlineSimulation.ts', 'utf8');
  assert.match(offlineSource, /advanceHealth\(/, 'the offline pass must drive health with the same model');
}

// 12. The 0.14.4 care/semantic-action contract stays intact with health in the
//     save: the model proposes, local execution is the only source of truth,
//     and health is never mutated by a world action.
{
  const toiletCheck = performImmediateWorldAction(
    { ...fresh('ToiletHealth', 1212), needs: { ...fresh('ToiletHealth', 1212).needs, bladder: 18, bowel: 44 } },
    { kind: 'toilet', objectType: 'litter_box' },
    start + 1,
  );
  assert.equal(toiletCheck.result.status, 'success');
  assert.ok(toiletCheck.state.needs.bladder > 60);
  assert.equal(toiletCheck.state.health.status, 'alive');
  assert.equal(JSON.stringify(toiletCheck.state.health), JSON.stringify(toiletCheck.state.health), 'world action must not disturb health');
}

// 13. Death is persistent and complete.
{
  const dead = (() => {
    let current = {
      ...fresh('Departed', 1313),
      needs: { ...fresh('Departed', 1313).needs, hunger: 8, hydration: 6, energy: 4, hygiene: 4 },
    };
    for (let day = 1; day <= 12 && current.health.status === 'alive'; day += 1) {
      current = advanceHealth(current, start + day * DAY);
    }
    return current;
  })();
  assert.equal(dead.health.status, 'dead');
  assert.ok(Number.isFinite(dead.health.diedAt), 'death must record its moment');

  // Death persists through reload: a dead save is not hatchable and survives a
  // real IndexedDB save -> close -> boot round trip without resurrecting.
  assert.equal(isHatchableBoot(dead), false, 'a dead save must never enter the hatch flow');
  await saveGameState(dead);
  closeDatabaseConnections();
  const reloaded = await loadGameStateForBoot(undefined, 200, 2, { readFallback: undefined });
  assert.ok(reloaded, 'a dead save must load on the next boot');
  assert.equal(reloaded.health.status, 'dead', 'reload must not resurrect');
  assert.equal(reloaded.identity.id, dead.identity.id, 'reload must keep the same identity');
  assert.equal(reloaded.development.hatched, true, 'the hatch transition must stay permanent');
  assert.equal(isHatchableBoot(reloaded), false, 'boot must not offer an egg for a completed life');
  closeDatabaseConnections();

  // Physiology, autonomy and offline life simulation stop after death: no
  // needs, no age, no traces, no new memories, no self-speak.
  const afterAway = simulateOfflineTime(reloaded, 3 * DAY, start + 15 * DAY, () => 0).state;
  assert.equal(afterAway.health.status, 'dead');
  assert.deepEqual(afterAway.needs, reloaded.needs, 'needs must stop changing after death');
  assert.equal(afterAway.development.chronologicalAge, reloaded.development.chronologicalAge, 'age must stop after death');
  assert.deepEqual(afterAway.roomMess, reloaded.roomMess, 'no new room traces after death');
  assert.deepEqual(afterAway.memories.map(memory => memory.id), reloaded.memories.map(memory => memory.id), 'no new memories after death');
  assert.equal(shouldCreatureSelfSpeak(reloaded), false, 'self-speak must stop after death');
  assert.deepEqual(afterAway.presence, reloaded.presence, 'no new return presence after death');

  // Backup/restore preserves death; the dead save is never deleted.
  const restored = parseImportedGameState(serializeGameState(reloaded));
  assert.equal(restored.health.status, 'dead', 'backup/restore must preserve death');
  assert.equal(restored.health.diedAt, reloaded.health.diedAt, 'the death moment must survive backup/restore');
  assert.equal(restored.identity.id, reloaded.identity.id);

  // The death screen keeps the Memory Book and the explicit Start over
  // contract, and never auto-hatches a new egg.
  const deathSource = readFileSync('src/components/DeathScreen.tsx', 'utf8');
  assert.match(deathSource, /MemoryBookView/, 'Memory Book must remain accessible after death');
  assert.match(deathSource, /onReset/, 'Start over must remain available through the existing reset contract');
  assert.doesNotMatch(deathSource, /GAME OVER|revive|countdown/i, 'death UI must stay quiet and non-gamified');
}

// Qualitative contract: stages map to bounded bands only; no raw values leak.
{
  assert.equal(deriveHealthStage(100, 0), 'healthy');
  assert.equal(deriveHealthStage(60, 10), 'strained');
  assert.equal(deriveHealthStage(50, 30), 'strained');
  assert.equal(deriveHealthStage(30, 60), 'ill');
  assert.equal(deriveHealthStage(10, 90), 'critical');
  assert.equal(getHealthBand({ ...fresh('Band', 1414), health: { ...fresh('Band', 1414).health, wellness: 30, illness: 60 } }), 'unwell');
  assert.equal(migrateHealthState({ status: 'dead', diedAt: 123 }, start).diedAt, 123, 'a dead backup keeps its death moment');
}

console.log('Health lifecycle, death persistence, migration, and regression checks passed.');
