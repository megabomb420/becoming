import {
  CreatureBehavior,
  GameState,
  ObjectType,
  RoomObject,
  WeatherCondition,
} from '../types';
import {
  applyNeedDelta,
  cleanRoomMess,
  drinkCreature,
  feedCreature,
  getSleepBlocker,
  putToSleep,
  useToilet,
  wakeUp,
  washCreature,
} from './needsSystem';
import { getCircadianDisposition, getTimeOfDay } from './timeSystem';
import { learnWord, updateDevelopment } from './developmentSystem';
import { ObjectReaction, recordBondEvent, recordObjectExperience } from './relationshipSystem';
import { evolveLifePathFromObject } from './lifePathSystem';
import { evolveInnerLifeFromObject } from './innerLifeSystem';
import { evolveCreationFromObject } from './creationSystem';
import {
  beginOutdoorVisit,
  endOutdoorVisit,
  getWeatherConditionLabel,
  outdoorVisitBlocked,
} from './environmentSystem';

export type WorldIntentKind =
  | 'offer_object'
  | 'use_object'
  | 'drink'
  | 'sleep'
  | 'wake'
  | 'come_here'
  | 'toilet'
  | 'wash'
  | 'clean'
  | 'go_outside'
  | 'come_inside';

export interface WorldIntent {
  kind: WorldIntentKind;
  objectType?: ObjectType;
}

export type WorldActionStatus =
  | 'offered'
  | 'success'
  | 'refused'
  | 'unavailable'
  | 'blocked'
  | 'already_satisfied';

export interface WorldActionResult {
  intent: WorldIntent;
  status: WorldActionStatus;
  objectType?: ObjectType;
  objectId?: string;
  consumed?: boolean;
  reason?: string;
}

export interface WorldActionExecution {
  state: GameState;
  result: WorldActionResult;
}

const OBJECT_ALIASES: Array<[ObjectType, string[]]> = [
  ['water_bowl', ['water', 'woda', 'wode', 'pij', 'drink']],
  ['litter_box', ['litter', 'kuweta', 'kuwete', 'toilet', 'toaleta', 'toalety']],
  ['wash_basin', ['basin', 'washbasin', 'miska do mycia']],
  ['apple', ['apple', 'jablko', 'jablka']],
  ['broccoli', ['broccoli', 'brokul', 'brokula']],
  ['ball', ['ball', 'pilka', 'pilke']],
  ['blanket', ['blanket', 'koc', 'koca']],
  ['paper', ['paper', 'papier', 'papieru']],
  ['pencil', ['pencil', 'olowek', 'olowka']],
  ['box', ['box', 'pudelko', 'pudelka']],
  ['stone', ['stone', 'kamien', 'kamienia']],
  ['mirror', ['mirror', 'lustro', 'lustra']],
  ['food_bowl', ['food bowl', 'miska na jedzenie', 'miska z jedzeniem']],
];

const COMMAND_WORDS = {
  offer: ['daj', 'dam', 'podaj', 'masz', 'prosze wez', 'give', 'take this', 'here is', 'have a'],
  use: ['uzyj', 'podejdz', 'podejdz do', 'zobacz', 'sprawdz', 'look at', 'go to', 'approach', 'use'],
};

export function normalizeWorldText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(text: string, phrases: string[]): boolean {
  return phrases.some(phrase => (
    text === phrase
    || text.startsWith(`${phrase} `)
    || text.endsWith(` ${phrase}`)
    || text.includes(` ${phrase} `)
  ));
}

export function findMentionedObject(text: string): ObjectType | undefined {
  const normalized = normalizeWorldText(text);
  return OBJECT_ALIASES.find(([, aliases]) => aliases.some(alias => normalized === alias || normalized.includes(alias)))?.[0];
}

/**
 * Small deterministic command vocabulary. It intentionally recognises only
 * clear PL/EN requests; everything else remains ordinary conversation.
 */
