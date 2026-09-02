import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  getDevelopmentStageFromMemory,
  mapLegacyStageIdsInProse,
  syncDevelopmentWithAge,
} from '../src/systems/developmentSystem';
import { generateDreamAfterSleep, repairMalformedDreamProse } from '../src/systems/innerLifeSystem';
import { migrateGameState } from '../src/systems/persistence';
import { ensureDailyMoment, resolveDailyMoment } from '../src/systems/lifePathSystem';
import {
  beginSelfCareSpeech,
  canSpeakSelfCare,
  createSelfCareSpeechPolicy,
  finishSelfCareSpeech,
  recordStandaloneSelfCareSpeech,
} from '../src/systems/selfCareSpeechPolicy';
import { formatStoredMemory } from '../src/systems/uiLanguage';
import { chooseObjectReaction } from '../src/systems/relationshipSystem';
import {
  applyWorldObjectReaction,
  beginWorldObjectApproach,
  offerObjectFromInventory,
} from '../src/systems/worldActionSystem';
import { GameState, Memory } from '../src/types';

const NOW = Date.UTC(2026, 8, 2, 12, 0);

function awakeCreature(name: string, seed: number): GameState {
  const state = createHatchedCreature(createNewCreature(name, seed, NOW));
  return {
    ...state,
    development: {
      ...state.development,
      cognitiveLevel: 30,
      languageLevel: 10,
      chronologicalAge: 0,
      stage: 'communicating',
    },
    world: {
      ...state.world,
      settings: {
        ...state.world.settings,
        mode: 'city',
        location: {
          source: 'city', name: 'UTC', latitude: 0, longitude: 0,
          timezone: 'UTC', countryCode: 'GB', country: 'UTC',
        },
      },
    },
  };
}

// One unresolved bodily intent is announced once. A different dominant action
// can speak, and a material need change reopens the same action after the
// previous attempt has reached a terminal state.
{
  const policy = createSelfCareSpeechPolicy();
  const hungry = { ...awakeCreature('Care', 101), needs: { ...awakeCreature('Care', 101).needs, hunger: 18, bowel: 90 } };
  const first = beginSelfCareSpeech(policy, hungry, 'eat');
  assert.ok(first);
  assert.equal(beginSelfCareSpeech(policy, hungry, 'eat'), null, 'an underway about-to action cannot announce again');
  finishSelfCareSpeech(policy, first!, 'completed');
  assert.equal(beginSelfCareSpeech(policy, hungry, 'eat'), null, 'the same unresolved need is not re-announced');

  const bathroom = { ...hungry, needs: { ...hungry.needs, bowel: 12 } };
  const different = beginSelfCareSpeech(policy, bathroom, 'poop');
  assert.ok(different, 'a materially different dominant action may speak');
  finishSelfCareSpeech(policy, different!, 'failed');

  const changed = { ...hungry, needs: { ...hungry.needs, hunger: 34 } };
  assert.ok(beginSelfCareSpeech(policy, changed, 'eat'), 'a meaningful body-state change reopens eligibility');
}

{
  const policy = createSelfCareSpeechPolicy();
  const hungry = { ...awakeCreature('Self', 102), needs: { ...awakeCreature('Self', 102).needs, hunger: 20 } };
  recordStandaloneSelfCareSpeech(policy, hungry, 'eat');
  assert.equal(canSpeakSelfCare(policy, hungry, 'eat'), false, 'generic self-speak shares the unresolved-need suppression');
}

