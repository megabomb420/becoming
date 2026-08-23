import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ObjectType, RoomObject, CreatureBehavior } from '../types';
import CreatureCanvas from './CreatureCanvas';
import ChatInterface from './ChatInterface';
import { touchCreature, feedCreature, putToSleep, wakeUp } from '../systems/needsSystem';
import { getDevelopmentDescription, getDevelopmentLabel, updateDevelopment, learnWord } from '../systems/developmentSystem';
import { generateCreatureSpeech, shouldSpeak } from '../systems/languageSystem';
import { shouldInitiateConversation, generateInitiatedTopic, clearInitiatedTopic } from '../systems/socialLearningSystem';
import {
  chooseObjectReaction,
  getBondDescription,
  getEmergingTraitLabels,
  recordBondEvent,
  recordObjectExperience,
} from '../systems/relationshipSystem';
import {
  ensureDailyMoment,
  evolveLifePathFromObject,
  getLifePathClues,
  getLifePathDescription,
  getLifePathTitle,
  getLifePathVisual,
  getRankedLifePaths,
  resolveDailyMoment,
} from '../systems/lifePathSystem';
import {
  evolveInnerLifeFromObject,
  getInterestStage,
  getRankedInterests,
} from '../systems/innerLifeSystem';
import { consumeReturnGreeting, getAbsenceSummary, getVisitRitual } from '../systems/presenceSystem';
import {
  emitSensoryCue,
  loadSensoryPreferences,
  saveSensoryPreferences,
  SensoryCue,
  SensoryPreferences,
} from '../systems/sensorySystem';
import { evolveCreationFromObject, getCreationMastery } from '../systems/creationSystem';
import { parseImportedGameState, serializeGameState } from '../systems/persistence';
import { uiLanguage, uiText } from '../systems/uiLanguage';
import { evaluateTouchBoundary } from '../systems/boundarySystem';

interface RoomProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onReset?: () => void;
  version?: string;
}

const objectEmojis: Record<ObjectType, string> = {
  food_bowl: '🥣',
  apple: '🍎',
  broccoli: '🥦',
  ball: '⚽',
  blanket: '🛏️',
  paper: '📄',
  pencil: '✏️',
  box: '📦',
  stone: '🪨',
  mirror: '🪞',
};

const objectLabels: Record<ObjectType, string> = {
  food_bowl: 'bowl',
  apple: 'apple',
  broccoli: 'broccoli',
  ball: 'ball',
  blanket: 'blanket',
  paper: 'paper',
  pencil: 'pencil',
  box: 'box',
  stone: 'stone',
  mirror: 'mirror',
};

const objectLabelsPl: Record<ObjectType, string> = {
  food_bowl: 'miska',
  apple: 'jabłko',
  broccoli: 'brokuł',
  ball: 'piłka',
  blanket: 'koc',
  paper: 'papier',
  pencil: 'ołówek',
  box: 'pudełko',
  stone: 'kamień',
  mirror: 'lustro',
};

function objectLabel(type: ObjectType, polish: boolean) {
  return polish ? objectLabelsPl[type] : objectLabels[type];
}

function reactionLabel(id: string, type: ObjectType, fallback: string, polish: boolean) {
  if (!polish) return fallback;
  if (id.includes('save')) return `wącha ${objectLabel(type, true)} i odkłada na później`;
  if (type === 'apple' || type === 'broccoli') return `siada i je: ${objectLabel(type, true)}`;
  if (type === 'ball') return id.includes('tired') ? 'patrzy, jak piłka się toczy' : 'rzuca się za piłką i rozpoczyna zabawę';
  if (type === 'blanket') return id.includes('not-now') ? 'dotyka koca, ale zostaje obok' : 'układa sobie małe gniazdo z koca';
  if (type === 'paper' || type === 'pencil') {
    if (id.includes('message')) return 'powoli pisze coś i zasłania łapką do samego końca';
    if (id.includes('picture')) return 'rysuje z pamięci i co chwilę rozgląda się po pokoju';
    if (id.includes('shape')) return 'łączy ślady w zamierzony kształt';
    return 'stawia krzywy ślad i długo mu się przygląda';
  }
  if (type === 'box') return id.includes('hide') ? 'znika w pudełku, zostawiając ogon na zewnątrz' : 'ostrożnie zagląda do pudełka';
  if (type === 'mirror') return id.includes('reflection') ? 'patrzy sobie w oczy i zostaje z tą myślą' : id.includes('recognized') || id.includes('recognition') ? 'dotyka własnej twarzy, potem odbicia' : 'przechyla głowę razem z odbiciem';
  if (type === 'stone') return id.includes('treasure') ? 'wybiera staranne miejsce dla ulubionego kamienia' : 'obraca kamień i sprawdza, co jest pod spodem';
  return 'sprawdza miskę';
}

const INVENTORY_ORDER: ObjectType[] = [
  'apple',
  'broccoli',
  'ball',
  'blanket',
  'paper',
  'pencil',
  'box',
  'stone',
  'mirror',
];

// Walkable area bounds (percentage of room)
const WALK_BOUNDS = { minX: 12, maxX: 88, minY: 48, maxY: 78 };

// Objects live on the same floor plane as the creature. Keeping both systems
// inside one coordinate space prevents the creature from walking below an
// object that was dropped on a wall or behind the controls.
const OBJECT_BOUNDS = { minX: 10, maxX: 90, minY: 54, maxY: 76 };

const AUTO_PLACE_SLOTS = [
  { x: 26, y: 62 },
  { x: 74, y: 62 },
  { x: 38, y: 71 },
  { x: 62, y: 71 },
  { x: 50, y: 61 },
  { x: 18, y: 72 },
  { x: 82, y: 72 },
];

// Idle positions the creature prefers when nothing else to do
const IDLE_POSITIONS = [
  { x: 30, y: 60 },
  { x: 50, y: 55 },
  { x: 70, y: 62 },
  { x: 40, y: 68 },
  { x: 60, y: 58 },
];

function clampToWalkable(pos: { x: number; y: number }) {
  return {
    x: Math.max(WALK_BOUNDS.minX, Math.min(WALK_BOUNDS.maxX, pos.x)),
    y: Math.max(WALK_BOUNDS.minY, Math.min(WALK_BOUNDS.maxY, pos.y)),
  };
}

