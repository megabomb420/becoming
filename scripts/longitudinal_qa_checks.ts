import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHatchedCreature, createNewCreature } from '../src/systems/creatureFactory';
import {
  getDevelopmentStageFromMemory,
  mapLegacyStageIdsInProse,
  syncDevelopmentWithAge,
} from '../src/systems/developmentSystem';
import { generateDreamAfterSleep } from '../src/systems/innerLifeSystem';
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
import { GameState } from '../src/types';

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
    ],
    innerLife: {
      ...base.innerLife,
      dreams: [{ id: 'dream-legacy', timestamp: NOW - 9, title: 'The borrowed voice', fragment: dirtyFragment, mood: 'bright', shared: false }],
    },
    conversation: {
      ...base.conversation,
      messages: [
        ...base.conversation.messages,
        { id: 'msg-legacy', sender: 'creature', text: `I had a strange dream: ${dirtyFragment}`, timestamp: NOW - 9 },
        { id: 'msg-user', sender: 'user', text: 'I keep typing first_words on purpose in my own notes', timestamp: NOW - 8 },
      ],
      lastCreatureMessage: `I had a strange dream: ${dirtyFragment}`,
    },
  };
  const repaired = migrateGameState(dirty);
  assert.doesNotMatch(repaired.innerLife.dreams.at(-1)?.fragment ?? '', /first_words/, 'a stored dream fragment is repaired on load');
  assert.ok(repaired.memories.every(memory => !/[a-z]+_[a-z]+/.test(memory.content)), 'stored memory prose carries no raw stage id after load');
  const creatureMessages = repaired.conversation.messages.filter(message => message.sender === 'creature');
  const userMessages = repaired.conversation.messages.filter(message => message.sender === 'user');
  assert.ok(creatureMessages.every(message => !/[a-z]+_[a-z]+/.test(message.text)), 'creature transcripts carry no raw stage id after load');
  assert.ok(userMessages.every(message => message.text === 'I keep typing first_words on purpose in my own notes'), 'user-authored message text is preserved byte-for-byte');
  assert.equal(repaired.conversation.lastCreatureMessage, 'I had a strange dream: Reached First words floated above the room breathing in the dark, and neither one thought this was strange.', 'lastCreatureMessage is repaired like other creature prose');
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