// Stage IDs stay internal. New memories use stage copy, legacy saves are
// localized at display/dream boundaries, and neither path emits snake_case.
{
  assert.equal(getDevelopmentStageFromMemory('reached first_words'), 'first_words');
  assert.equal(formatStoredMemory('reached first_words', 'en'), 'Reached First words');
  assert.equal(formatStoredMemory('reached first_words', 'pl'), 'Osiągnęło etap: Pierwsze słowa');
  assert.doesNotMatch(formatStoredMemory('reached first_words', 'en'), /first_words/);

  const legacy = awakeCreature('Legacy', 202);
  const dreamed = generateDreamAfterSleep({
    ...legacy,
    memories: [{
      id: 'legacy-stage', timestamp: NOW - 1, content: 'reached first_words', importance: 10,
      emotionalValence: 0.6, tags: ['development', 'milestone'], mentioned: false, understood: true, compressed: false,
    }],
    innerLife: { ...legacy.innerLife, lastDreamAt: 0 },
  }, 30 * 60_000, NOW);
  assert.ok(dreamed.innerLife.dreams.length > 0);
  assert.doesNotMatch(dreamed.innerLife.dreams.at(-1)?.fragment ?? '', /first_words/);

  const agedBase = awakeCreature('Aged', 203);
  const aged = syncDevelopmentWithAge({
    ...agedBase,
    identity: { ...agedBase.identity, birthTimestamp: NOW - 8 * 86_400_000 },
  }, NOW);
  const milestone = aged.memories.find(memory => memory.tags.includes('development'));
  assert.ok(milestone);
  assert.doesNotMatch(milestone!.content, /\b[a-z]+_[a-z]+\b/);
}

// Stored prose that older versions generated with the raw stage id embedded —
// a dream fragment, its "dreamed:" memory, or a transcript quoting it — is
// repaired once on load. Regression from the live production smoke of a real
// pre-0.14.12 save whose first v0.14.12 boot displayed the leak in Memory Book
// and chat. Only genuinely snake-case ids are remapped inside prose; ordinary
// words such as "animal" or "egg" are never rewritten.
{
  const dirtyFragment = 'reached first_words floated above the room breathing in the dark, and neither one thought this was strange.';
  const clean = mapLegacyStageIdsInProse(dirtyFragment);
  assert.equal(
    clean,
    'Reached First words floated above the room breathing in the dark, and neither one thought this was strange.',
  );
  assert.doesNotMatch(clean, /first_words/);
  assert.equal(mapLegacyStageIdsInProse('dreamed: reached first_words floated'), 'dreamed: Reached First words floated', 'a dreamed: prefix keeps its form');
  assert.equal(mapLegacyStageIdsInProse('Reached First words'), 'Reached First words', 'repair is idempotent');
  assert.equal(mapLegacyStageIdsInProse('The creature reached the animal shelter safely.'), 'The creature reached the animal shelter safely.', 'ordinary prose words are never rewritten');
  assert.equal(mapLegacyStageIdsInProse('The cushion is my favourite.'), 'The cushion is my favourite.');

  const base = awakeCreature('Stored', 602);
  const dirty: GameState = {
    ...base,
    memories: [
      ...base.memories,
      {
        id: 'mem-legacy-stage', timestamp: NOW - 10, content: 'reached first_words', importance: 8,
        emotionalValence: 0.6, tags: ['development', 'milestone'], mentioned: false, understood: true, compressed: false,
      },
      {
        id: 'mem-legacy-dream', timestamp: NOW - 9, content: `dreamed: ${dirtyFragment}`, importance: 6,
        emotionalValence: 0.4, tags: ['dream', 'bright'], mentioned: false, understood: true, compressed: false,
      },
      {
        id: 'mem-malformed-dream', timestamp: NOW - 8, content: 'dreamed: Reached First words floated above the room breathing in the dark, and neither one thought this was strange.', importance: 6,
        emotionalValence: 0.4, tags: ['dream', 'bright'], mentioned: false, understood: true, compressed: false,
      },
    ],
    innerLife: {
      ...base.innerLife,
      dreams: [
        { id: 'dream-legacy', timestamp: NOW - 9, title: 'The borrowed voice', fragment: dirtyFragment, mood: 'bright', shared: false },
        { id: 'dream-malformed', timestamp: NOW - 8, title: 'The borrowed voice', fragment: 'Reached First words floated above the room breathing in the dark, and neither one thought this was strange.', mood: 'bright', shared: false },
      ],
    },
    conversation: {
      ...base.conversation,
      messages: [
        ...base.conversation.messages,
        { id: 'msg-legacy', sender: 'creature', text: `I had a strange dream: ${dirtyFragment}`, timestamp: NOW - 9 },
        { id: 'msg-user', sender: 'user', text: 'I keep typing first_words on purpose in my own notes', timestamp: NOW - 8 },
        { id: 'msg-user-milestone', sender: 'user', text: 'Reached First words floated above the room and I typed that myself', timestamp: NOW - 7 },
      ],
      lastCreatureMessage: `I had a strange dream: ${dirtyFragment}`,
    },
  };
  const repaired = migrateGameState(dirty);
  assert.doesNotMatch(repaired.innerLife.dreams.at(-1)?.fragment ?? '', /first_words/, 'a stored dream fragment is repaired on load');
  const repairedDreams = repaired.innerLife.dreams.map(dream => dream.fragment);
  assert.ok(repairedDreams.every(fragment => !/first_words|\bReached\b/.test(fragment)), 'stored malformed dream prose becomes dream imagery, never milestone copy');
  assert.ok(repairedDreams.some(fragment => fragment.startsWith('The arrival of the first words floated')), 'the repaired dream uses the milestone dream image');
  assert.ok(repaired.memories.every(memory => !/[a-z]+_[a-z]+/.test(memory.content)), 'stored memory prose carries no raw stage id after load');
  const creatureMessages = repaired.conversation.messages.filter(message => message.sender === 'creature');
  const userMessages = repaired.conversation.messages.filter(message => message.sender === 'user');
  assert.ok(creatureMessages.every(message => !/[a-z]+_[a-z]+/.test(message.text) && !/\bReached\b/.test(message.text)), 'creature transcripts quoting the malformed dream are repaired');
  assert.ok(userMessages.some(message => message.text === 'I keep typing first_words on purpose in my own notes'), 'user-authored message text is preserved byte-for-byte');
  assert.ok(userMessages.some(message => message.text === 'Reached First words floated above the room and I typed that myself'), 'a user message containing the milestone phrase is never rewritten');
  assert.equal(repaired.conversation.lastCreatureMessage, 'I had a strange dream: The arrival of the first words floated above the room breathing in the dark, and neither one thought this was strange.', 'lastCreatureMessage is repaired like other creature prose');
}