export function parseWorldIntent(text: string): WorldIntent | null {
  const normalized = normalizeWorldText(text);
  if (!normalized) return null;
  const objectType = findMentionedObject(normalized);

  if (hasPhrase(normalized, ['obudz sie', 'obudz go', 'obudz ja', 'wake up', 'wake'])) return { kind: 'wake' };
  if (hasPhrase(normalized, ['idz spac', 'idź spać', 'poloz sie spac', 'spij', 'go to sleep', 'go sleep', 'sleep now'])) return { kind: 'sleep' };
  if (hasPhrase(normalized, ['chodzmy na dwor', 'wyjdz na dwor', 'wyjdz na zewnatrz', 'go outside', 'come outside', 'step outside', 'lets go outside'])) return { kind: 'go_outside' };
  if (hasPhrase(normalized, ['wroc do pokoju', 'wracaj do srodka', 'wroc do srodka', 'come back inside', 'come inside', 'go back inside'])) return { kind: 'come_inside' };
  if (hasPhrase(normalized, ['chodz tutaj', 'chodz tu', 'podejdz do mnie', 'come here', 'come to me'])) return { kind: 'come_here' };
  if (hasPhrase(normalized, ['napij sie', 'napij', 'pij wode', 'have a drink', 'drink some water', 'drink'])) return { kind: 'drink', objectType: 'water_bowl' };
  if (hasPhrase(normalized, ['idz do toalety', 'skorzystaj z toalety', 'skorzystaj z kuwety', 'toaleta', 'do toalety', 'use the toilet', 'go to the toilet'])) return { kind: 'toilet', objectType: 'litter_box' };
  if (hasPhrase(normalized, ['umyj sie', 'mycie', 'umyj go', 'umyj ja', 'wash yourself', 'have a wash', 'wash'])) return { kind: 'wash', objectType: 'wash_basin' };
  if (hasPhrase(normalized, ['posprzataj', 'posprzataj pokoj', 'sprzatnij', 'clean the room', 'clean up'])) return { kind: 'clean' };

  if (objectType && hasPhrase(normalized, COMMAND_WORDS.offer)) return { kind: 'offer_object', objectType };
  if (hasPhrase(normalized, ['zjedz', 'zjedz to', 'eat', 'eat it'])) return { kind: 'use_object', objectType };
  if (objectType && (hasPhrase(normalized, COMMAND_WORDS.use) || hasPhrase(normalized, ['pobaw sie', 'play with']))) {
    return { kind: 'use_object', objectType };
  }
  return null;
}

