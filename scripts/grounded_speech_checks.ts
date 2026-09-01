import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { buildCreatureMindRequest, shouldCreatureSelfSpeak } from '../src/systems/llmConversation';
import { isRestingChatGate } from '../src/systems/conversationSystem';
import { evolveLifePathFromCreatureStatement } from '../src/systems/lifePathSystem';
import { cleanPayload, systemPrompt } from '../worker/src/index.js';
import { GameState } from '../src/types';

const NOW = Date.UTC(2026, 7, 27, 12, 0);
const NIGHT = Date.UTC(2026, 7, 27, 1, 30);

function hatched(name: string, seed: number): GameState {
  const base = createHatchedCreature(createNewCreature(name, seed));
  return {
    ...base,
    conversation: { ...base.conversation, language: 'en' as const },
    development: { ...base.development, cognitiveLevel: 80, languageLevel: 72, stage: 'sentences' as const },
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
}

// 1. A daytime payload says day, never night, and carries one authoritative
//    local clock.
{
  const body = buildCreatureMindRequest(hatched('Day', 101), { now: NOW });
  assert.equal(body.creature.clock?.phase, 'day', 'the authoritative solar phase at noon is day');
  assert.match(body.creature.clock?.localTime ?? '', /^12:0\d$/, 'the same clock carries the local time');
  assert.doesNotMatch(JSON.stringify(body.creature.clock), /"phase":"night"/, 'no night representation at noon');
  assert.equal(body.situation?.place, 'indoor', 'the situation block states where the body is');
}

// 2. A nighttime payload says night and their rest.
{
  const body = buildCreatureMindRequest(hatched('Night', 202), { now: NIGHT });
  assert.equal(body.creature.clock?.phase, 'night');
  assert.equal(body.creature.clock?.rest, true, 'an ordinary mind at night is in its rest');
  assert.equal(body.creature.clock?.sleeping, false, 'awake rest is not asleep');
  assert.match(body.creature.clock?.localTime ?? '', /^01:30$/);
}

// 3. Sleep and wake agree with the authoritative time system.
{
  const awake = hatched('Wake', 303);
  const awakeBody = buildCreatureMindRequest(awake, { now: NOW });
  assert.equal(awakeBody.creature.clock?.sleeping, false);
  assert.equal(awakeBody.creature.mood, awake.emotionalState);
  assert.equal(isRestingChatGate(awake, NOW), false, 'an awake day creature can talk');

  const asleep = { ...awake, sleepState: 'sleeping' as const, currentActivity: 'sleeping' };
  const asleepBody = buildCreatureMindRequest(asleep, { now: NOW });
  assert.equal(asleepBody.creature.clock?.sleeping, true);
  assert.equal(asleepBody.creature.mood, 'asleep');
  assert.equal(isRestingChatGate(asleep, NOW), true, 'a sleeping creature is a closed conversation window');
  assert.equal(shouldCreatureSelfSpeak(asleep, NOW), false);
}

// 4. A real about_to action reaches DeepSeek through the bounded situation
//    context, and the Worker keeps only the allowlisted shape.
{
  const aboutBody = buildCreatureMindRequest(hatched('About', 404), { kind: 'self', now: NOW, aboutTo: { action: 'poop' } });
  assert.equal(aboutBody.promptKind, 'self');
  assert.equal(aboutBody.situation?.place, 'indoor');
  assert.equal(aboutBody.situation?.aboutTo?.action, 'poop', 'the decided action travels with the request');

  const cleaned = cleanPayload({
    creature: { name: 'X', stage: 'sentences', language: 'en' },
    promptKind: 'self',
    situation: { place: 'indoor', aboutTo: { action: 'poop', target: 'hack' } },
    messages: [],
  });
  assert.equal(cleaned.situation?.place, 'indoor');
  assert.equal(cleaned.situation?.aboutTo?.action, 'poop');
  assert.equal(cleaned.situation?.aboutTo?.target, undefined, 'an unknown aboutTo target is stripped');

  const cleanedBad = cleanPayload({
    creature: { name: 'X', stage: 'sentences', language: 'en' },
    promptKind: 'self',
    situation: { place: 'outdoors', aboutTo: { action: 'hack' } },
    messages: [],
  });
  assert.equal(cleanedBad.situation?.aboutTo, undefined, 'a non-allowlisted action is stripped');
  assert.equal(cleanedBad.situation?.place, 'outdoors');

  const prompt = systemPrompt(cleaned);
  assert.match(prompt, /SITUATION is the authoritative record/);
  assert.match(prompt, /"aboutTo":\{"action":"poop"\}/, 'the decided action reaches the model as a fact, not a command');
  assert.doesNotMatch(prompt, /"target":"hack"/);
}

// 5. Canned creature speech is not a fallback after AI failure: the one-liner
//    module is gone, Room never imports it, and the announcement path is
//    fire-and-forget with silence on failure.
{
  assert.equal(existsSync('src/systems/selfCareSpeech.ts'), false, 'the canned self-care one-liner module must be gone');
  const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
  assert.doesNotMatch(roomSource, /getSelfCareLine|selfCareSpeech/, 'Room must not import canned one-liners');
  const announceStart = roomSource.indexOf('const announceSelfCare');
  const announceEnd = roomSource.indexOf('useEffect(() => {', announceStart);
  const announceBody = roomSource.slice(announceStart, announceEnd);
  assert.match(announceBody, /kind: 'self', aboutTo: \{ action: kind \}/, 'self-care announcements ride /chat with the true about_to action');
  assert.match(announceBody, /\.catch\(/, 'a failed mind call is caught');
  assert.doesNotMatch(announceBody, /await/, 'the announcement never blocks the action on the mind');
  assert.match(announceBody, /stage !== 'mature'/, 'only a mature mind narrates its own body');
}

// 6. AI failure still lets the real action run without any speech: the
//    canonical object-use pipeline is never gated on the announcement.
{
  const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
  const chooseStart = roomSource.indexOf('const chooseBehavior');
  const chooseEnd = roomSource.indexOf('const kickoff = setTimeout', chooseStart);
  const chooseBody = roomSource.slice(chooseStart, chooseEnd);
  assert.ok(
    chooseBody.indexOf('announceSelfCare') < chooseBody.indexOf('beginObjectInteraction(goal, false)'),
    'the autonomy loop announces first, then always runs the canonical action',
  );
  assert.doesNotMatch(chooseBody, /if \(.*announceSelfCare.*\).*return/, 'a failed announcement must not stop the action');
}

// 7. Development still constrains the voice: the Worker applies the stage
//    ladder, and the stage is part of every request.
{
  const newbornPrompt = systemPrompt(cleanPayload({
    creature: { name: 'X', stage: 'newborn', language: 'en' },
    messages: [{ role: 'user', content: 'Hi.' }],
  }));
  assert.match(newbornPrompt, /one short, simple, concrete sentence/);
  const maturePrompt = systemPrompt(cleanPayload({
    creature: { name: 'X', stage: 'mature', language: 'en' },
    messages: [{ role: 'user', content: 'Hi.' }],
  }));
  assert.match(maturePrompt, /reflective, personal, concise/);
  assert.equal(buildCreatureMindRequest(hatched('Stage', 505), { now: NOW }).creature.stage, 'sentences');
}

// 8. Personality/life path still reach the mind context on self/announcement
//    requests exactly as on ordinary turns.
{
  let leaning = hatched('Lean', 606);
  leaning = evolveLifePathFromCreatureStatement(leaning, 'Lubię jarać.', NOW);
  const body = buildCreatureMindRequest(leaning, { kind: 'self', now: NOW, aboutTo: { action: 'drink' } });
  assert.equal(body.lifePath?.layer, 'leaning', 'an earned leaning travels with the about_to request');
  assert.equal(body.lifePath?.id, 'stoner');
  const normal = buildCreatureMindRequest(leaning, { now: NOW });
  assert.equal(normal.lifePath?.layer, body.lifePath?.layer, 'self and reply turns share the same overlay rules');
}

// 9. No second speech loop or timer: Room keeps exactly its four existing
//    intervals and the announcement owns no timer of its own.
{
  const roomSource = readFileSync('src/components/Room.tsx', 'utf8');
  const intervals = roomSource.match(/setInterval\(/g) ?? [];
  assert.equal(intervals.length, 4, 'Room must keep exactly its four existing intervals (clock, autonomy, development, self-speak)');
  const announceStart = roomSource.indexOf('const announceSelfCare');
  const announceEnd = roomSource.indexOf('useEffect(() => {', announceStart);
  const announceBody = roomSource.slice(announceStart, announceEnd);
  assert.doesNotMatch(announceBody, /setInterval|setTimeout/, 'the announcement must ride the existing cadence');
  assert.match(roomSource, /kind:\s*'self'/, 'rare self-speak still reuses /chat');
}

// The authoritative context always carries the current activity and place, so
// the model cannot claim an action the local state does not confirm.
{
  const active = {
    ...hatched('Busy', 707),
    currentActivity: 'approaching the apple',
    world: { ...hatched('Busy', 707).world, place: 'outdoors' as const },
  };
  const body = buildCreatureMindRequest(active, { now: NOW });
  assert.equal(body.situation?.place, 'outdoors');
  assert.equal(body.situation?.activity, 'approaching the apple');
}

console.log('Grounded speech, about_to context, and no-fallback checks passed.');