// Dreams use dream imagery, not milestone/record copy. The reported production
// example ("Reached First words floated above the room…") must never recur,
// and no raw stage id may reach a fragment.
{
  const base = awakeCreature('Dreamer', 701);
  const milestoneMemory: Memory = {
    id: 'mem-first-words', timestamp: NOW - 1, content: 'Reached First words', importance: 10,
    emotionalValence: 0.6, tags: ['development', 'milestone'], mentioned: false, understood: true, compressed: false,
  };
  const fragments: string[] = [];
  for (let hour = 0; hour < 48; hour += 1) {
    const dreamed = generateDreamAfterSleep({
      ...base,
      memories: [milestoneMemory],
      innerLife: { ...base.innerLife, lastDreamAt: 0 },
    }, 30 * 60_000, NOW + hour * 3_600_000);
    const fragment = dreamed.innerLife.dreams.at(-1)?.fragment ?? '';
    fragments.push(fragment);
    assert.doesNotMatch(fragment, /first_words/, `no raw stage id in fragment ${hour}`);
    assert.doesNotMatch(fragment, /\bReached\b|\bOsiągnęło etap:/, `milestone UI copy is never spliced into a dream (fragment ${hour})`);
    assert.doesNotMatch(fragment, /Reached First words floated/, 'the reported production example cannot recur');
  }
  assert.ok(fragments.some(fragment => fragment.includes('the arrival of the first words')), 'the milestone becomes a natural dream image');
  assert.ok(fragments.every(fragment => fragment.length > 0), 'every dream still carries a fragment');
}