export function createRoomObject(
  type: ObjectType,
  position: { x: number; y: number },
  now = Date.now(),
  offeredFromConversation = false,
): RoomObject {
  return {
    id: `${type}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    x: Math.max(10, Math.min(90, position.x)),
    y: Math.max(54, Math.min(76, position.y)),
    state: offeredFromConversation ? { offeredFromConversation: true } : {},
    interactions: 0,
    placedByUser: true,
    beingUsedByCreature: false,
  };
}

export function offerObjectFromInventory(
  state: GameState,
  type: ObjectType,
  position: { x: number; y: number },
  now = Date.now(),
): WorldActionExecution {
  const intent: WorldIntent = { kind: 'offer_object', objectType: type };
  if (!state.inventory.includes(type)) {
    return { state, result: { intent, status: 'unavailable', objectType: type } };
  }
  const object = createRoomObject(type, position, now, true);
  return {
    state: {
      ...state,
      inventory: state.inventory.filter(item => item !== type),
      roomObjects: [...state.roomObjects, object],
    },
    result: { intent, status: 'offered', objectType: type, objectId: object.id },
  };
}

export function resultFromObjectReaction(
  intent: WorldIntent,
  object: RoomObject,
  outcome: 'love' | 'enjoy' | 'curious' | 'neutral' | 'avoid',
  consumed: boolean,
): WorldActionResult {
  return {
    intent,
    objectType: object.type,
    objectId: object.id,
    consumed,
    status: consumed || outcome === 'love' || outcome === 'enjoy' ? 'success' : outcome === 'avoid' ? 'refused' : 'already_satisfied',
  };
}

/** The single state transition used after Room's notice/approach animation. */
export function applyWorldObjectReaction(
  state: GameState,
  objectId: string,
  reaction: ObjectReaction,
  target: { x: number; y: number },
  localizedActivity: string,
  initiatedByUser: boolean,
  now = Date.now(),
): GameState {
  const object = state.roomObjects.find(item => item.id === objectId);
  if (!object) return state;
  const type = object.type;
  const facing = target.x > state.position.x ? 'right' : target.x < state.position.x ? 'left' : state.facing;
  let next: GameState = applyNeedDelta({
    ...state,
    position: target,
    facing,
    creatureBehavior: reaction.behavior,
    currentActivity: localizedActivity,
  }, reaction.needDelta, now);

  if ((type === 'apple' || type === 'broccoli') && reaction.consumes) {
    next = feedCreature(next, type, now);
    next = {
      ...next,
      roomObjects: next.roomObjects.filter(item => item.id !== objectId),
      inventory: next.inventory.includes(type) ? next.inventory : [...next.inventory, type],
    };
  } else {
    if (type === 'water_bowl') next = reaction.id.includes('drink') ? drinkCreature(next, now) : smallSip(next, now);
    if (type === 'litter_box' && reaction.outcome !== 'avoid') next = useToilet(next, now).state;
    if (type === 'wash_basin' && reaction.id.includes('clean')) next = washCreature(next, now).state;
    next = {
      ...next,
      roomObjects: next.roomObjects.map(item => {
        if (item.id === objectId) {
          const movedX = reaction.moveObjectBy
            ? Math.max(10, Math.min(90, item.x + (item.x >= target.x ? reaction.moveObjectBy : -reaction.moveObjectBy)))
            : item.x;
          return {
            ...item,
            x: movedX,
            interactions: item.interactions + 1,
            beingUsedByCreature: true,
            state: { ...item.state, status: reaction.objectStatus },
          };
        }
        if (reaction.secondaryObjectType && item.type === reaction.secondaryObjectType) {
          return {
            ...item,
            interactions: item.interactions + 1,
            beingUsedByCreature: true,
            state: { ...item.state, status: reaction.secondaryStatus ?? 'used' },
          };
        }
        return item;
      }),
    };
  }

  next = updateDevelopment(next, reaction.developmentGain);
  if (type === 'apple' || type === 'broccoli') next = learnWord(next, type, 'food');
  const experienced = recordObjectExperience(next, type, reaction, initiatedByUser);
  const pathEvolved = evolveLifePathFromObject(experienced, type, reaction.outcome);
  const inward = evolveInnerLifeFromObject(pathEvolved, type, reaction.outcome);
  return evolveCreationFromObject(inward, type);
}

export function performImmediateWorldAction(
  state: GameState,
  intent: WorldIntent,
  now = Date.now(),
): WorldActionExecution {
  if (intent.kind === 'wake') {
    if (state.sleepState !== 'sleeping') return { state, result: { intent, status: 'already_satisfied' } };
    return { state: wakeUp(state, now), result: { intent, status: 'success' } };
  }

  if (intent.kind === 'sleep') {
    if (state.sleepState === 'sleeping') return { state, result: { intent, status: 'already_satisfied' } };
    const blocker = getSleepBlocker(state);
    if (blocker) return { state, result: { intent, status: 'blocked', reason: blocker } };
    const disposition = getCircadianDisposition(getTimeOfDay(now, state.world), state.needs.energy, false);
    if (disposition === 'active' && state.needs.energy > 72) {
      return { state, result: { intent, status: 'refused', reason: 'not_tired' } };
    }
    return { state: putToSleep(state, now), result: { intent, status: 'success' } };
  }

  if (intent.kind === 'toilet') {
    if (state.sleepState === 'sleeping') return { state, result: { intent, status: 'blocked', reason: 'sleeping' } };
    const action = useToilet(state, now);
    return {
      state: action.performed ? recordBondEvent(updateDevelopment(action.state, 0.22), 'care') : action.state,
      result: { intent, status: action.performed ? 'success' : 'already_satisfied', reason: action.result },
    };
  }

  if (intent.kind === 'wash') {
    if (state.sleepState === 'sleeping') return { state, result: { intent, status: 'blocked', reason: 'sleeping' } };
    const action = washCreature(state, now);
    return {
      state: action.performed ? recordBondEvent(updateDevelopment(action.state, 0.18), 'care') : action.state,
      result: { intent, status: action.performed ? 'success' : 'already_satisfied', reason: action.result },
    };
  }

  if (intent.kind === 'clean') {
    const action = cleanRoomMess(state, undefined, now);
    return {
      state: action.performed ? recordBondEvent(action.state, 'care') : action.state,
      result: { intent, status: action.performed ? 'success' : 'already_satisfied', reason: action.result },
    };
  }

  if (intent.kind === 'go_outside') {
    if (state.world.place === 'outdoors') return { state, result: { intent, status: 'already_satisfied' } };
    const blocked = outdoorVisitBlocked(state);
    if (blocked === 'unavailable') return { state, result: { intent, status: 'unavailable', reason: 'no_weather' } };
    if (blocked === 'sleeping' || blocked === 'need') return { state, result: { intent, status: 'blocked', reason: blocked } };
    if (blocked === 'wary') return { state, result: { intent, status: 'refused', reason: 'wary' } };
    const next = beginOutdoorVisit(state, now);
    return { state: next, result: { intent, status: 'success', reason: next.world.current?.condition } };
  }

  if (intent.kind === 'come_inside') {
    if (state.world.place !== 'outdoors') return { state, result: { intent, status: 'already_satisfied' } };
    return { state: endOutdoorVisit(state, now), result: { intent, status: 'success' } };
  }

  return { state, result: { intent, status: 'blocked' } };
}

export function beginComeHere(state: GameState, target: { x: number; y: number }): GameState {
  if (state.sleepState === 'sleeping') return state;
  const position = { x: Math.max(12, Math.min(88, target.x)), y: Math.max(48, Math.min(78, target.y)) };
  return {
    ...state,
    position,
    facing: position.x > state.position.x ? 'right' : position.x < state.position.x ? 'left' : state.facing,
    creatureBehavior: 'walking' as CreatureBehavior,
    currentActivity: null,
  };
}

const LABELS: Record<ObjectType, { pl: string; en: string }> = {
  food_bowl: { pl: 'miski', en: 'food bowl' }, water_bowl: { pl: 'wody', en: 'water' },
  litter_box: { pl: 'kuwety', en: 'litter box' }, wash_basin: { pl: 'miski do mycia', en: 'wash basin' },
  apple: { pl: 'jabłka', en: 'apple' }, broccoli: { pl: 'brokułu', en: 'broccoli' },
  ball: { pl: 'piłki', en: 'ball' }, blanket: { pl: 'koca', en: 'blanket' },
  paper: { pl: 'papieru', en: 'paper' }, pencil: { pl: 'ołówka', en: 'pencil' },
  box: { pl: 'pudełka', en: 'box' }, stone: { pl: 'kamienia', en: 'stone' }, mirror: { pl: 'lustra', en: 'mirror' },
};

export function groundedWorldReply(result: WorldActionResult, language: 'pl' | 'en'): string {
  const polish = language === 'pl';
  const label = result.objectType ? LABELS[result.objectType][language] : '';
  if (result.status === 'unavailable') {
    if (result.intent.kind === 'go_outside') return polish ? 'Stąd jeszcze nie ma wyjścia.' : 'There is no outside from here yet.';
    return polish ? `Nie widzę tu ${label}.` : `I cannot find the ${label} here.`;
  }
  if (result.status === 'refused') {
    if (result.reason === 'not_tired') return polish ? 'Nie chcę jeszcze spać. Mam za dużo energii.' : 'I do not want to sleep yet. I have too much energy.';
    if (result.reason === 'wary') return polish ? 'Nie przy tej pogodzie. Zostanę w środku.' : 'Not this weather. I will stay inside.';
    return polish ? `Nie chcę teraz ${label}. Zostawię to tutaj.` : `I do not want the ${label} now. I will leave it here.`;
  }
  if (result.status === 'blocked') {
    if (result.reason === 'sleeping') return polish ? 'Najpierw muszę się obudzić.' : 'I need to wake up first.';
    if (result.reason === 'need') return polish ? 'Najpierw potrzebuję czegoś w pokoju.' : 'I need something in the room first.';
    if (result.intent.kind === 'sleep') return polish ? 'Nie zasnę, dopóki moje ciało czegoś pilnie potrzebuje.' : 'I cannot settle while my body urgently needs something.';
    return polish ? 'Teraz nie mogę tego zrobić.' : 'I cannot do that right now.';
  }
  if (result.status === 'already_satisfied') {
    const replies: Partial<Record<WorldIntentKind, [string, string]>> = {
      wake: ['Już nie śpię.', 'I am already awake.'], sleep: ['Już śpię.', 'I am already asleep.'],
      toilet: ['Teraz nie potrzebuję toalety.', 'I do not need the toilet right now.'],
      wash: ['Jestem już czysty.', 'I am already clean.'], clean: ['Tu już jest czysto.', 'The room is already clean.'],
      drink: ['Nie chce mi się teraz pić.', 'I am not thirsty right now.'],
      go_outside: ['Już jestem na dworze.', 'I am already outside.'],
      come_inside: ['Już jestem w pokoju.', 'I am already inside.'],
    };
    const reply = replies[result.intent.kind] ?? ['Na razie zostawię to w spokoju.', 'I will leave it alone for now.'];
    return polish ? reply[0] : reply[1];
  }
  if (result.intent.kind === 'come_here') return polish ? 'Jestem bliżej.' : 'I am closer now.';
  if (result.intent.kind === 'go_outside') {
    const conditions: WeatherCondition[] = ['clear', 'partly_cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'snow', 'storm', 'unknown'];
    const condition = conditions.includes(result.reason as WeatherCondition) ? result.reason as WeatherCondition : 'unknown';
    const label = getWeatherConditionLabel(condition, language);
    return polish ? `Wyszedłem. Jest ${condition === 'clear' ? 'jasno' : label}.` : `I stepped outside. It is ${label}.`;
  }
  if (result.intent.kind === 'come_inside') return polish ? 'Wróciłem do pokoju.' : 'I am back in the room.';
  if (result.intent.kind === 'sleep') return polish ? 'Dobrze. Układam się.' : 'All right. I am settling down.';
  if (result.intent.kind === 'wake') return polish ? 'Już jestem.' : 'I am here.';
  if (result.intent.kind === 'drink') return polish ? 'Napiłem się. Tego potrzebowałem.' : 'I drank. I needed that.';
  if (result.intent.kind === 'toilet') return polish ? 'Gotowe. Jest mi lżej.' : 'Done. I feel better.';
  if (result.intent.kind === 'wash') return polish ? 'Już. Czuję się czyściej.' : 'Done. I feel cleaner.';
  if (result.intent.kind === 'clean') return polish ? 'Tu znowu jest przyjemnie.' : 'The room feels clear again.';
  if (result.consumed) return polish ? `Zjadłem trochę ${label}.` : `I ate the ${label}.`;
  return polish ? `Sprawdziłem ${label}.` : `I checked the ${label}.`;
}

export function applyConversationMicroReaction(state: GameState, text: string): {
  emotion: string;
  behavior: CreatureBehavior;
  object?: RoomObject;
} {
  const normalized = normalizeWorldText(text);
  const objectType = findMentionedObject(normalized);
  const object = objectType ? state.roomObjects.find(item => item.type === objectType) : undefined;
  if (/\b(nie|no|dont|do not|hate|boje|strach|scared)\b/.test(normalized)) {
    return { emotion: 'uncertain', behavior: object ? 'observing' : 'hesitating', object };
  }
  if (/\b(super|dobrze|fajnie|love|great|happy|ciesze)\b/.test(normalized)) {
    return { emotion: 'happy', behavior: object ? 'observing' : 'reacting', object };
  }
  return { emotion: object ? 'curious' : 'attentive', behavior: object ? 'observing' : 'reacting', object };
}

export function smallSip(state: GameState, now = Date.now()): GameState {
  return applyNeedDelta(state, { hydration: 4, bladder: -2 }, now);
}