function clampObjectPosition(pos: { x: number; y: number }) {
  return {
    x: Math.max(OBJECT_BOUNDS.minX, Math.min(OBJECT_BOUNDS.maxX, pos.x)),
    y: Math.max(OBJECT_BOUNDS.minY, Math.min(OBJECT_BOUNDS.maxY, pos.y)),
  };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getObjectEmoji(obj: RoomObject) {
  if (obj.type === 'paper' && obj.state.status === 'written') return '💌';
  if (obj.type === 'paper' && obj.state.status === 'drawn') return '🖼️';
  if (obj.type === 'paper' && obj.state.status === 'scribbled') return '📝';
  if (obj.type === 'paper' && obj.state.status === 'creased') return '📃';
  if (obj.type === 'box' && obj.state.status === 'opened') return '📭';
  return objectEmojis[obj.type];
}

interface DragSession {
  source: 'inventory' | 'room';
  type: ObjectType;
  objectId?: string;
  startX: number;
  startY: number;
  moved: boolean;
  pointerId: number;
}

type CueTone = 'notice' | 'movement' | 'reaction' | 'ambient';

interface CreatureCue {
  icon: string;
  label: string;
  tone: CueTone;
}

const Room: React.FC<RoomProps> = ({ state, onStateChange, onReset, version }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const [speech, setSpeech] = useState<string | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [showBecoming, setShowBecoming] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensoryPreferences, setSensoryPreferences] = useState<SensoryPreferences>(() => loadSensoryPreferences());
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [creatureEmotion, setCreatureEmotion] = useState(state.emotionalState);
  const [initiatedTopic, setInitiatedTopic] = useState<string | null>(null);
  const [creatureCue, setCreatureCue] = useState<CreatureCue | null>(null);
  const [momentResult, setMomentResult] = useState<string | null>(null);

  // Drag state
  const [draggingType, setDraggingType] = useState<ObjectType | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);

  // Creature movement
  const [creaturePos, setCreaturePos] = useState(state.position);
  const [isMoving, setIsMoving] = useState(false);

  // Refs for latest state in callbacks / intervals
  const stateRef = useRef(state);
  const creatureEmotionRef = useRef(creatureEmotion);
  const creaturePosRef = useRef(creaturePos);
  const behaviorRef = useRef<CreatureBehavior>(state.creatureBehavior);
  const targetPosRef = useRef(state.position);
  const behaviorTimerRef = useRef<ReturnType<typeof setInterval>>();
  const movementTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const ambientTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const cueTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const emotionTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const initiateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const activityTimerRef = useRef<ReturnType<typeof setInterval>>();
  const momentResultTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const activeObjectRef = useRef<string | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Keep refs in sync with latest state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { creatureEmotionRef.current = creatureEmotion; }, [creatureEmotion]);
  useEffect(() => { creaturePosRef.current = creaturePos; }, [creaturePos]);
  useEffect(() => { behaviorRef.current = state.creatureBehavior; }, [state.creatureBehavior]);
  useEffect(() => {
    if (!emotionTimerRef.current) setCreatureEmotion(state.emotionalState);
  }, [state.emotionalState]);

  useEffect(() => {
    const greeting = state.presence.pendingGreeting;
    if (!greeting || initiatedTopic || showChat || state.sleepState === 'sleeping') return;
    setInitiatedTopic(greeting);
    onStateChange(prev => consumeReturnGreeting(prev));
  }, [initiatedTopic, onStateChange, showChat, state.presence.pendingGreeting, state.sleepState]);

  const emitCue = useCallback((cue: SensoryCue) => {
    emitSensoryCue(cue, sensoryPreferences);
  }, [sensoryPreferences]);

  const updateSensoryPreference = useCallback((key: keyof SensoryPreferences, value: boolean) => {
    setSensoryPreferences(previous => {
      const next = { ...previous, [key]: value };
      saveSensoryPreferences(next);
      if (value) emitSensoryCue(key === 'sound' ? 'wake' : 'touch', next);
      return next;
    });
  }, []);

  const exportCreature = useCallback(() => {
    const json = serializeGameState(stateRef.current);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (stateRef.current.identity.name || 'creature').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'creature';
    link.href = url;
    link.download = `becoming-${safeName}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setBackupStatus(polish ? 'Backup zapisano na tym urządzeniu.' : 'Backup saved to this device.');
  }, [polish]);

  const importCreature = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error(polish ? 'Ten backup jest za duży.' : 'This backup is too large.');
      const imported = parseImportedGameState(await file.text());
      const name = imported.identity.name || (polish ? 'ten stworek' : 'this creature');
      if (!window.confirm(polish ? `Zastąpić obecnego stworka na tym urządzeniu stworkiem ${name}?` : `Replace the creature on this device with ${name}?`)) return;
      onStateChange(imported);
      setBackupStatus(polish ? `${name} już tu jest. Wczytane wspomnienia są aktywne.` : `${name} is here. The imported memories are now active.`);
      setShowSettings(false);
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : polish ? 'Nie udało się otworzyć backupu.' : 'The backup could not be opened.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }, [onStateChange, polish]);

  // One authored situation per creature-day gives the player something to
  // react to even when they do not know what to say in chat. The generator is
  // deterministic and idempotent, so StrictMode cannot duplicate a moment.
  useEffect(() => {
    if (!state.development.hatched || state.development.cognitiveLevel < 12) return;
    onStateChange(prev => ensureDailyMoment(prev));
  }, [onStateChange, state.development.hatched, state.development.cognitiveLevel, state.development.chronologicalAge]);

  const triggerSpeech = useCallback((text: string) => {
    setSpeech(text);
    clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = setTimeout(() => setSpeech(null), 4000);
  }, []);

  const setTemporaryEmotion = useCallback((emotion: string, duration = 2800) => {
    clearTimeout(emotionTimerRef.current);
    setCreatureEmotion(emotion);
    emotionTimerRef.current = setTimeout(() => {
      emotionTimerRef.current = undefined;
      setCreatureEmotion(stateRef.current.emotionalState);
    }, duration);
  }, []);

  const showCreatureCue = useCallback((cue: CreatureCue | null, duration?: number) => {
    clearTimeout(cueTimerRef.current);
    setCreatureCue(cue);
    if (cue && duration) {
      cueTimerRef.current = setTimeout(() => setCreatureCue(null), duration);
    }
  }, []);

  const clearActionTimers = useCallback(() => {
    clearTimeout(noticeTimerRef.current);
    clearTimeout(movementTimerRef.current);
    clearTimeout(reactionTimerRef.current);
    clearTimeout(ambientTimerRef.current);
    clearTimeout(cueTimerRef.current);
    setCreatureCue(null);
  }, []);

  const finishObjectInteraction = useCallback((
    objectId: string,
    type: ObjectType,
    target: { x: number; y: number },
    initiatedByUser: boolean,
  ) => {
    setIsMoving(false);

    const reaction = chooseObjectReaction(stateRef.current, type);
    const localizedReaction = reactionLabel(reaction.id, type, reaction.label, polish);
    const reactionDuration = reaction.duration;
    const reactionEmotion = reaction.emotion;
    const speechTrigger = type === 'ball' ? 'play' : type === 'apple' || type === 'broccoli' ? 'food' : type;

    onStateChange(prev => {
      const facing = target.x > prev.position.x ? 'right' : target.x < prev.position.x ? 'left' : prev.facing;
      let next: GameState = {
        ...prev,
        position: target,
        facing,
        creatureBehavior: reaction.behavior,
        currentActivity: localizedReaction,
        needs: {
          hunger: Math.max(0, Math.min(100, prev.needs.hunger + (reaction.needDelta.hunger ?? 0))),
          energy: Math.max(0, Math.min(100, prev.needs.energy + (reaction.needDelta.energy ?? 0))),
          comfort: Math.max(0, Math.min(100, prev.needs.comfort + (reaction.needDelta.comfort ?? 0))),
          stimulation: Math.max(0, Math.min(100, prev.needs.stimulation + (reaction.needDelta.stimulation ?? 0))),
          social: Math.max(0, Math.min(100, prev.needs.social + (reaction.needDelta.social ?? 0))),
        },
      };

      if ((type === 'apple' || type === 'broccoli') && reaction.consumes) {
        next = feedCreature(next, type);
        next = {
          ...next,
          roomObjects: next.roomObjects.filter(obj => obj.id !== objectId),
          inventory: next.inventory.includes(type) ? next.inventory : [...next.inventory, type],
        };
      } else {
        next = {
          ...next,
          roomObjects: next.roomObjects.map(obj => {
            if (obj.id === objectId) {
              const movedX = reaction.moveObjectBy
                ? clampObjectPosition({ x: obj.x + (obj.x >= target.x ? reaction.moveObjectBy : -reaction.moveObjectBy), y: obj.y }).x
                : obj.x;
              return {
                ...obj,
                x: movedX,
                interactions: obj.interactions + 1,
                beingUsedByCreature: true,
                state: { ...obj.state, status: reaction.objectStatus },
              };
            }
            if (reaction.secondaryObjectType && obj.type === reaction.secondaryObjectType) {
              return {
                ...obj,
                interactions: obj.interactions + 1,
                beingUsedByCreature: true,
                state: { ...obj.state, status: reaction.secondaryStatus ?? 'used' },
              };
            }
            return obj;
          }),
        };
      }

      next = updateDevelopment(next, reaction.developmentGain);
      if (type === 'apple' || type === 'broccoli') {
        next = learnWord(next, type, 'food');
      }
      const experienced = recordObjectExperience(next, type, reaction, initiatedByUser);
      const pathEvolved = evolveLifePathFromObject(experienced, type, reaction.outcome);
      const inward = evolveInnerLifeFromObject(pathEvolved, type, reaction.outcome);
      return evolveCreationFromObject(inward, type);
    });

    behaviorRef.current = reaction.behavior;
    showCreatureCue({ icon: reaction.icon, label: localizedReaction, tone: 'reaction' }, reactionDuration);
    setTemporaryEmotion(reactionEmotion, reactionDuration);
    const spoken = generateCreatureSpeech(stateRef.current, {
      trigger: speechTrigger,
      emotionalState: reactionEmotion,
      recentEvent: type,
    });
    if (spoken) triggerSpeech(spoken);

    reactionTimerRef.current = setTimeout(() => {
      activeObjectRef.current = null;
      behaviorRef.current = 'idle';
      showCreatureCue(null);
      onStateChange(prev => ({
        ...prev,
        creatureBehavior: 'idle',
        currentActivity: null,
        roomObjects: prev.roomObjects.map(obj => obj.beingUsedByCreature ? { ...obj, beingUsedByCreature: false } : obj),
      }));
    }, reactionDuration);
  }, [onStateChange, polish, setTemporaryEmotion, showCreatureCue, triggerSpeech]);

  const beginObjectInteraction = useCallback((object: RoomObject, initiatedByUser = true) => {
    const currentState = stateRef.current;
    if (currentState.sleepState === 'sleeping') return;

    clearActionTimers();
    activeObjectRef.current = object.id;
    setIsMoving(false);
    const currentPos = creaturePosRef.current;
    const nearSameX = Math.abs(object.x - currentPos.x) < 3;
    const approachOffset = nearSameX
      ? (object.x < 50 ? 11 : -11)
      : (object.x > currentPos.x ? -11 : 11);
    const target = clampToWalkable({ x: object.x + approachOffset, y: object.y });
    const travelDistance = dist(currentPos, target);
    const travelTime = Math.max(900, Math.min(2600, 650 + travelDistance * 28));
    const noticeDelay = Math.max(380, Math.min(850,
      420 + currentState.personality.caution * 4 - currentState.personality.curiosity * 2,
    ));

    behaviorRef.current = 'observing';
    setTemporaryEmotion('curious', noticeDelay + 900);
    showCreatureCue({ icon: '!', label: polish ? `zauważa: ${objectLabel(object.type, true)}` : `notices the ${objectLabel(object.type, false)}`, tone: 'notice' });
    onStateChange(prev => ({
      ...prev,
      facing: object.x > currentPos.x ? 'right' : object.x < currentPos.x ? 'left' : prev.facing,
      creatureBehavior: 'observing',
      currentActivity: polish ? `zauważa ${objectLabel(object.type, true)}` : `noticing the ${objectLabel(object.type, false)}`,
      roomObjects: prev.roomObjects.map(obj => ({
        ...obj,
        beingUsedByCreature: obj.id === object.id,
      })),
    }));

    noticeTimerRef.current = setTimeout(() => {
      if (activeObjectRef.current !== object.id) return;
      targetPosRef.current = target;
      behaviorRef.current = 'walking';
      setIsMoving(true);
      setCreaturePos(target);
      showCreatureCue({ icon: '→', label: polish ? `idzie do: ${objectLabel(object.type, true)}` : `goes to the ${objectLabel(object.type, false)}`, tone: 'movement' });
      onStateChange(prev => ({
        ...prev,
        facing: target.x > prev.position.x ? 'right' : target.x < prev.position.x ? 'left' : prev.facing,
        creatureBehavior: 'walking',
        currentActivity: polish ? `podchodzi do ${objectLabel(object.type, true)}` : `approaching the ${objectLabel(object.type, false)}`,
      }));

      movementTimerRef.current = setTimeout(() => {
        if (activeObjectRef.current === object.id) {
          finishObjectInteraction(object.id, object.type, target, initiatedByUser);
        }
      }, travelTime);
    }, noticeDelay);
  }, [clearActionTimers, finishObjectInteraction, onStateChange, polish, setTemporaryEmotion, showCreatureCue]);

  const walkToIdlePosition = useCallback((targetInput: { x: number; y: number }) => {
    if (activeObjectRef.current || stateRef.current.sleepState === 'sleeping') return;
    clearTimeout(movementTimerRef.current);
    const currentPos = creaturePosRef.current;
    const target = clampToWalkable(targetInput);
    const travelTime = Math.max(800, Math.min(2200, 600 + dist(currentPos, target) * 24));

    targetPosRef.current = target;
    behaviorRef.current = 'walking';
    setIsMoving(true);
    setCreaturePos(target);
    onStateChange(prev => ({
      ...prev,
      facing: target.x > prev.position.x ? 'right' : target.x < prev.position.x ? 'left' : prev.facing,
      creatureBehavior: 'walking',
      currentActivity: null,
    }));

    movementTimerRef.current = setTimeout(() => {
      setIsMoving(false);
      behaviorRef.current = 'idle';
      onStateChange(prev => ({ ...prev, position: target, creatureBehavior: 'idle', currentActivity: null }));
    }, travelTime);
  }, [onStateChange]);

  const startAmbientMoment = useCallback(() => {
    const currentState = stateRef.current;
    if (activeObjectRef.current || currentState.sleepState === 'sleeping' || behaviorRef.current !== 'idle') return;

    const moments: Array<CreatureCue & { behavior: CreatureBehavior; emotion: string; duration: number }> = [
      { icon: '·', label: 'listens to the room', tone: 'ambient', behavior: 'observing', emotion: 'curious', duration: 2200 },
      { icon: '✦', label: 'watches a speck of dust', tone: 'ambient', behavior: 'observing', emotion: 'curious', duration: 2600 },
      { icon: '~', label: 'stretches from nose to tail', tone: 'ambient', behavior: 'reacting', emotion: 'neutral', duration: 2100 },
      { icon: '·', label: 'sniffs the air', tone: 'ambient', behavior: 'investigating', emotion: 'curious', duration: 2300 },
    ];

    if (currentState.needs.energy < 45) {
      moments.push({ icon: '~', label: 'lets out a tiny yawn', tone: 'ambient', behavior: 'reacting', emotion: 'neutral', duration: 2500 });
    }
    if (currentState.needs.social < 55) {
      moments.push({ icon: '♡', label: 'looks around for you', tone: 'ambient', behavior: 'observing', emotion: 'curious', duration: 2700 });
    }
    if (currentState.bond.stage === 'close' || currentState.bond.stage === 'bonded') {
      moments.push({ icon: '♡', label: 'settles where it can see you', tone: 'ambient', behavior: 'reacting', emotion: 'happy', duration: 2800 });
    }

    const moment = moments[Math.floor(Math.random() * moments.length)];
    behaviorRef.current = moment.behavior;
    setTemporaryEmotion(moment.emotion, moment.duration);
    showCreatureCue(moment, moment.duration);
    onStateChange(prev => ({ ...prev, creatureBehavior: moment.behavior, currentActivity: moment.label }));

    ambientTimerRef.current = setTimeout(() => {
      if (activeObjectRef.current || behaviorRef.current !== moment.behavior) return;
      behaviorRef.current = 'idle';
      onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
    }, moment.duration);
  }, [onStateChange, setTemporaryEmotion, showCreatureCue]);

  // Intentional autonomous behaviour. The interval only chooses a new goal
  // while the creature is idle; user-selected objects always take priority.
  useEffect(() => {
    if (state.sleepState === 'sleeping') {
      clearActionTimers();
      clearTimeout(speechTimeoutRef.current);
      setSpeech(null);
      setInitiatedTopic(null);
      activeObjectRef.current = null;
      setIsMoving(false);
      behaviorRef.current = 'sleeping';
      onStateChange(prev => ({
        ...prev,
        creatureBehavior: 'sleeping',
        roomObjects: prev.roomObjects.map(obj => ({ ...obj, beingUsedByCreature: false })),
      }));
      return;
    }

    const chooseBehavior = () => {
      const currentState = stateRef.current;
      if (showChat || activeObjectRef.current || behaviorRef.current !== 'idle') return;

      const currentPos = creaturePosRef.current;
      const closestOfType = (types: ObjectType[]) => {
        const matches = currentState.roomObjects.filter(obj => {
          if (!types.includes(obj.type)) return false;
          const preference = currentState.objectPreferences[obj.type];
          const isRefusedFood = (obj.type === 'apple' || obj.type === 'broccoli')
            && preference.lastOutcome === 'avoid'
            && currentState.needs.hunger > 30;
          return !isRefusedFood;
        });
        if (matches.length === 0) return null;
        return matches.reduce((best, candidate) => {
          const bestScore = dist(currentPos, best) - currentState.objectPreferences[best.type].affinity * 0.12;
          const candidateScore = dist(currentPos, candidate) - currentState.objectPreferences[candidate.type].affinity * 0.12;
          return bestScore <= candidateScore ? best : candidate;
        });
      };

      let goal: RoomObject | null = null;
      if (currentState.needs.hunger < 60) goal = closestOfType(['apple', 'broccoli']);
      if (!goal && currentState.needs.energy < 32) goal = closestOfType(['blanket']);
      if (!goal && currentState.needs.stimulation < 48) goal = closestOfType(['ball']);

      if (!goal && currentState.roomObjects.length > 0) {
        const curiosityChance = 0.12 + currentState.personality.curiosity / 500;
        if (Math.random() < curiosityChance) {
          const unseen = currentState.roomObjects.filter(obj => currentState.objectPreferences[obj.type].interactions === 0);
          const familiar = [...currentState.roomObjects].sort((a, b) =>
            currentState.objectPreferences[b.type].affinity - currentState.objectPreferences[a.type].affinity,
          );
          const pool = unseen.length > 0 && Math.random() < 0.65 ? unseen : familiar.slice(0, Math.max(1, Math.ceil(familiar.length / 2)));
          goal = pool[Math.floor(Math.random() * pool.length)];
        }
      }

      if (goal) {
        beginObjectInteraction(goal, false);
        return;
      }

      const idleRoll = Math.random();
      if (idleRoll < 0.18) {
        const idleSpot = IDLE_POSITIONS[Math.floor(Math.random() * IDLE_POSITIONS.length)];
        walkToIdlePosition({
          x: idleSpot.x + (Math.random() - 0.5) * 6,
          y: idleSpot.y + (Math.random() - 0.5) * 4,
        });
      } else if (idleRoll < 0.5) {
        startAmbientMoment();
      }
    };

    const kickoff = setTimeout(chooseBehavior, 3500);
    behaviorTimerRef.current = setInterval(chooseBehavior, 7000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(behaviorTimerRef.current);
    };
  }, [beginObjectInteraction, clearActionTimers, onStateChange, showChat, startAmbientMoment, state.sleepState, walkToIdlePosition]);

  useEffect(() => () => {
    clearActionTimers();
    clearTimeout(emotionTimerRef.current);
    clearTimeout(speechTimeoutRef.current);
    clearTimeout(cueTimerRef.current);
    clearTimeout(momentResultTimerRef.current);
  }, [clearActionTimers]);

  // External state changes (load/offline simulation) can update the stored
  // position. Follow them only while no local movement is in progress.
  useEffect(() => {
    if (!isMoving && !activeObjectRef.current && dist(creaturePosRef.current, state.position) > 1) {
      setCreaturePos(state.position);
    }
  }, [isMoving, state.position]);

  // Periodic development
  useEffect(() => {
    activityTimerRef.current = setInterval(() => {
      onStateChange(prev => {
        const updated = updateDevelopment(prev, 0.5);
        return { ...updated, needs: { ...prev.needs } };
      });
    }, 30000);
    return () => clearInterval(activityTimerRef.current);
  }, [onStateChange]);

  // Random speech
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = stateRef.current;
      const currentEmotion = creatureEmotionRef.current;
      if (!showChat && !activeObjectRef.current && behaviorRef.current === 'idle' && shouldSpeak(currentState)) {
        const text = generateCreatureSpeech(currentState, { trigger: 'idle', emotionalState: currentEmotion });
        if (text) {
          setSpeech(text);
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = setTimeout(() => setSpeech(null), 4000);
        }
      }
    }, 8000 + Math.random() * 10000);
    return () => clearInterval(interval);
  }, [showChat]);

  // Creature-initiated conversation check
  useEffect(() => {
    if (state.sleepState === 'sleeping' || showChat || initiatedTopic) return;

    const checkInitiate = () => {
      const delay = 15000 + Math.random() * 20000;
      initiateTimerRef.current = setTimeout(() => {
        const currentState = stateRef.current;
        if (shouldInitiateConversation(currentState)) {
          const topic = generateInitiatedTopic(currentState);
          if (topic) {
            setInitiatedTopic(topic.openingLine);
            onStateChange(prev => clearInitiatedTopic(prev, topic.observationId));
            return;
          }
        }
        checkInitiate();
      }, delay);
    };
    checkInitiate();
    return () => clearTimeout(initiateTimerRef.current);
  }, [state.sleepState, showChat, initiatedTopic, onStateChange]);

  const handleTapCreature = useCallback(() => {
    emitCue('touch');
    onStateChange(prev => {
      const boundary = evaluateTouchBoundary(prev, 'tap');
      if (!boundary.accepted) {
        showCreatureCue({ icon: '·', label: boundary.label || t('needs a moment', 'potrzebuje chwili'), tone: 'notice' }, 2600);
        setTemporaryEmotion('uncertain', 2800);
        return boundary.state;
      }
      showCreatureCue({ icon: '?', label: t('notices your touch', 'zauważa twój dotyk'), tone: 'notice' }, 1600);
      const updated = recordBondEvent(touchCreature(boundary.state, 'tap'), 'tap');
      setTemporaryEmotion('curious', 2000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'curious' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t, triggerSpeech]);

  const handleStrokeCreature = useCallback(() => {
    emitCue('comfort');
    onStateChange(prev => {
      const boundary = evaluateTouchBoundary(prev, 'stroke');
      if (!boundary.accepted) {
        showCreatureCue({ icon: '·', label: boundary.label || t('needs a moment', 'potrzebuje chwili'), tone: 'notice' }, 2600);
        setTemporaryEmotion('uncertain', 2800);
        return boundary.state;
      }
      showCreatureCue({ icon: '♡', label: t('leans into your hand', 'przysuwa się do twojej dłoni'), tone: 'reaction' }, 2400);
      const updated = recordBondEvent(touchCreature(boundary.state, 'stroke'), 'stroke');
      setTemporaryEmotion('happy', 3000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'happy' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t, triggerSpeech]);

  const handleHoldStart = useCallback(() => {}, []);

  const handleHoldEnd = useCallback(() => {
    emitCue('comfort');
    onStateChange(prev => {
      const boundary = evaluateTouchBoundary(prev, 'hold');
      if (!boundary.accepted) {
        showCreatureCue({ icon: '·', label: boundary.label || t('not yet', 'jeszcze nie'), tone: 'notice' }, 2800);
        setTemporaryEmotion('uncertain', 3000);
        return boundary.state;
      }
      showCreatureCue({ icon: '♡', label: t('settles close', 'układa się blisko'), tone: 'reaction' }, 2600);
      const updated = recordBondEvent(touchCreature(boundary.state, 'hold'), 'hold');
      setTemporaryEmotion('happy', 3000);
      return updated;
    });
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t]);

  // ========== OBJECT INPUT ==========
  // A short press places/uses an object. A moved pointer repositions it. This
  // keeps the primary interaction reliable on phones without removing drag.
  const makeRoomObject = (type: ObjectType, position: { x: number; y: number }): RoomObject => ({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    ...clampObjectPosition(position),
    state: {},
    interactions: 0,
    placedByUser: true,
    beingUsedByCreature: false,
  });

  const placeInventoryObject = (type: ObjectType, position?: { x: number; y: number }) => {
    const currentState = stateRef.current;
    if (!currentState.inventory.includes(type)) return;

    let chosenPosition = position;
    if (!chosenPosition) {
      chosenPosition = AUTO_PLACE_SLOTS.reduce((best, candidate) => {
        const nearestAtBest = currentState.roomObjects.length === 0
          ? 100
          : Math.min(...currentState.roomObjects.map(obj => dist(best, obj)));
        const nearestAtCandidate = currentState.roomObjects.length === 0
          ? 100
          : Math.min(...currentState.roomObjects.map(obj => dist(candidate, obj)));
        return nearestAtCandidate > nearestAtBest ? candidate : best;
      }, AUTO_PLACE_SLOTS[0]);
    }

    const object = makeRoomObject(type, chosenPosition);
    onStateChange(prev => ({
      ...prev,
      roomObjects: [...prev.roomObjects, object],
      inventory: prev.inventory.filter(item => item !== type),
    }));
    setShowInventory(false);
    beginObjectInteraction(object);
  };

  const startPointerSession = (session: Omit<DragSession, 'startX' | 'startY' | 'moved' | 'pointerId'>, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    roomRef.current?.setPointerCapture(e.pointerId);
    dragSessionRef.current = {
      ...session,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
    };
    setDraggingType(session.type);
    setDraggingObjectId(session.objectId ?? null);
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const resetPointerSession = () => {
    dragSessionRef.current = null;
    setDraggingType(null);
    setDraggingObjectId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session) return;
    e.preventDefault();
    if (Math.hypot(e.clientX - session.startX, e.clientY - session.startY) > 8) {
      session.moved = true;
    }
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session) return;
    e.preventDefault();

    const rect = roomRef.current?.getBoundingClientRect();
    if (roomRef.current?.hasPointerCapture(session.pointerId)) {
      roomRef.current.releasePointerCapture(session.pointerId);
    }

    if (!rect) {
      resetPointerSession();
      return;
    }

    if (!session.moved) {
      if (session.source === 'inventory') {
        placeInventoryObject(session.type);
      } else if (session.objectId) {
        const object = stateRef.current.roomObjects.find(obj => obj.id === session.objectId);
        if (object) beginObjectInteraction(object);
      }
      resetPointerSession();
      return;
    }

    const position = clampObjectPosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });

    if (session.source === 'inventory') {
      placeInventoryObject(session.type, position);
    } else if (session.objectId) {
      const current = stateRef.current.roomObjects.find(obj => obj.id === session.objectId);
      if (current) {
        const movedObject = { ...current, ...position };
        onStateChange(prev => ({
          ...prev,
          roomObjects: prev.roomObjects.map(obj => obj.id === session.objectId ? movedObject : obj),
        }));
        beginObjectInteraction(movedObject);
      }
    }

    resetPointerSession();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const session = dragSessionRef.current;
    if (session && roomRef.current?.hasPointerCapture(session.pointerId)) {
      roomRef.current.releasePointerCapture(session.pointerId);
    }
    e.preventDefault();
    resetPointerSession();
  };

  const handleTidyRoom = () => {
    clearActionTimers();
    activeObjectRef.current = null;
    behaviorRef.current = state.sleepState === 'sleeping' ? 'sleeping' : 'idle';
    setIsMoving(false);
    setCreaturePos(state.position);
    onStateChange(prev => ({
      ...prev,
      roomObjects: [],
      inventory: [...INVENTORY_ORDER],
      creatureBehavior: prev.sleepState === 'sleeping' ? 'sleeping' : 'idle',
      currentActivity: prev.sleepState === 'sleeping' ? 'sleeping' : null,
    }));
    setShowInventory(false);
  };

  // ========== SLEEP ==========
  const handleSleepToggle = () => {
    emitCue(state.sleepState === 'sleeping' ? 'wake' : 'sleep');
    if (state.sleepState === 'sleeping') {
      onStateChange(prev => wakeUp(prev));
    } else {
      onStateChange(prev => putToSleep(prev));
    }
  };

  const handleOpenChatWithTopic = () => {
    emitCue('open');
    setShowChat(true);
    setInitiatedTopic(null);
  };

  const handleOpenChat = () => {
    emitCue('open');
    setShowChat(true);
  };

  const handleMomentChoice = (choiceId: string, result: string) => {
    emitCue('choice');
    onStateChange(prev => resolveDailyMoment(prev, choiceId));
    clearTimeout(momentResultTimerRef.current);
    setMomentResult(result);
    momentResultTimerRef.current = setTimeout(() => setMomentResult(null), 4500);
  };

  const ageDays = Math.floor(state.development.chronologicalAge / (24 * 60 * 60 * 1000));
  const developmentLabel = getDevelopmentLabel(state.development.stage);
  const emergingTraits = getEmergingTraitLabels(state.personality);
  const lifePathTitle = getLifePathTitle(state);
  const lifePathDescription = getLifePathDescription(state);
  const lifePathClues = getLifePathClues(state);
  const rankedLifePaths = getRankedLifePaths(state);
  const pathVisual = getLifePathVisual(state);
  const rankedInterests = getRankedInterests(state, 4);
  const latestDream = state.innerLife.dreams[state.innerLife.dreams.length - 1];
  const confidentOpinions = [...state.innerLife.opinions]
    .filter(opinion => opinion.confidence >= 28)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  const activeConversationLoops = [...state.continuity.openLoops]
    .filter(loop => !loop.resolvedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);
  const recentChapters = [...state.continuity.chapters].reverse().slice(0, 3);
  const recentCreations = [...state.creations].reverse().slice(0, 4);
  const recentAbsences = [...state.presence.absenceEpisodes].reverse().slice(0, 3);
  const visitRitual = getVisitRitual(state);
  const discoveredPreferences = INVENTORY_ORDER
    .map(type => ({ type, preference: state.objectPreferences[type] }))
    .filter(({ preference }) => preference.interactions >= 2 && (preference.affinity >= 12 || preference.affinity <= -8))
    .sort((a, b) => Math.abs(b.preference.affinity) - Math.abs(a.preference.affinity))
    .slice(0, 3);

  return (
    <div
      ref={roomRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: draggingType ? 'none' : 'pan-y' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Room background */}
      <div className={`absolute inset-0 transition-all duration-1000 ${state.sleepState === 'sleeping' ? 'brightness-50' : 'brightness-100'}`}>
        <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-room-mid" />
        <div className="absolute top-0 left-0 right-0 h-[65%]" style={{ background: 'linear-gradient(180deg, #1e1b16 0%, #1a1814 100%)' }} />
        <div className="absolute top-[20%] left-[50%] w-[300px] h-[300px] -translate-x-1/2 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(200,170,120,0.3) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 transition-colors duration-[1800ms]" style={{ background: pathVisual.roomTint }} />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />

      {/* Sleep zzz */}
      {state.sleepState === 'sleeping' && state.development.stage !== 'egg' && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 animate-float z-30">
          <span className="text-warm-200/40 text-sm font-serif">z z z</span>
        </div>
      )}

      {/* Room objects (only placed ones) */}
      {state.roomObjects.map(obj => (
        <button
          type="button"
          key={obj.id}
          aria-label={polish ? `Użyj: ${objectLabel(obj.type, true)}` : `Use ${objectLabel(obj.type, false)}`}
          title={objectLabel(obj.type, polish)}
          className={`absolute z-20 select-none transition-all p-2 -m-2 bg-transparent border-0 ${
            obj.beingUsedByCreature ? 'scale-110 drop-shadow-[0_0_10px_rgba(220,195,150,0.45)]' : 'hover:scale-110'
          }`}
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            cursor: 'grab',
            touchAction: 'none',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            opacity: draggingObjectId === obj.id ? 0.25 : 1,
          }}
          onPointerDown={(e) => startPointerSession({ source: 'room', type: obj.type, objectId: obj.id }, e)}
          onClick={(e) => {
            if (e.detail === 0) beginObjectInteraction(obj);
          }}
        >
          {getObjectEmoji(obj)}
        </button>
      ))}

      {/* Dragging ghost (inventory or moved object) */}
      {draggingType && (
        <div
          className="absolute select-none scale-125 z-50 pointer-events-none"
          style={{
            left: `${dragPos.x}px`,
            top: `${dragPos.y}px`,
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
            opacity: 0.9,
          }}
        >
          {objectEmojis[draggingType]}
        </div>
      )}

      {/* Creature */}
      <CreatureCanvas
        state={{
          ...state,
          emotionalState: creatureEmotion,
          position: creaturePos,
          facing: creaturePos.x > state.position.x ? 'right' : creaturePos.x < state.position.x ? 'left' : state.facing,
        }}
        onTap={handleTapCreature}
        onStroke={handleStrokeCreature}
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
      />

      {/* Intent is shown close to the creature, so every action reads as a
          small decision instead of a system status message. */}
      {creatureCue && state.sleepState !== 'sleeping' && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full transition-all duration-300"
          style={{ left: `${Math.max(28, Math.min(72, creaturePos.x))}%`, top: `${Math.max(24, creaturePos.y - 10)}%` }}
          aria-live="polite"
        >
          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-lg backdrop-blur-md animate-cue-pop ${
            creatureCue.tone === 'reaction'
              ? 'bg-warm-100/90 border-warm-50/50 text-room-dark'
              : creatureCue.tone === 'notice'
                ? 'bg-room-light/90 border-warm-300/35 text-warm-100'
                : 'bg-room-mid/85 border-warm-200/15 text-warm-200/80'
          }`}>
            <span className="text-[11px] leading-none" aria-hidden="true">{creatureCue.icon}</span>
            <span className="text-[10px] font-serif italic whitespace-nowrap">{creatureCue.label}</span>
          </div>
        </div>
      )}

      {/* A quiet action caption makes cause and effect readable without
          exposing the creature's hidden numerical needs. */}
      {state.currentActivity && !creatureCue && state.sleepState !== 'sleeping' && (
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 z-30 pointer-events-none" aria-live="polite">
          <p className="text-warm-200/45 text-[11px] font-serif italic tracking-wide whitespace-nowrap animate-fade-in">
            {polish ? `${state.identity.name || 'Stworek'} ${state.currentActivity}` : `${state.identity.name || 'The creature'} is ${state.currentActivity}`}
          </p>
        </div>
      )}

      {/* Speech bubble */}
      {speech && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full animate-fade-in z-40 pointer-events-none transition-all duration-300"
          style={{ left: `${Math.max(30, Math.min(70, creaturePos.x))}%`, top: `${Math.max(18, creaturePos.y - 19)}%` }}
        >
          <div className="relative bg-warm-100/90 text-room-dark px-4 py-2 rounded-2xl text-sm font-serif shadow-lg backdrop-blur-sm max-w-[200px] text-center">
            {speech}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-warm-100/90 rotate-45" />
          </div>
        </div>
      )}

      {/* Creature-initiated chat prompt */}
      {initiatedTopic && !showChat && (
        <div
          className="absolute top-[38%] left-1/2 -translate-x-1/2 z-40 animate-fade-in cursor-pointer"
          onClick={handleOpenChatWithTopic}
        >
          <div className="relative bg-room-mid/80 backdrop-blur-sm border border-warm-300/20 px-4 py-2 rounded-2xl shadow-lg">
            <p className="text-warm-200 text-xs font-serif italic">{initiatedTopic}</p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-room-mid/80 border-r border-b border-warm-300/20 rotate-45" />
          </div>
          <div className="flex justify-center mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-warm-300/60 animate-pulse" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 safe-top px-4 py-3 flex justify-between items-start z-30">
        <button onClick={() => setShowBecoming(true)} className="text-left group min-h-11 -my-2 py-2">
          <div className="text-warm-200/60 text-xs font-serif tracking-wider group-hover:text-warm-100 transition-colors">
            {state.identity.name || 'New'} · {developmentLabel}
          </div>
          <div className="text-[9px] font-serif uppercase tracking-[0.16em] mt-0.5 transition-colors" style={{ color: pathVisual.accent }}>
            {lifePathTitle}
          </div>
        </button>
        <div className="flex gap-1 items-start">
          <button onClick={() => { emitCue('open'); setShowMemoryBook(true); }} className="min-h-11 -my-2 px-2 py-2 text-warm-200/60 hover:text-warm-100 text-xs font-serif tracking-wider transition-colors">
            {t('Memories', 'Wspomnienia')}
          </button>
          <button aria-label={t('Settings', 'Ustawienia')} title={t('Settings', 'Ustawienia')} onClick={() => { emitCue('open'); setShowSettings(true); }} className="min-h-11 -my-2 px-2 py-2 text-warm-200/35 hover:text-warm-100 text-sm leading-none transition-colors">
            •••
          </button>
        </div>
      </div>

      {/* Daily moments are small dilemmas, not quests. Their choice changes
          the creature's path and becomes a remembered event. */}
      {state.lifePath.pendingMoment && !showChat && !showMemoryBook && !showBecoming && state.sleepState !== 'sleeping' && (
        <div className="absolute left-4 right-4 bottom-24 z-40 animate-slide-up">
          <div className="max-w-md mx-auto rounded-2xl border border-warm-300/20 bg-room-dark/94 backdrop-blur-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/55">{t('A moment', 'Chwila')} · {t('Day', 'Dzień')} {state.lifePath.pendingMoment.day}</p>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: pathVisual.accent }} />
            </div>
            <h2 className="text-warm-100 text-base font-serif mt-1">{state.lifePath.pendingMoment.title}</h2>
            <p className="text-warm-200/65 text-xs leading-relaxed font-serif mt-1.5">{state.lifePath.pendingMoment.prompt}</p>
            <div className="grid gap-2 mt-3">
              {state.lifePath.pendingMoment.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleMomentChoice(choice.id, choice.result)}
                  className="rounded-xl border border-warm-200/10 bg-room-mid/70 px-3 py-2 text-left text-xs font-serif text-warm-100 hover:border-warm-300/30 active:scale-[0.99] transition-all"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {momentResult && !showChat && !showMemoryBook && !showBecoming && (
        <div className="absolute left-5 right-5 bottom-24 z-40 pointer-events-none animate-cue-pop">
          <div className="max-w-sm mx-auto rounded-2xl border border-warm-300/20 bg-room-mid/94 backdrop-blur-xl px-4 py-3 text-center shadow-2xl">
            <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/45">{t('This became a memory', 'To stało się wspomnieniem')}</p>
            <p className="text-warm-100/85 text-xs font-serif leading-relaxed mt-1">{momentResult}</p>
          </div>
        </div>
      )}

      {/* Conversation is the primary way this creature grows. */}
      {state.conversation.totalUserMessages === 0 && !showInventory && state.sleepState !== 'sleeping' && (
        <button
          onClick={handleOpenChat}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 rounded-full bg-warm-100/90 text-room-dark px-4 py-2 text-xs font-serif shadow-xl animate-cue-pop"
        >
          {polish ? `Porozmawiaj z ${state.identity.name || 'stworkiem'}` : `Talk to ${state.identity.name || 'the creature'}`}
        </button>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 safe-bottom px-4 py-4 flex justify-center items-end gap-3 z-30">
        <button aria-label={state.sleepState === 'sleeping' ? t('Wake creature', 'Obudź stworka') : t('Put creature to sleep', 'Połóż stworka spać')} title={state.sleepState === 'sleeping' ? t('Wake creature', 'Obudź stworka') : t('Sleep', 'Sen')} onClick={handleSleepToggle} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          {state.sleepState === 'sleeping' ? '☀️' : '🌙'}
        </button>
        <button aria-label={t('Talk to creature', 'Porozmawiaj ze stworkiem')} title={t('Talk', 'Rozmowa')} onClick={handleOpenChat} className="w-[4.5rem] h-14 rounded-2xl bg-warm-100/90 text-room-dark backdrop-blur-sm border border-warm-50/30 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform">
          <span className="text-lg leading-none" aria-hidden="true">💬</span>
          <span className="text-[10px] font-serif mt-0.5">{t('Talk', 'Rozmowa')}</span>
        </button>
        <button aria-label={t('Open things', 'Otwórz rzeczy')} title={t('Things', 'Rzeczy')} aria-expanded={showInventory} onClick={() => setShowInventory(!showInventory)} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          📦
        </button>
      </div>

      {/* Inventory tray */}
      {showInventory && (
        <div className="absolute bottom-20 left-4 right-4 bg-room-mid/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-40 animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-warm-100/75 text-xs font-serif">{t('Things', 'Rzeczy')}</p>
              <p className="text-warm-200/40 text-[10px] font-serif">{t('Tap to place · drag to choose a spot', 'Dotknij, aby położyć · przeciągnij, aby wybrać miejsce')}</p>
            </div>
            {state.roomObjects.length > 0 && (
              <button onClick={handleTidyRoom} className="text-warm-200/45 hover:text-warm-100 text-[10px] font-serif border border-warm-200/10 rounded-lg px-2.5 py-1.5">
                {t('Tidy room', 'Posprzątaj')}
              </button>
            )}
          </div>
          {state.inventory.length === 0 ? (
            <p className="text-warm-200/30 text-xs text-center font-serif italic py-2">{t('Everything is in the room', 'Wszystko jest już w pokoju')}</p>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center">
              {[...state.inventory]
                .sort((a, b) => INVENTORY_ORDER.indexOf(a) - INVENTORY_ORDER.indexOf(b))
                .map(type => (
                <button
                  type="button"
                  key={type}
                  aria-label={polish ? `Połóż: ${objectLabel(type, true)}` : `Place ${objectLabel(type, false)}`}
                  title={objectLabel(type, polish)}
                  className="w-12 h-12 rounded-xl bg-room-dark/25 border border-warm-200/5 text-3xl cursor-grab active:scale-110 transition-transform select-none flex items-center justify-center"
                  style={{ touchAction: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
                  onPointerDown={(e) => startPointerSession({ source: 'inventory', type }, e)}
                  onClick={(e) => {
                    if (e.detail === 0) placeInventoryObject(type);
                  }}
                >
                  {objectEmojis[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Memory Book Overlay */}
      {showMemoryBook && (
        <div className="absolute inset-0 bg-room-dark/95 backdrop-blur-md z-50 animate-fade-in safe-top safe-bottom safe-x overflow-auto">
          <div className="max-w-md mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-warm-100 text-xl font-serif">{t('Memory Book', 'Księga wspomnień')}</h2>
              <button onClick={() => setShowMemoryBook(false)} className="min-h-11 -my-2 px-2 py-2 text-warm-200/60 hover:text-warm-100 text-sm">{t('Close', 'Zamknij')}</button>
            </div>
            <div className="space-y-4">
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">{t('Day 1', 'Dzień 1')}</div>
                <div className="text-warm-100 text-sm font-serif">{t('Arrived.', 'Pojawił się.')}</div>
              </div>
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">{t('Growing mind', 'Rosnący umysł')}</div>
                <div className="text-warm-100 text-sm font-serif">{developmentLabel}</div>
                <p className="text-warm-200/55 text-xs font-serif italic mt-1.5">
                  {getDevelopmentDescription(state.development.stage)}
                </p>
                <p className="text-warm-200/35 text-[10px] font-serif mt-2">
                  {polish ? `Zapamiętane rozmowy: ${state.conversation.totalUserMessages}` : `${state.conversation.totalUserMessages} conversation${state.conversation.totalUserMessages === 1 ? '' : 's'} remembered`}
                  {ageDays > 0 ? ` · ${t('Day', 'Dzień')} ${ageDays}` : ''}
                </p>
                {state.conversation.facts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[...state.conversation.facts]
                      .sort((a, b) => b.confidence - a.confidence)
                      .slice(0, 4)
                      .map(fact => (
                        <span key={fact.id} className="rounded-full bg-room-mid/70 border border-warm-200/10 px-2 py-1 text-[10px] text-warm-200/70">
                          {fact.kind === 'name' ? 'you' : fact.kind}: {fact.value}
                        </span>
                      ))}
                  </div>
                )}
                {state.socialLearning.imitated.length > 0 && (
                  <p className="text-warm-200/45 text-[10px] font-serif mt-2">
                    {t('Learning from you', 'Uczy się od ciebie')}: {state.socialLearning.imitated.slice(-3).map(habit => `${habit.action} ${habit.target}`).join(', ')}
                  </p>
                )}
              </div>
              {(rankedInterests.length > 0 || latestDream || confidentOpinions.length > 0 || state.innerLife.selfAwareness.stage !== 'unaware') && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">{t('Inner life', 'Życie wewnętrzne')}</div>
                  {rankedInterests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rankedInterests.map(interest => (
                        <span key={interest.type} className="rounded-full bg-room-mid/70 border border-warm-200/10 px-2 py-1 text-[10px] text-warm-200/70 capitalize">
                          {interest.label} · {getInterestStage(interest.level)}
                        </span>
                      ))}
                    </div>
                  )}
                  {latestDream && (
                    <div className="mt-3 rounded-xl bg-room-dark/25 border border-warm-200/5 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-warm-300/40">{t('Last dream', 'Ostatni sen')} · {latestDream.mood}</p>
                      <p className="text-warm-100/70 text-xs font-serif italic mt-1">{latestDream.fragment}</p>
                    </div>
                  )}
                  {confidentOpinions.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      {confidentOpinions.map(opinion => (
                        <p key={opinion.topic} className="text-warm-200/55 text-[10px] font-serif">
                          <span className="capitalize text-warm-100/70">{opinion.topic}</span> — {opinion.stance >= 0.25 ? 'drawn to it' : opinion.stance <= -0.25 ? 'pushes against it' : 'still divided'}
                        </p>
                      ))}
                    </div>
                  )}
                  {state.innerLife.privateThoughts.some(thought => !thought.revealedAt) && (
                    <p className="text-warm-300/35 text-[9px] font-serif mt-3">{t('Some thoughts are still private. Trust may uncover them.', 'Niektóre myśli nadal są prywatne. Zaufanie może je odsłonić.')}</p>
                  )}
                  {state.innerLife.selfAwareness.stage !== 'unaware' && (
                    <div className="mt-3 pt-3 border-t border-warm-200/5">
                      <p className="text-[9px] uppercase tracking-widest text-warm-300/40">Mirror · {state.innerLife.selfAwareness.stage}</p>
                      {state.innerLife.selfAwareness.lastReflection && (
                        <p className="text-warm-100/60 text-[10px] font-serif italic mt-1">“{state.innerLife.selfAwareness.lastReflection}”</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeConversationLoops.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">{t('Things left open', 'Niedokończone tematy')}</div>
                  <div className="space-y-1.5 mt-2">
                    {activeConversationLoops.map(loop => (
                      <div key={loop.id} className="flex items-start gap-2 text-[10px] font-serif">
                        <span className="text-warm-300/35 mt-0.5">○</span>
                        <span className="text-warm-100/65"><span className="uppercase tracking-wider text-warm-200/35">{loop.kind}</span> · {loop.subject}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {recentChapters.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-2">{t('Our chapters', 'Nasze rozdziały')}</div>
                  <div className="space-y-3">
                    {recentChapters.map(chapter => (
                      <div key={chapter.id}>
                        <div className="text-warm-100/75 text-xs font-serif">{chapter.title}</div>
                        <p className="text-warm-200/45 text-[10px] font-serif leading-relaxed mt-0.5">{chapter.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {recentCreations.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-2">{t('Things made', 'Rzeczy stworzone')}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {recentCreations.map(creation => (
                      <div key={creation.id} className="rounded-xl border border-warm-200/10 bg-room-mid/35 p-3 min-h-[112px] flex flex-col">
                        <div className="text-2xl text-warm-100/80 font-serif leading-none whitespace-pre-wrap">{creation.glyph}</div>
                        <div className="text-warm-100/75 text-[11px] font-serif mt-2">{creation.title}</div>
                        <p className="text-warm-200/40 text-[9px] font-serif leading-relaxed mt-1">{creation.description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-warm-200/30 text-[9px] font-serif mt-2 capitalize">Paper & pencil · {getCreationMastery(state)}</p>
                </div>
              )}
              {(visitRitual || state.presence.sessionCount > 1) && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">{t('Our rhythm', 'Nasz rytm')}</div>
                  {visitRitual && <div className="text-warm-100/70 text-xs font-serif">{visitRitual}</div>}
                  <p className="text-warm-200/40 text-[10px] font-serif mt-1">
                    {state.presence.currentStreak > 1 ? `${state.presence.currentStreak} days finding each other again` : `${state.presence.returnCount} remembered return${state.presence.returnCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              )}
              {recentAbsences.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-2">{t('While you were away', 'Kiedy cię nie było')}</div>
                  <div className="space-y-2.5">
                    {recentAbsences.map(episode => {
                      const totalMinutes = Math.max(1, Math.round(episode.durationMs / 60_000));
                      const duration = totalMinutes >= 120
                        ? `${Math.round(totalMinutes / 60)} ${t('hours', 'godz.')}`
                        : `${totalMinutes} min`;
                      return (
                        <div key={episode.id} className="rounded-xl border border-warm-200/5 bg-room-mid/30 p-3">
                          <p className="text-warm-100/65 text-[10px] font-serif leading-relaxed">{getAbsenceSummary(state, episode)}</p>
                          <p className="text-warm-200/25 text-[9px] font-serif mt-1.5">{duration} · {new Date(episode.returnedAt).toLocaleDateString(ui === 'pl' ? 'pl-PL' : 'en-GB')}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">{t('Becoming', 'Stawanie się')}</div>
                <div className="text-warm-100 text-sm font-serif capitalize">
                  {emergingTraits.join(' · ')}
                </div>
                <p className="text-warm-200/55 text-xs font-serif italic mt-1.5">
                  {getBondDescription(state.bond.stage, state.identity.name)}
                </p>
                {discoveredPreferences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {discoveredPreferences.map(({ type, preference }) => (
                      <span key={type} className="rounded-full bg-room-mid/70 border border-warm-200/10 px-2 py-1 text-[10px] text-warm-200/70">
                        {objectEmojis[type]} {preference.affinity >= 12 ? 'favorite' : 'unsure'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {state.vocabulary.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">
                    Day {Math.max(1, Math.floor(state.development.chronologicalAge / (24 * 60 * 60 * 1000)))}
                  </div>
                  <div className="text-warm-100 text-sm font-serif">
                    Knows {state.vocabulary.length} word{state.vocabulary.length > 1 ? 's' : ''}: {state.vocabulary.map(v => v.word).join(', ')}
                  </div>
                </div>
              )}
              {state.socialLearning.observations.filter(o => o.exposureCount >= 2).length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">{t('Observed', 'Zaobserwowane')}</div>
                  <div className="text-warm-100 text-sm font-serif">
                    {state.socialLearning.observations
                      .filter(o => o.exposureCount >= 2)
                      .slice(0, 5)
                      .map(o => `${o.action} ${o.target}`)
                      .join(', ')}
                  </div>
                </div>
              )}
              {state.memories.filter(m => m.importance >= 6 && !m.tags.includes('dream')).slice(-10).map(mem => (
                <div key={mem.id} className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">
                    Day {Math.max(1, Math.floor((mem.timestamp - state.identity.birthTimestamp) / (24 * 60 * 60 * 1000)) + 1)}
                  </div>
                  <div className="text-warm-100 text-sm font-serif capitalize">{mem.content}</div>
                </div>
              ))}
            </div>
            {version && (
              <div className="mt-8 pt-4 border-t border-warm-200/10 text-center">
                <p className="text-warm-200/20 text-[10px] font-serif">Becoming v{version}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Becoming Overlay */}
      {showBecoming && (
        <div className="absolute inset-0 bg-room-dark/97 backdrop-blur-xl z-50 animate-fade-in safe-top safe-bottom safe-x overflow-auto">
          <div className="max-w-md mx-auto p-6">
            <div className="flex justify-between items-start gap-4 mb-7">
              <div>
                <p className="text-warm-300/45 text-[9px] uppercase tracking-[0.22em]">{t('What I am becoming', 'Kim się staję')}</p>
                <h2 className="text-warm-100 text-2xl font-serif mt-1">{lifePathTitle}</h2>
                <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: pathVisual.accent }}>{state.lifePath.phase}</p>
                <p className="text-warm-200/30 text-[9px] font-serif mt-1">
                  Skin · {state.lifePath.phase === 'embodied' ? 'full form' : state.lifePath.secondary ? 'hybrid signs' : state.lifePath.phase === 'committed' ? 'settling in' : state.lifePath.phase === 'recovering' ? 'changing again' : 'first signs'}
                </p>
              </div>
              <button onClick={() => setShowBecoming(false)} className="min-h-11 -my-2 px-2 py-2 text-warm-200/60 hover:text-warm-100 text-sm">{t('Close', 'Zamknij')}</button>
            </div>

            <div className="rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4 shadow-xl" style={{ boxShadow: `0 18px 70px ${pathVisual.aura}` }}>
              <p className="text-warm-100/85 text-sm font-serif leading-relaxed">{lifePathDescription}</p>
              {state.lifePath.recovery >= 18 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[9px] uppercase tracking-widest text-warm-200/35"><span>breaking old patterns</span><span>{Math.round(state.lifePath.recovery)}%</span></div>
                  <div className="h-1 bg-room-dark/60 rounded-full mt-1 overflow-hidden"><div className="h-full bg-warm-300/55" style={{ width: `${state.lifePath.recovery}%` }} /></div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">{t('Visible tendencies', 'Widoczne skłonności')}</h3>
              <div className="space-y-2 mt-3">
                {lifePathClues.length > 0 ? lifePathClues.map(clue => (
                  <div key={clue} className="border-l border-warm-300/30 pl-3 text-warm-100/75 text-xs font-serif leading-relaxed">{clue}</div>
                )) : <p className="text-warm-200/35 text-xs font-serif italic">{t('Still too young to have hardened into a type.', 'Jeszcze za młody, by ukształtować się w konkretny typ.')}</p>}
              </div>
            </div>

            {(rankedInterests.length > 0 || state.innerLife.selfAwareness.stage !== 'unaware' || state.creations.length > 0 || state.touchBoundaries.boundariesShown > 0) && (
              <div className="mt-6">
                <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">{t('Inner weather', 'Wewnętrzna pogoda')}</h3>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {rankedInterests.map(interest => (
                    <div key={interest.type} className="rounded-xl border border-warm-200/10 bg-room-mid/35 px-3 py-2">
                      <div className="text-warm-100/75 text-xs font-serif capitalize">{interest.label}</div>
                      <div className="text-warm-200/35 text-[9px] uppercase tracking-widest mt-0.5">{getInterestStage(interest.level)}</div>
                    </div>
                  ))}
                </div>
                {latestDream && <p className="text-warm-200/45 text-[10px] font-serif italic mt-3">Dreaming lately: “{latestDream.title}”</p>}
                {state.innerLife.selfAwareness.stage !== 'unaware' && (
                  <p className="text-warm-200/45 text-[10px] font-serif italic mt-1 capitalize">Mirror self · {state.innerLife.selfAwareness.stage}</p>
                )}
                {state.creations.length > 0 && (
                  <p className="text-warm-200/45 text-[10px] font-serif italic mt-1 capitalize">Making · {getCreationMastery(state)}</p>
                )}
                {state.touchBoundaries.boundariesShown > 0 && (
                  <p className="text-warm-200/45 text-[10px] font-serif italic mt-1">
                    {t('Boundaries · asks for space when touch becomes too much', 'Granice · prosi o przestrzeń, gdy dotyku jest za dużo')}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">{t('Pull of possible lives', 'Przyciąganie możliwych żyć')}</h3>
              <div className="space-y-2.5 mt-3">
                {rankedLifePaths.map(path => (
                  <div key={path.id}>
                    <div className="flex justify-between text-[10px] font-serif text-warm-200/55"><span>{path.label}</span><span>{Math.round(path.score)}</span></div>
                    <div className="h-1 bg-room-mid rounded-full mt-1 overflow-hidden"><div className="h-full transition-all duration-700" style={{ width: `${path.score}%`, background: pathVisual.accent, opacity: path.id === state.lifePath.primary ? 0.9 : 0.35 }} /></div>
                  </div>
                ))}
              </div>
            </div>

            {state.lifePath.history.length > 0 && (
              <div className="mt-7">
                <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">{t('Turns in the road', 'Zakręty na drodze')}</h3>
                <div className="space-y-3 mt-3">
                  {[...state.lifePath.history].reverse().slice(0, 6).map(item => (
                    <div key={item.id} className="border-l-2 border-warm-300/20 pl-3">
                      <div className="text-warm-100/80 text-xs font-serif">{item.title}</div>
                      <div className="text-warm-200/40 text-[10px] font-serif mt-0.5">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-warm-200/20 text-[9px] font-serif">{t('No path is permanent. Repetition strengthens it; consequences and choices can bend it.', 'Żadna droga nie jest stała. Powtórzenia ją wzmacniają, a konsekwencje i wybory mogą ją zmienić.')}</p>
          </div>
        </div>
      )}

      {/* Small local controls keep sensory feedback optional. No account or
          permission prompt is required; unsupported devices simply stay quiet. */}
      {showSettings && (
        <div className="absolute inset-0 bg-room-dark/95 backdrop-blur-md z-50 animate-fade-in safe-top safe-bottom safe-x overflow-auto">
          <div className="max-w-md mx-auto p-6">
            <div className="flex justify-between items-center mb-7">
              <div>
                <p className="text-warm-300/45 text-[9px] uppercase tracking-[0.22em]">{t('Presence', 'Obecność')}</p>
                <h2 className="text-warm-100 text-xl font-serif mt-1">{t('How the room feels', 'Jak czuje się ten pokój')}</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="min-h-11 -my-2 px-2 py-2 text-warm-200/60 hover:text-warm-100 text-sm">{t('Close', 'Zamknij')}</button>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4">
                <div className="text-warm-100/85 text-sm font-serif">{t('Language', 'Język')}</div>
                <p className="text-warm-200/40 text-[10px] font-serif mt-1">{t('Becoming speaks only Polish or English.', 'Becoming mówi tylko po polsku lub angielsku.')}</p>
                <div className="grid grid-cols-2 gap-2 mt-3" role="group" aria-label={t('Language', 'Język')}>
                  {(['pl', 'en'] as const).map(language => (
                    <button
                      key={language}
                      aria-pressed={ui === language}
                      onClick={() => onStateChange(prev => ({ ...prev, conversation: { ...prev.conversation, language } }))}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-serif transition-colors ${ui === language ? 'border-warm-300/35 bg-warm-300/15 text-warm-100' : 'border-warm-200/10 bg-room-dark/25 text-warm-200/45'}`}
                    >
                      {language === 'pl' ? 'Polski' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-5 rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4 cursor-pointer">
                <span>
                  <span className="block text-warm-100/85 text-sm font-serif">{t('Quiet sounds', 'Ciche dźwięki')}</span>
                  <span className="block text-warm-200/40 text-[10px] font-serif mt-1">{t('Soft tones for touch, choices and waking.', 'Delikatne tony przy dotyku, wyborach i budzeniu.')}</span>
                </span>
                <input type="checkbox" checked={sensoryPreferences.sound} onChange={event => updateSensoryPreference('sound', event.target.checked)} className="accent-[#d8bd8f] w-5 h-5" />
              </label>
              <label className="flex items-center justify-between gap-5 rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4 cursor-pointer">
                <span>
                  <span className="block text-warm-100/85 text-sm font-serif">{t('Gentle haptics', 'Delikatne wibracje')}</span>
                  <span className="block text-warm-200/40 text-[10px] font-serif mt-1">{t('Tiny pulses on devices that support vibration.', 'Krótkie impulsy na urządzeniach obsługujących wibracje.')}</span>
                </span>
                <input type="checkbox" checked={sensoryPreferences.haptics} onChange={event => updateSensoryPreference('haptics', event.target.checked)} className="accent-[#d8bd8f] w-5 h-5" />
              </label>
              <div className="rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4">
                <div className="text-warm-100/85 text-sm font-serif">{t('Keep this creature', 'Zachowaj tego stworka')}</div>
                <p className="text-warm-200/40 text-[10px] font-serif mt-1 leading-relaxed">{t('A private file can carry the whole life, memories, chats and creations to another device. Nothing is uploaded.', 'Prywatny plik przeniesie całe życie, wspomnienia, rozmowy i prace na inne urządzenie. Nic nie jest wysyłane.')}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={exportCreature} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Save backup', 'Zapisz backup')}</button>
                  <button onClick={() => importInputRef.current?.click()} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Open backup', 'Otwórz backup')}</button>
                </div>
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importCreature(event.target.files?.[0])} />
                <p className="text-warm-300/35 text-[9px] font-serif mt-3">{t('The file contains personal conversations. Store it somewhere you trust.', 'Plik zawiera prywatne rozmowy. Przechowuj go w zaufanym miejscu.')}</p>
              </div>
              {onReset && (
                <div className="rounded-2xl border border-red-200/10 bg-room-mid/25 p-4">
                  <div className="text-warm-100/70 text-sm font-serif">{t('Begin another life', 'Zacznij inne życie')}</div>
                  <p className="text-warm-200/35 text-[10px] font-serif mt-1">{t('Save a backup first if you may want to return to this creature.', 'Najpierw zapisz backup, jeśli możesz chcieć wrócić do tego stworka.')}</p>
                  <button onClick={onReset} className="mt-3 min-h-11 w-full rounded-xl border border-red-200/15 px-3 py-2 text-red-100/55 text-xs font-serif active:scale-[0.98] transition-transform">{t('Start over', 'Zacznij od nowa')}</button>
                </div>
              )}
            </div>
            {backupStatus && <p className="text-center text-warm-100/55 text-[10px] font-serif mt-5">{backupStatus}</p>}
            <p className="text-center text-warm-200/25 text-[9px] font-serif mt-7">{t('Sensory choices stay only on this device.', 'Ustawienia dźwięku i wibracji zostają tylko na tym urządzeniu.')}</p>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {showChat && (
        <ChatInterface state={state} onStateChange={onStateChange} onClose={() => setShowChat(false)} initialMessage={initiatedTopic || undefined} />
      )}
    </div>
  );
};

export default Room;