// Other record-shaped memories (absences, resolved moment titles, learned user
// facts) become noun-like images instead of being spliced as raw records.
{
  const recordsBase = awakeCreature('Records', 702);
  const recordFragments: Array<{ memory: Memory; forbidden: RegExp; expected: RegExp }> = [
    {
      memory: {
        id: 'mem-absence', timestamp: NOW - 2, content: 'the room had 4 quiet hours of its own', importance: 9,
        emotionalValence: 0.08, tags: ['absence', 'presence'], mentioned: false, understood: true, compressed: false,
      },
      forbidden: /the room had 4 quiet hours of its own/,
      expected: /the quiet hours of an empty room/i,
    },
    {
      memory: {
        id: 'mem-moment', timestamp: NOW - 2, content: 'The Easy Bet: Walking away felt strangely powerful.', importance: 7,
        emotionalValence: 0.35, tags: ['daily-moment', 'choice', 'unwritten'], mentioned: false, understood: true, compressed: false,
      },
      forbidden: /The Easy Bet: Walking away/,
      expected: /\bThe Easy Bet\b/i,
    },
    {
      memory: {
        id: 'mem-fact', timestamp: NOW - 2, content: "learned the user's name is Moth", importance: 8,
        emotionalValence: 0.5, tags: ['conversation', 'user', 'name'], mentioned: false, understood: true, compressed: false,
      },
      forbidden: /learned the user/,
      expected: /\byour name\b/i,
    },
  ];
  for (const { memory, forbidden, expected } of recordFragments) {
    const dreamed = generateDreamAfterSleep({
      ...recordsBase,
      memories: [memory],
      innerLife: { ...recordsBase.innerLife, lastDreamAt: 0 },
    }, 30 * 60_000, NOW);
    const fragment = dreamed.innerLife.dreams.at(-1)?.fragment ?? '';
    assert.doesNotMatch(fragment, forbidden, 'a record-shaped memory is never spliced raw into a dream');
    assert.doesNotMatch(fragment, /[a-z]+_[a-z]+/);
    if (!/had your voice|miało twoim głosem/.test(fragment)) {
      assert.match(fragment, expected, 'the record becomes a noun-like dream image when its template carries an image');
    }
  }
}

// The repair targets only the recognisable milestone construction in dream
// prose; it is idempotent and leaves everything else verbatim.
{
  assert.equal(
    repairMalformedDreamProse('Reached First words floated above the room breathing in the dark, and neither one thought this was strange.'),
    'The arrival of the first words floated above the room breathing in the dark, and neither one thought this was strange.',
    'the v0.14.12 form of the malformed dream is repaired',
  );
  assert.equal(
    repairMalformedDreamProse('reached first_words floated above the room breathing in the dark, and neither one thought this was strange.'),
    'The arrival of the first words floated above the room breathing in the dark, and neither one thought this was strange.',
    'the legacy raw-id form is repaired the same way',
  );
  assert.equal(
    repairMalformedDreamProse('Somewhere far away, reached combining kept happening in reverse.'),
    'Somewhere far away, thoughts beginning to join kept happening in reverse.',
    'mid-prose milestone phrases become lowercase images',
  );
  assert.equal(
    repairMalformedDreamProse('I had a strange dream: Reached First words floated above the room.'),
    'I had a strange dream: The arrival of the first words floated above the room.',
    'a chat line quoting the malformed dream is repaired',
  );
  assert.equal(
    repairMalformedDreamProse('The arrival of the first words floated above the room breathing in the dark, and neither one thought this was strange.'),
    'The arrival of the first words floated above the room breathing in the dark, and neither one thought this was strange.',
    'repair is idempotent',
  );
  assert.equal(
    repairMalformedDreamProse('The creature walked to the water bowl and drank.'),
    'The creature walked to the water bowl and drank.',
    'ordinary dream prose is never paraphrased',
  );
}

