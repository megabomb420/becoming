import assert from 'node:assert/strict';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import { buildCreatureMindRequest, chooseMindReasoningHint } from '../src/systems/llmConversation';
import { cleanPayload } from '../worker/src/index.js';
import { GameState } from '../src/types';

const NOON = Date.UTC(2026, 7, 23, 12, 0);
const NIGHT = Date.UTC(2026, 7, 23, 23, 0);

function mindBase(): GameState {
  const base = createHatchedCreature(createNewCreature('Mind', 39));
  return {
    ...base,
    development: { ...base.development, cognitiveLevel: 40, languageLevel: 40, stage: 'sentences' as const, hatched: true },
    conversation: { ...base.conversation, language: 'en' as const },
  };
}

// 1. Clock/rest is always present and reflects the creature's solar day.
const noon = buildCreatureMindRequest(mindBase(), { now: NOON });
assert.ok(noon.creature.clock, 'clock is always present in the creature payload');
assert.equal(noon.creature.clock.rest, false, 'a diurnal creature is not resting at noon');
assert.equal(noon.creature.clock.sleeping, false);
const night = buildCreatureMindRequest(mindBase(), { now: NIGHT });
assert.equal(night.creature.clock.rest, true, 'a diurnal creature rests at solar night');

// 2. Overlays appear only with evidence: no care when comfortable, no weather
//    without affinity / wantOut / outdoors, no lifePath without a stable path.
const comfortable = buildCreatureMindRequest(mindBase(), { now: NOON });
assert.equal(comfortable.care, undefined, 'no care overlay when the body is comfortable');
assert.equal(comfortable.weather, undefined, 'no weather overlay without evidence');
assert.equal(comfortable.lifePath, undefined, 'no lifePath overlay without a stable path');

const hungry = buildCreatureMindRequest({ ...mindBase(), needs: { ...mindBase().needs, hunger: 20 } }, { now: NOON });
assert.ok(hungry.care, 'a pressing need adds the care overlay');
assert.equal(typeof hungry.care?.hunger, 'string', 'care sends a band, never a raw percentage');
assert.equal(hungry.care?.hunger, 'very_hungry');

const outdoors = buildCreatureMindRequest({ ...mindBase(), world: { ...mindBase().world, place: 'outdoors' } }, { now: NOON });
assert.equal(outdoors.weather?.place, 'outdoors', 'an outdoor visit carries the weather overlay');

// 3. Thin mind: no raw need percentages, no personality or life-path scores.
const serialized = JSON.stringify(hungry);
assert.doesNotMatch(serialized, /"hunger":\d|\"bladder\":\d|\"bowel\":\d|\"hygiene\":\d/, 'raw need values must never reach the mind');
assert.doesNotMatch(serialized, /"personality"/, 'the raw personality model must not be sent');
assert.doesNotMatch(serialized, /"curiosity":\d|\"impulsiveness\":\d|\"scores\"/, 'no personality or life-path scores');

// 4. cleanPayload (worker boundary) drops the raw personality/scores model and
//    sends a sanitized overlay (never raw scores) for the life path.
const cleaned = cleanPayload({
  creature: { name: 'Thin', stage: 'sentences', language: 'en' },
  personality: { curiosity: 99, impulsiveness: 99 },
  lifePath: { primary: 'stoner', layer: 'identity', scores: { stoner: 99 } },
  messages: [{ role: 'user', content: 'Hi.' }],
});
assert.deepEqual(Object.keys(cleaned.creature).sort(), ['ageDays', 'language', 'mood', 'name', 'stage'], 'cleanPayload sends only the creature identity');
assert.equal('personality' in cleaned, false, 'cleanPayload must drop the personality model');
assert.ok(cleaned.lifePath, 'a provided life path rides through as a sanitized overlay');
assert.equal(cleaned.lifePath?.primary, 'stoner');
assert.equal('scores' in (cleaned.lifePath ?? {}), false, 'raw life-path scores must never cross the boundary');
assert.doesNotMatch(JSON.stringify(cleaned), /"curiosity":\d|\"scores\"/, 'no score data leaks through the boundary');

// 5. Selective reasoning is conservative and contextual. Length and a lone
//    keyword/domain never earn thinking; two relevant earned domains do.
const longButSimple = `hello ${'very '.repeat(240)}nice to see you`;
assert.equal(chooseMindReasoningHint({ latestUserMessage: longButSimple }), 'ordinary', 'length alone never enables reasoning');
assert.equal(chooseMindReasoningHint({
  latestUserMessage: 'What do you think about the garden?',
  innerLife: { opinions: [{ topic: 'garden', reason: 'quiet leaves' }] },
}), 'ordinary', 'one relevant earned domain remains ordinary');
const earnedComplex = {
  latestUserMessage: 'We left the garden question unresolved. Has your opinion about the garden changed between us?',
  innerLife: { opinions: [{ topic: 'garden', reason: 'quiet leaves' }] },
  continuity: { openThreads: [{ kind: 'question', subject: 'garden question' }] },
  relationship: { bond: 'close' as const },
};
assert.equal(chooseMindReasoningHint(earnedComplex), 'complex', 'two matching earned contexts enable bounded reasoning');
assert.equal(chooseMindReasoningHint({ ...earnedComplex, kind: 'self' }), 'ordinary', 'autonomous speech never enables reasoning');
assert.equal(chooseMindReasoningHint({ ...earnedComplex, aboutTo: { action: 'drink' } }), 'ordinary', 'self-care never enables reasoning');

const workerDemoted = cleanPayload({
  creature: { name: 'Thin', stage: 'sentences', language: 'en' },
  reasoning: 'complex',
  messages: [{ role: 'user', content: 'Hello.' }],
});
assert.equal(workerDemoted.reasoning, 'ordinary', 'Worker demotes an unsupported complex hint');
const workerAccepted = cleanPayload({
  creature: { name: 'Thin', stage: 'sentences', language: 'en' },
  reasoning: 'complex',
  relationship: { bond: 'close' },
  continuity: { openThreads: [{ kind: 'question', subject: 'garden question', askCount: 1 }] },
  messages: [{ role: 'user', content: 'What about us and that garden question?' }],
});
assert.equal(workerAccepted.reasoning, 'complex', 'Worker accepts only a bounded hint backed by multiple sanitized domains');

console.log('Thin-mind payload checks passed.');