// The Memory Book is a projection of the saved GameState. The dead generator
// and competing persistence API are gone; old databases may retain an unused
// object store until explicit Start over deletes the whole database.
{
  assert.equal(existsSync('src/systems/memoryBook.ts'), false);
  const persistence = readFileSync('src/systems/persistence.ts', 'utf8');
  const view = readFileSync('src/components/MemoryBookView.tsx', 'utf8');
  assert.doesNotMatch(persistence, /loadMemoryBook|addMemoryBookEntry|createObjectStore\('memoryBook'\)/);
  assert.match(view, /state\.memories/);
  assert.match(view, /state\.innerLife\.dreams/);
  assert.doesNotMatch(view, /loadMemoryBook|generateMemoryBookEntry/);
}

// Daily moments use a stable template identity, vary by creature seed, and
// exclude the recent creature-history window whenever alternatives exist.
{
  const base = awakeCreature('Moment', 301);
  const first = ensureDailyMoment(base, NOW).lifePath.pendingMoment;
  const repeat = ensureDailyMoment(structuredClone(base), NOW).lifePath.pendingMoment;
  assert.ok(first?.templateId);
  assert.equal(repeat?.templateId, first?.templateId, 'selection is reproducible from local state and seed');

  const recentlySeen = ensureDailyMoment({
    ...base,
    lifePath: {
      ...base.lifePath,
      recentDailyMomentTemplateIds: [first!.templateId!],
    },
  }, NOW).lifePath.pendingMoment;
  assert.notEqual(recentlySeen?.templateId, first?.templateId, 'an exact recent moment is avoided when another is eligible');

  const firstTemplates = new Set(Array.from({ length: 20 }, (_, index) => (
    ensureDailyMoment(awakeCreature(`Fresh${index}`, 400 + index), NOW).lifePath.pendingMoment?.templateId
  )));
  assert.ok(firstTemplates.size > 1, 'fresh creatures do not all inherit one array-order winner');

  const choice = first!.choices[0];
  const resolved = resolveDailyMoment({ ...base, lifePath: { ...base.lifePath, pendingMoment: first } }, choice.id, NOW + 1);
  assert.deepEqual(resolved.lifePath.recentDailyMomentTemplateIds, [first!.templateId]);
}

// Bond accounting proof: approach alone is not care, an autonomous completion
// is not user care, and the one canonical user completion records one event.
{
  const base = { ...awakeCreature('Bond', 501), needs: { ...awakeCreature('Bond', 501).needs, hydration: 8 } };
  const offered = offerObjectFromInventory(base, 'water_bowl', { x: 52, y: 66 }, NOW);
  const water = offered.state.roomObjects.find(object => object.type === 'water_bowl')!;
  const reaction = chooseObjectReaction(offered.state, 'water_bowl');
  const approach = beginWorldObjectApproach(offered.state, water).state;
  assert.equal(approach.bond.totalInteractions, offered.state.bond.totalInteractions, 'an interrupted approach is not completed care');

  const autonomous = applyWorldObjectReaction(offered.state, water.id, reaction, { x: 45, y: 66 }, reaction.label, false, NOW + 1);
  assert.equal(autonomous.bond.totalInteractions, offered.state.bond.totalInteractions, 'autonomous care does not count as user care');
  assert.equal(autonomous.bond.careActions, offered.state.bond.careActions);

  const completed = applyWorldObjectReaction(offered.state, water.id, reaction, { x: 45, y: 66 }, reaction.label, true, NOW + 1);
  assert.equal(completed.bond.totalInteractions, offered.state.bond.totalInteractions + 1);
  assert.equal(completed.bond.careActions, offered.state.bond.careActions + 1);
  assert.equal(completed.bond.history.length, offered.state.bond.history.length + 1, 'the completed reaction records exactly one bond event');
}

console.log('Longitudinal QA continuity and polish checks passed.');
