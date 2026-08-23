import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ObjectType, RoomObject, CreatureBehavior, MeaningfulFirst } from '../types';
import CreatureCanvas from './CreatureCanvas';
import ChatInterface from './ChatInterface';
import ObjectIcon from './ObjectIcon';
import GlyphIcon from './GlyphIcon';
import MemoryBookView from './MemoryBookView';
import BecomingView from './BecomingView';
import CareMark from './CareMark';
import {
  cleanRoomMess,
  feedCreature,
  putToSleep,
  touchCreature,
  useToilet,
  wakeUp,
  washCreature,
} from '../systems/needsSystem';
import {
  getDevelopmentDescription,
  getDevelopmentLabel,
  getPendingMeaningfulFirst,
  learnWord,
  markMeaningfulFirstAnnounced,
  recordAutonomousMoment,
  recordMeaningfulFirst,
  updateDevelopment,
} from '../systems/developmentSystem';
import { generateCreatureSpeech, shouldSpeak } from '../systems/languageSystem';
import { shouldInitiateConversation, generateInitiatedTopic, clearInitiatedTopic } from '../systems/socialLearningSystem';
import {
  chooseObjectReaction,
  chooseAutonomousMoment,
  getBondDescription,
  getEmergingTraitLabels,
  getVisiblePersonalitySignature,
  recordBondEvent,
  recordObjectExperience,
} from '../systems/relationshipSystem';
import {
  ensureDailyMoment,
  evolveLifePathFromObject,
  getLifePathClues,
  getLifePathDescription,
  getLifePathPhaseLabel,
  getLifePathTitle,
  getLifePathVisual,
  getRankedLifePaths,
  resolveDailyMoment,
} from '../systems/lifePathSystem';
import {
  evolveInnerLifeFromObject,
  getDreamMoodLabel,
  getInterestLabel,
  getInterestStage,
  getRankedInterests,
  getSelfAwarenessStageLabel,
} from '../systems/innerLifeSystem';
import { consumeReturnGreeting, consumeReturnTrace, getAbsenceSummary, getVisitRitual } from '../systems/presenceSystem';
import {
  emitSensoryCue,
  loadSensoryPreferences,
  saveSensoryPreferences,
  SensoryCue,
  SensoryPreferences,
} from '../systems/sensorySystem';
import { evolveCreationFromObject, getCreationMastery } from '../systems/creationSystem';
import { parseImportedGameState, serializeGameState } from '../systems/persistence';
import { formatLearnedBehaviour, formatStoredMemory, getFactKindLabel, getOpenLoopKindLabel, uiLanguage, uiText } from '../systems/uiLanguage';
import { evaluateTouchBoundary } from '../systems/boundarySystem';
import { getAdoptedSharedPhrases } from '../systems/sharedLanguageSystem';

interface RoomProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onReset?: () => void;
  version?: string;
}

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

const INVENTORY_GROUPS: Array<{
  id: string;
  english: string;
  polish: string;
  items: ObjectType[];
}> = [
  { id: 'care', english: 'Care', polish: 'Opieka', items: ['apple', 'broccoli', 'blanket'] },
  { id: 'play', english: 'Play', polish: 'Zabawa', items: ['ball', 'box'] },
  { id: 'make', english: 'Make', polish: 'Tworzenie', items: ['paper', 'pencil'] },
  { id: 'curious', english: 'Curiosities', polish: 'Ciekawostki', items: ['stone', 'mirror'] },
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
type CareRitualEffect = 'toilet' | 'wash' | 'clean' | null;

interface CreatureCue {
  icon: string;
  label: string;
  tone: CueTone;
}

const Room: React.FC<RoomProps> = ({ state, onStateChange, onReset, version }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const artBase = import.meta.env.BASE_URL;
  const [speech, setSpeech] = useState<string | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [showBecoming, setShowBecoming] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [inventoryGroupId, setInventoryGroupId] = useState('care');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensoryPreferences, setSensoryPreferences] = useState<SensoryPreferences>(() => loadSensoryPreferences());
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [creatureEmotion, setCreatureEmotion] = useState(state.emotionalState);
  const [initiatedTopic, setInitiatedTopic] = useState<string | null>(null);
  const [creatureCue, setCreatureCue] = useState<CreatureCue | null>(null);
  const [momentResult, setMomentResult] = useState<string | null>(null);
  const [firstMoment, setFirstMoment] = useState<MeaningfulFirst | null>(null);
  const [careEffect, setCareEffect] = useState<CareRitualEffect>(null);

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
  const firstMomentTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const returnTraceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const careEffectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastCareSignalRef = useRef(0);
  const firstInFlightRef = useRef<string | null>(null);
  const activeObjectRef = useRef<string | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const inventoryTrayRef = useRef<HTMLDivElement>(null);
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
    if (!greeting || state.presence.pendingTrace || initiatedTopic || showChat || state.sleepState === 'sleeping') return;
    setInitiatedTopic(greeting);
    onStateChange(prev => consumeReturnGreeting(prev));
  }, [initiatedTopic, onStateChange, showChat, state.presence.pendingGreeting, state.presence.pendingTrace, state.sleepState]);

  const emitCue = useCallback((cue: SensoryCue) => {
    emitSensoryCue(cue, sensoryPreferences);
  }, [sensoryPreferences]);

  // The room gets the first word after an absence. Dialogue is held back until
  // the changed position or object has had time to register visually.
  useEffect(() => {
    if (!state.presence.pendingTrace) return;
    clearTimeout(returnTraceTimerRef.current);
    returnTraceTimerRef.current = setTimeout(() => {
      onStateChange(prev => consumeReturnTrace(prev));
    }, 5200);
    return () => clearTimeout(returnTraceTimerRef.current);
  }, [onStateChange, state.presence.pendingTrace?.id]);

  useEffect(() => {
    const pending = getPendingMeaningfulFirst(state);
    if (!pending || firstInFlightRef.current || showChat || showMemoryBook || showBecoming || showCare || state.sleepState === 'sleeping') return;
    firstInFlightRef.current = pending.id;
    setFirstMoment(pending);
    emitCue('milestone');
    if (behaviorRef.current === 'idle') {
      behaviorRef.current = 'proud';
      setTemporaryEmotion('happy', 3600);
      onStateChange(prev => ({ ...prev, creatureBehavior: 'proud' }));
    }
    clearTimeout(firstMomentTimerRef.current);
    firstMomentTimerRef.current = setTimeout(() => {
      setFirstMoment(null);
      firstInFlightRef.current = null;
      onStateChange(prev => {
        const announced = markMeaningfulFirstAnnounced(prev, pending.id);
        return announced.creatureBehavior === 'proud' ? { ...announced, creatureBehavior: 'idle' } : announced;
      });
    }, 4300);
  }, [emitCue, onStateChange, showBecoming, showCare, showChat, showMemoryBook, state.development.experience.firsts, state.sleepState]);

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

  const showCareEffect = useCallback((effect: Exclude<CareRitualEffect, null>, duration: number) => {
    clearTimeout(careEffectTimerRef.current);
    setCareEffect(effect);
    careEffectTimerRef.current = setTimeout(() => setCareEffect(null), duration);
  }, []);

  const clearActionTimers = useCallback(() => {
    clearTimeout(noticeTimerRef.current);
    clearTimeout(movementTimerRef.current);
    clearTimeout(reactionTimerRef.current);
    clearTimeout(ambientTimerRef.current);
    clearTimeout(cueTimerRef.current);
    clearTimeout(careEffectTimerRef.current);
    setCareEffect(null);
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
          ...prev.needs,
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

  const beginObjectInteraction = useCallback((object: RoomObject, initiatedByUser = true, autonomousMomentId?: Parameters<typeof recordAutonomousMoment>[1]) => {
    const currentState = stateRef.current;
    if (currentState.sleepState === 'sleeping') return;

    if (!initiatedByUser) {
      const momentId = autonomousMomentId
        ?? (currentState.development.experience.favoriteObject === object.type ? 'favorite_return' : 'bold_test');
      onStateChange(prev => recordMeaningfulFirst(
        recordAutonomousMoment(prev, momentId, Date.now(), object.type),
        'first_autonomous_object',
      ));
    }

    setSelectedObjectId(null);
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
    const moment = chooseAutonomousMoment(currentState);
    if (!moment) return;
    const label = polish ? moment.labelPl : moment.labelEn;
    const icon = moment.id === 'seek_user' || moment.id === 'independent_nearby'
      ? '♡'
      : moment.id === 'rehearse_word' || moment.id === 'continue_creation'
        ? '✦'
        : moment.action === 'walk'
          ? '↝'
          : '·';

    if (moment.action === 'use_object' && moment.objectId) {
      const object = currentState.roomObjects.find(item => item.id === moment.objectId);
      if (object) beginObjectInteraction(object, false, moment.id);
      return;
    }

    onStateChange(prev => {
      let next = recordAutonomousMoment(prev, moment.id, Date.now(), moment.objectType);
      if (moment.id === 'seek_user') next = recordMeaningfulFirst(next, 'first_spontaneous_approach');
      return next;
    });
    setTemporaryEmotion(moment.emotion, moment.duration);
    showCreatureCue({ icon, label, tone: 'ambient' }, moment.duration);

    if (moment.action === 'walk' && moment.target) {
      if (moment.id === 'cautious_probe') {
        behaviorRef.current = 'hesitating';
        onStateChange(prev => ({ ...prev, creatureBehavior: 'hesitating', currentActivity: label }));
        ambientTimerRef.current = setTimeout(() => walkToIdlePosition(moment.target!), 1350);
      } else {
        walkToIdlePosition(moment.target);
      }
      return;
    }

    behaviorRef.current = moment.behavior;
    if (moment.utterance) triggerSpeech(moment.utterance);
    onStateChange(prev => ({ ...prev, creatureBehavior: moment.behavior, currentActivity: label }));
    ambientTimerRef.current = setTimeout(() => {
      if (activeObjectRef.current || behaviorRef.current !== moment.behavior) return;
      behaviorRef.current = 'idle';
      onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
    }, moment.duration);
  }, [beginObjectInteraction, onStateChange, polish, setTemporaryEmotion, showCreatureCue, triggerSpeech, walkToIdlePosition]);

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
      if (showChat || showCare || showInventory || activeObjectRef.current || behaviorRef.current !== 'idle') return;

      const hasFoodReady = currentState.roomObjects.some(object => object.type === 'apple' || object.type === 'broccoli');
      const careSignal = currentState.roomMess.length > 0
        ? { icon: '◇', en: 'steps carefully around a messy patch', pl: 'ostrożnie omija zabrudzone miejsce' }
        : currentState.needs.bowel < 26
          ? { icon: '…', en: 'cannot quite find a comfortable way to sit', pl: 'nie może znaleźć wygodnej pozycji' }
          : currentState.needs.bladder < 30
            ? { icon: '…', en: 'keeps glancing toward the quiet corner', pl: 'zerka w stronę spokojnego kąta' }
            : currentState.needs.hygiene < 35
              ? { icon: '≈', en: 'grooms one patch, then gives up', pl: 'czyści kawałek futra, po czym rezygnuje' }
              : currentState.needs.hunger < 32 && !hasFoodReady
                ? { icon: '○', en: 'checks the place where food usually appears', pl: 'sprawdza miejsce, w którym zwykle pojawia się jedzenie' }
                : null;

      if (careSignal && Date.now() - lastCareSignalRef.current > 38_000) {
        const label = polish ? careSignal.pl : careSignal.en;
        lastCareSignalRef.current = Date.now();
        behaviorRef.current = 'uncomfortable';
        setTemporaryEmotion('concerned', 3200);
        showCreatureCue({ icon: careSignal.icon, label, tone: 'notice' }, 3100);
        onStateChange(prev => ({ ...prev, creatureBehavior: 'uncomfortable', currentActivity: label }));
        ambientTimerRef.current = setTimeout(() => {
          if (behaviorRef.current !== 'uncomfortable') return;
          behaviorRef.current = 'idle';
          onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
        }, 3200);
        return;
      }

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

      if (goal) {
        beginObjectInteraction(goal, false);
        return;
      }
      startAmbientMoment();
    };

    const kickoff = setTimeout(chooseBehavior, 3500);
    behaviorTimerRef.current = setInterval(chooseBehavior, 7000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(behaviorTimerRef.current);
    };
  }, [beginObjectInteraction, clearActionTimers, onStateChange, polish, setTemporaryEmotion, showCare, showChat, showCreatureCue, showInventory, startAmbientMoment, state.sleepState, walkToIdlePosition]);

  useEffect(() => () => {
    clearActionTimers();
    clearTimeout(emotionTimerRef.current);
    clearTimeout(speechTimeoutRef.current);
    clearTimeout(cueTimerRef.current);
    clearTimeout(momentResultTimerRef.current);
    clearTimeout(firstMomentTimerRef.current);
    clearTimeout(returnTraceTimerRef.current);
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

  const putAwayRoomObject = (objectId: string) => {
    const object = stateRef.current.roomObjects.find(item => item.id === objectId);
    if (!object) return;

    if (activeObjectRef.current === objectId) {
      clearActionTimers();
      activeObjectRef.current = null;
      behaviorRef.current = stateRef.current.sleepState === 'sleeping' ? 'sleeping' : 'idle';
      setIsMoving(false);
    }

    onStateChange(prev => ({
      ...prev,
      roomObjects: prev.roomObjects.filter(item => item.id !== objectId),
      inventory: prev.inventory.includes(object.type) ? prev.inventory : [...prev.inventory, object.type],
      creatureBehavior: prev.sleepState === 'sleeping' ? 'sleeping' : 'idle',
      currentActivity: prev.sleepState === 'sleeping' ? 'sleeping' : null,
    }));
    setSelectedObjectId(current => current === objectId ? null : current);
  };

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
    setSelectedObjectId(object.id);
    setShowInventory(false);
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

    const trayRect = inventoryTrayRef.current?.getBoundingClientRect();
    const droppedInTray = Boolean(
      showInventory
      && trayRect
      && e.clientX >= trayRect.left
      && e.clientX <= trayRect.right
      && e.clientY >= trayRect.top
      && e.clientY <= trayRect.bottom,
    );

    if (session.source === 'room' && session.objectId && session.moved && droppedInTray) {
      putAwayRoomObject(session.objectId);
      resetPointerSession();
      return;
    }

    if (!session.moved) {
      if (session.source === 'inventory') {
        placeInventoryObject(session.type);
      } else if (session.objectId) {
        if (showInventory) {
          putAwayRoomObject(session.objectId);
        } else {
          const object = stateRef.current.roomObjects.find(obj => obj.id === session.objectId);
          if (object) setSelectedObjectId(object.id);
        }
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
        setSelectedObjectId(session.objectId);
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
    setSelectedObjectId(null);
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

  // ========== DAILY CARE ==========
  // These actions extend the existing hidden-needs loop. They do not award
  // points or expose numbers; the room and body language carry the feedback.
  const finishCareAnimation = (expected: CreatureBehavior, duration: number) => {
    clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      if (behaviorRef.current !== expected) return;
      behaviorRef.current = 'idle';
      onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
    }, duration);
  };

  const handleToilet = () => {
    if (stateRef.current.sleepState === 'sleeping') {
      showCreatureCue({ icon: '·', label: t('is sleeping too deeply right now', 'teraz śpi zbyt mocno'), tone: 'ambient' }, 2400);
      return;
    }
    const now = Date.now();
    const preview = useToilet(stateRef.current, now);
    if (!preview.performed) {
      setShowCare(false);
      showCreatureCue({ icon: '·', label: t('does not need the toilet right now', 'teraz nie potrzebuje toalety'), tone: 'ambient' }, 2600);
      return;
    }

    clearActionTimers();
    setShowCare(false);
    emitCue('toilet');
    showCareEffect('toilet', 3300);
    const activity = preview.result === 'both'
      ? t('takes a proper bathroom break', 'załatwia wszystko w spokojnym kącie')
      : preview.result === 'poop'
        ? t('uses the toilet and looks relieved', 'robi kupę w toalecie i wyraźnie odczuwa ulgę')
        : t('uses the toilet and relaxes', 'robi siku w toalecie i od razu się rozluźnia');
    behaviorRef.current = 'toileting';
    setTemporaryEmotion('happy', 3300);
    showCreatureCue({ icon: '○', label: activity, tone: 'reaction' }, 3200);
    onStateChange(prev => {
      const result = useToilet(prev, now);
      if (!result.performed) return result.state;
      const developed = updateDevelopment(result.state, 0.22);
      const bonded = recordBondEvent(developed, 'care');
      return { ...bonded, emotionalState: 'neutral', creatureBehavior: 'toileting', currentActivity: activity };
    });
    finishCareAnimation('toileting', 3300);
  };

  const handleWash = () => {
    if (stateRef.current.sleepState === 'sleeping') {
      showCreatureCue({ icon: '·', label: t('can be washed after waking', 'można go umyć po obudzeniu'), tone: 'ambient' }, 2400);
      return;
    }
    const preview = washCreature(stateRef.current);
    if (!preview.performed) {
      setShowCare(false);
      showCreatureCue({ icon: '·', label: t('is already clean', 'jest już czysty'), tone: 'ambient' }, 2400);
      return;
    }

    clearActionTimers();
    setShowCare(false);
    emitCue('wash');
    showCareEffect('wash', 3500);
    const activity = t('shakes warm drops from its fur', 'strzepuje ciepłe krople z futra');
    behaviorRef.current = 'washing';
    setTemporaryEmotion('happy', 3500);
    showCreatureCue({ icon: '≈', label: activity, tone: 'reaction' }, 3400);
    onStateChange(prev => {
      const result = washCreature(prev);
      if (!result.performed) return result.state;
      const developed = updateDevelopment(result.state, 0.18);
      const bonded = recordBondEvent(developed, 'care');
      return { ...bonded, emotionalState: 'neutral', creatureBehavior: 'washing', currentActivity: activity };
    });
    finishCareAnimation('washing', 3500);
  };

  const handleCleanMess = (messId?: string) => {
    const preview = cleanRoomMess(stateRef.current, messId);
    if (!preview.performed) {
      setShowCare(false);
      showCreatureCue({ icon: '·', label: t('the room is already clean', 'pokój jest już czysty'), tone: 'ambient' }, 2400);
      return;
    }
    emitCue('clean');
    showCareEffect('clean', 2700);
    setShowCare(false);
    showCreatureCue({ icon: '◇', label: preview.count === 1 ? t('the floor is clean again', 'podłoga znów jest czysta') : t('the room feels clear again', 'w pokoju znów jest czysto'), tone: 'reaction' }, 2600);
    onStateChange(prev => {
      const result = cleanRoomMess(prev, messId);
      if (!result.performed) return result.state;
      const cleaned = result.state.roomMess.length === 0 ? { ...result.state, emotionalState: 'neutral' } : result.state;
      return recordBondEvent(cleaned, 'care');
    });
  };

  const handleOpenFood = () => {
    setShowCare(false);
    setInventoryGroupId('care');
    setShowInventory(true);
  };

  // ========== SLEEP ==========
  const handleSleepToggle = () => {
    setShowCare(false);
    setShowInventory(false);
    emitCue(state.sleepState === 'sleeping' ? 'wake' : 'sleep');
    if (state.sleepState === 'sleeping') {
      onStateChange(prev => wakeUp(prev));
    } else {
      onStateChange(prev => putToSleep(prev));
    }
  };

  const handleOpenChatWithTopic = () => {
    emitCue('open');
    setShowCare(false);
    setShowInventory(false);
    setShowChat(true);
    setInitiatedTopic(null);
  };

  const handleOpenChat = () => {
    emitCue('open');
    setShowCare(false);
    setShowInventory(false);
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
  const developmentLabel = getDevelopmentLabel(state.development.stage, ui);
  const emergingTraits = getEmergingTraitLabels(state.personality, 2, ui);
  const personalitySignature = getVisiblePersonalitySignature(state);
  const lifePathTitle = getLifePathTitle(state, ui);
  const lifePathDescription = getLifePathDescription(state, ui);
  const lifePathClues = getLifePathClues(state, 3, ui);
  const rankedLifePaths = getRankedLifePaths(state, 4, ui);
  const pathVisual = getLifePathVisual(state);
  const rankedInterests = getRankedInterests(state, 4, ui);
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
  const sharedPhrases = getAdoptedSharedPhrases(state).slice(0, 4);
  const visitRitual = getVisitRitual(state);
  const meaningfulFirsts = [...state.development.experience.firsts].sort((a, b) => b.timestamp - a.timestamp);
  const returnTrace = state.presence.pendingTrace;
  const discoveredPreferences = INVENTORY_ORDER
    .map(type => ({ type, preference: state.objectPreferences[type] }))
    .filter(({ preference }) => preference.interactions >= 2 && (preference.affinity >= 12 || preference.affinity <= -8))
    .sort((a, b) => Math.abs(b.preference.affinity) - Math.abs(a.preference.affinity))
    .slice(0, 3);
  const selectedObject = selectedObjectId
    ? state.roomObjects.find(object => object.id === selectedObjectId) ?? null
    : null;
  const activeInventoryGroup = INVENTORY_GROUPS.find(group => group.id === inventoryGroupId) ?? INVENTORY_GROUPS[0];
  const activeInventoryItems = activeInventoryGroup.items.filter(type => state.inventory.includes(type));
  const careNeedsAttention = state.roomMess.length > 0
    || state.needs.hunger < 36
    || state.needs.hygiene < 38
    || state.needs.bladder < 34
    || state.needs.bowel < 28;
  const careCalling = {
    food: state.needs.hunger < 36,
    toilet: state.needs.bladder < 34 || state.needs.bowel < 28,
    wash: state.needs.hygiene < 38,
    clean: state.roomMess.length > 0,
  };
  const careSummary = state.roomMess.length > 0
    ? t('Something on the floor needs cleaning. No emergency — just part of sharing a room.', 'Coś na podłodze wymaga sprzątnięcia. Bez alarmu — tak wygląda wspólny pokój.')
    : state.needs.bowel < 28 && state.needs.bladder < 34
      ? t('It cannot settle. A bathroom break would probably help.', 'Nie może się ułożyć. Wizyta w toalecie prawdopodobnie pomoże.')
      : state.needs.bowel < 28
        ? t('Its way of sitting says more than words do.', 'Sposób, w jaki siada, mówi więcej niż słowa.')
        : state.needs.bladder < 34
          ? t('It keeps checking the quiet corner of the room.', 'Co chwilę zerka w spokojny kąt pokoju.')
          : state.needs.hunger < 36
            ? t('Its attention keeps drifting toward the food shelf.', 'Jego uwaga ciągle wraca do półki z jedzeniem.')
            : state.needs.hygiene < 38
              ? t('Its fur has lost some of its soft sheen.', 'Futro straciło trochę swojego miękkiego blasku.')
              : t('Nothing is urgent. Ordinary care is enough.', 'Nic nie jest pilne. Wystarczy zwykła opieka.');

  return (
    <div
      ref={roomRef}
      className="terrarium-shell relative w-full h-full overflow-hidden"
      style={{ touchAction: draggingType ? 'none' : 'pan-y' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Room background */}
      <div className={`absolute inset-0 transition-all duration-1000 ${state.sleepState === 'sleeping' ? 'brightness-50' : 'brightness-100'}`}>
        <div className="absolute inset-x-0 top-0 h-[67%]" style={{ background: 'linear-gradient(180deg, #1c2119 0%, #151812 68%, #11130f 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-[36%]" style={{ background: 'linear-gradient(180deg, #25291f 0%, #1a1d17 72%, #141611 100%)' }} />
        <div className="absolute inset-x-0 top-[64.5%] h-px bg-[#080a07]/80 shadow-[0_-1px_0_rgba(216,210,191,.045)]" />
        <div className="absolute inset-x-0 bottom-0 h-[35%] opacity-20" style={{ background: 'repeating-linear-gradient(103deg, transparent 0 54px, rgba(5,7,5,.58) 55px 57px)' }} />
        <div className="absolute top-[12%] left-1/2 h-[370px] w-[370px] -translate-x-1/2 rounded-full opacity-50" style={{ background: 'radial-gradient(ellipse, rgba(191,177,132,.17) 0%, rgba(100,112,82,.055) 43%, transparent 70%)' }} />
        <div className="absolute top-[9%] left-[7%] h-[44%] w-[38%] opacity-25" style={{ background: 'radial-gradient(ellipse at 0 0, rgba(126,145,105,.18), transparent 70%)' }} />
        <div className="absolute inset-0 transition-colors duration-[1800ms]" style={{ background: pathVisual.roomTint }} />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 42%, rgba(0,0,0,.42) 100%)' }} />
      <div className="absolute inset-0 ambient-grain" aria-hidden="true" />

      {/* Sleep zzz */}
      {state.sleepState === 'sleeping' && state.development.stage !== 'egg' && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 animate-float z-30">
          <span className="text-warm-200/40 text-sm font-serif">z z z</span>
        </div>
      )}

      {/* Bathroom accidents are small persistent pieces of room state, not a
          status icon. They remain where they happened until the player cleans
          them, and can be tapped directly. */}
      {state.roomMess.map(mess => (
        <button
          type="button"
          key={mess.id}
          aria-label={mess.type === 'pee' ? t('Clean the puddle', 'Posprzątaj kałużę') : t('Clean the poop', 'Posprzątaj kupę')}
          title={t('Clean', 'Posprzątaj')}
          className={`room-mess-button absolute z-[18] grid h-12 w-12 place-items-center rounded-full transition-transform active:scale-95 ${showCare ? 'is-noticed' : ''}`}
          style={{ left: `${mess.x}%`, top: `${mess.y}%`, transform: 'translate(-50%, -50%)' }}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); handleCleanMess(mess.id); }}
        >
          <CareMark type={mess.type} size={52} className="room-mess-mark drop-shadow-[0_5px_5px_rgba(0,0,0,.25)]" />
        </button>
      ))}

      {/* Room objects (only placed ones) */}
      {state.roomObjects.map(obj => (
        <button
          type="button"
          key={obj.id}
          aria-label={showInventory
            ? (polish ? `Odłóż: ${objectLabel(obj.type, true)}` : `Put away ${objectLabel(obj.type, false)}`)
            : (polish ? `Opcje: ${objectLabel(obj.type, true)}` : `Options for ${objectLabel(obj.type, false)}`)}
          title={showInventory ? t('Put away', 'Odłóż') : t('Use or put away', 'Użyj lub odłóż')}
          className="absolute z-20 select-none p-3 -m-3 bg-transparent border-0"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: 'grab',
            touchAction: 'none',
            opacity: draggingObjectId === obj.id ? 0.25 : 1,
          }}
          onPointerDown={(e) => startPointerSession({ source: 'room', type: obj.type, objectId: obj.id }, e)}
          onClick={(e) => {
            if (e.detail === 0) {
              if (showInventory) putAwayRoomObject(obj.id);
              else setSelectedObjectId(obj.id);
            }
          }}
        >
          <span className={`relative block transition-transform duration-200 ${obj.state.returnTraceId === returnTrace?.id ? 'trace-halo' : ''} ${obj.beingUsedByCreature ? 'scale-110 drop-shadow-[0_0_12px_rgba(220,195,150,0.45)]' : 'hover:scale-105'}`}>
            <ObjectIcon type={obj.type} status={obj.state.status} size={58} />
            {showInventory && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-warm-100/25 bg-room-dark/95 text-[11px] text-warm-100 shadow-lg" aria-hidden="true">↓</span>
            )}
          </span>
        </button>
      ))}

      {/* A placed thing has an explicit, reversible lifecycle. Selecting it
          never guesses whether the player meant "use" or "put away". */}
      {selectedObject && !showInventory && draggingObjectId !== selectedObject.id && (
        <div
          className="absolute z-40 -translate-x-1/2 -translate-y-full animate-cue-pop"
          style={{ left: `${Math.max(22, Math.min(78, selectedObject.x))}%`, top: `${Math.max(46, selectedObject.y - 7)}%` }}
        >
          <div className="flex items-center gap-1 rounded-2xl border border-warm-200/12 bg-[#211e1a]/96 p-1.5 shadow-2xl backdrop-blur-xl">
            <span className="px-2 text-[10px] font-serif text-warm-100/60">{objectLabel(selectedObject.type, polish)}</span>
            <button
              type="button"
              onClick={() => beginObjectInteraction(selectedObject)}
              className="min-h-11 min-w-11 rounded-xl bg-warm-100/90 px-3 py-2 text-[10px] font-serif text-room-dark active:scale-95"
            >
              {t('Use', 'Użyj')}
            </button>
            <button
              type="button"
              onClick={() => putAwayRoomObject(selectedObject.id)}
              className="min-h-11 rounded-xl border border-warm-200/10 px-3 py-2 text-[10px] font-serif text-warm-100/70 active:scale-95"
            >
              {t('Put away', 'Odłóż')}
            </button>
            <button type="button" aria-label={t('Close', 'Zamknij')} onClick={() => setSelectedObjectId(null)} className="grid h-11 w-11 place-items-center text-sm text-warm-200/45">×</button>
          </div>
        </div>
      )}

      {/* Dragging ghost (inventory or moved object) */}
      {draggingType && (
        <div
          className="absolute select-none z-50 pointer-events-none"
          style={{
            left: `${dragPos.x}px`,
            top: `${dragPos.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.9,
          }}
        >
          <ObjectIcon type={draggingType} size={64} className="drop-shadow-[0_8px_10px_rgba(0,0,0,0.45)]" />
        </div>
      )}

      {/* Care is shown as a small room ritual, not a detached status update. */}
      {(careEffect === 'wash' || careEffect === 'toilet') && (
        <div
          className={`care-ritual-underlay care-ritual-underlay--${careEffect}`}
          style={{ left: `${creaturePos.x}%`, top: `${creaturePos.y}%` }}
          aria-hidden="true"
        >
          <i /><i /><i />
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

      {careEffect === 'wash' && (
        <div
          className="care-wash-drops"
          style={{ left: `${creaturePos.x}%`, top: `${creaturePos.y}%` }}
          aria-hidden="true"
        >
          <i /><i /><i /><i /><i />
        </div>
      )}

      {careEffect === 'toilet' && (
        <div
          className="care-privacy-veil"
          style={{ left: `${creaturePos.x}%`, top: `${creaturePos.y}%` }}
          aria-hidden="true"
        >
          <i /><i /><span />
        </div>
      )}

      {careEffect === 'clean' && (
        <div className="care-cleaning-pass" aria-hidden="true">
          <span />
          <i /><i /><i /><i /><i />
        </div>
      )}

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

      {returnTrace && !showChat && !showMemoryBook && !showBecoming && !showCare && (
        <div className="absolute left-4 right-4 bottom-24 z-40 pointer-events-none animate-fade-in" aria-live="polite">
          <div className="return-trace max-w-sm mx-auto rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#c7a66c]/20 text-[#c7a66c]/75">
              <GlyphIcon name="trace" size={20} />
            </span>
            <div>
              <p className="eyebrow text-[#8d987c]/65">{t('The room remembers', 'Pokój pamięta')}</p>
              <p className="text-[#ece8da]/78 text-xs font-serif leading-relaxed mt-1">{polish ? returnTrace.captionPl : returnTrace.captionEn}</p>
            </div>
          </div>
        </div>
      )}

      {firstMoment && !returnTrace && !showChat && !showMemoryBook && !showBecoming && !showCare && (
        <div className="absolute left-5 right-5 bottom-24 z-40 pointer-events-none animate-cue-pop" aria-live="polite">
          <div className="max-w-sm mx-auto rounded-[1.2rem_.4rem_1.2rem_1.2rem] border border-[#c7a66c]/20 bg-[#1b1f18]/96 px-4 py-3 shadow-2xl">
            <p className="eyebrow text-[#c7a66c]/58">{t('A first, quietly kept', 'Pierwszy raz, cicho zachowany')}</p>
            <p className="display-title text-[#ece8da]/92 text-base mt-1.5">{polish ? firstMoment.titlePl : firstMoment.titleEn}</p>
            <p className="text-[#d8d2bf]/62 text-[10px] font-serif leading-relaxed mt-1">{polish ? firstMoment.detailPl : firstMoment.detailEn}</p>
          </div>
        </div>
      )}

      {/* Creature-initiated chat prompt */}
      {initiatedTopic && !showChat && !showCare && (
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
      <div className="quiet-topbar absolute top-0 left-0 right-0 safe-top px-4 py-3 flex justify-between items-start z-30">
        <button onClick={() => setShowBecoming(true)} className="text-left group tap-target -my-1 py-1 pr-3">
          <div className="eyebrow text-[#8d987c]/70 group-hover:text-[#d8d2bf]/75 transition-colors">{developmentLabel}</div>
          <div className="display-title text-[#ece8da]/86 text-lg mt-1 group-hover:text-[#ece8da] transition-colors">
            {state.identity.name || t('New', 'Nowy')}
          </div>
          <div className="text-[8px] font-serif uppercase tracking-[0.15em] mt-0.5" style={{ color: pathVisual.accent }}>
            {lifePathTitle}
          </div>
        </button>
        <div className="flex gap-0.5 items-start">
          <button aria-label={t('Memory Book', 'Księga wspomnień')} title={t('Memory Book', 'Księga wspomnień')} onClick={() => { emitCue('open'); setShowMemoryBook(true); }} className="tap-target grid place-items-center text-[#d8d2bf]/55 hover:text-[#ece8da] rounded-full transition-colors">
            <GlyphIcon name="memory" size={20} />
          </button>
          <button aria-label={t('Settings', 'Ustawienia')} title={t('Settings', 'Ustawienia')} onClick={() => { emitCue('open'); setShowSettings(true); }} className="tap-target grid place-items-center text-[#d8d2bf]/42 hover:text-[#ece8da] rounded-full transition-colors">
            <GlyphIcon name="settings" size={20} />
          </button>
        </div>
      </div>

      {/* Daily moments are small dilemmas, not quests. Their choice changes
          the creature's path and becomes a remembered event. */}
      {state.lifePath.pendingMoment && !showChat && !showMemoryBook && !showBecoming && !showCare && state.sleepState !== 'sleeping' && (
        <div className="absolute left-4 right-4 bottom-24 z-40 animate-slide-up">
          <div className="max-w-md mx-auto rounded-2xl border border-warm-300/20 bg-room-dark/94 backdrop-blur-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/55">{t('A moment', 'Chwila')} · {t('Day', 'Dzień')} {state.lifePath.pendingMoment.day}</p>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: pathVisual.accent }} />
            </div>
            <h2 className="text-warm-100 text-base font-serif mt-1">{polish ? state.lifePath.pendingMoment.titlePl ?? state.lifePath.pendingMoment.title : state.lifePath.pendingMoment.title}</h2>
            <p className="text-warm-200/65 text-xs leading-relaxed font-serif mt-1.5">{polish ? state.lifePath.pendingMoment.promptPl ?? state.lifePath.pendingMoment.prompt : state.lifePath.pendingMoment.prompt}</p>
            <div className="grid gap-2 mt-3">
              {state.lifePath.pendingMoment.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleMomentChoice(choice.id, polish ? choice.resultPl ?? choice.result : choice.result)}
                  className="rounded-xl border border-warm-200/10 bg-room-mid/70 px-3 py-2 text-left text-xs font-serif text-warm-100 hover:border-warm-300/30 active:scale-[0.99] transition-all"
                >
                  {polish ? choice.labelPl ?? choice.label : choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {momentResult && !showChat && !showMemoryBook && !showBecoming && !showCare && (
        <div className="absolute left-5 right-5 bottom-24 z-40 pointer-events-none animate-cue-pop">
          <div className="max-w-sm mx-auto rounded-2xl border border-warm-300/20 bg-room-mid/94 backdrop-blur-xl px-4 py-3 text-center shadow-2xl">
            <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/45">{t('This became a memory', 'To stało się wspomnieniem')}</p>
            <p className="text-warm-100/85 text-xs font-serif leading-relaxed mt-1">{momentResult}</p>
          </div>
        </div>
      )}

      {/* Conversation is the primary way this creature grows. */}
      {state.conversation.totalUserMessages === 0 && !showInventory && !showCare && !returnTrace && !firstMoment && !state.lifePath.pendingMoment && state.sleepState !== 'sleeping' && (
        <button
          onClick={handleOpenChat}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 min-h-11 rounded-full border border-[#ece8da]/20 bg-[#ece8da] text-[#171913] px-5 py-2 text-xs font-serif shadow-xl animate-cue-pop whitespace-nowrap"
        >
          {polish ? `Porozmawiaj z ${state.identity.name || 'stworkiem'}` : `Talk to ${state.identity.name || 'the creature'}`}
        </button>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 safe-bottom px-4 py-3 flex justify-center z-30">
        <nav className="room-dock flex items-center gap-1 rounded-[1.7rem] px-1.5 py-1" aria-label={t('Room actions', 'Działania w pokoju')}>
          <button aria-label={state.sleepState === 'sleeping' ? t('Wake creature', 'Obudź stworka') : t('Put creature to sleep', 'Połóż stworka spać')} title={state.sleepState === 'sleeping' ? t('Wake creature', 'Obudź stworka') : t('Sleep', 'Sen')} onClick={handleSleepToggle} className="dock-action">
            <GlyphIcon name={state.sleepState === 'sleeping' ? 'sun' : 'moon'} size={21} />
          </button>
          <button
            aria-label={careNeedsAttention ? t('Open care — something needs attention', 'Otwórz opiekę — coś wymaga uwagi') : t('Open care', 'Otwórz opiekę')}
            title={t('Care', 'Opieka')}
            aria-expanded={showCare}
            onClick={() => { setShowInventory(false); setShowCare(current => !current); }}
            className={`dock-action relative ${showCare ? 'bg-[#ece8da] !text-[#171913]' : ''}`}
          >
            <GlyphIcon name="care" size={21} />
            {careNeedsAttention && <span className="care-seed" aria-hidden="true"><i /></span>}
          </button>
          <button data-primary="true" aria-label={t('Talk to creature', 'Porozmawiaj ze stworkiem')} title={t('Talk', 'Rozmowa')} onClick={handleOpenChat} className="dock-action flex-col gap-0.5">
            <GlyphIcon name="chat" size={20} />
            <span className="text-[9px] font-serif leading-none">{t('Talk', 'Rozmowa')}</span>
          </button>
          <button aria-label={t('Open things', 'Otwórz rzeczy')} title={t('Things', 'Rzeczy')} aria-expanded={showInventory} onClick={() => { setShowCare(false); setShowInventory(current => !current); }} className={`dock-action ${showInventory ? 'bg-[#ece8da] !text-[#171913]' : ''}`}>
            <GlyphIcon name="shelf" size={22} />
          </button>
        </nav>
      </div>

      {showCare && (
        <section className="care-sheet absolute bottom-20 left-3 right-3 z-40 mx-auto max-w-md animate-slide-up" aria-label={t('Daily care', 'Codzienna opieka')}>
          <div className="care-sheet-light" aria-hidden="true" />
          <img src={`${artBase}art/care-motif.png`} alt="" className="care-sheet-motif motif-art" aria-hidden="true" />
          <header className="care-sheet-header">
            <div className="relative z-[2] max-w-[72%]">
              <p className="care-kicker">{t('THE ORDINARY BODY', 'ZWYCZAJNE CIAŁO')}</p>
              <h2>{t('Daily care', 'Codzienna opieka')}</h2>
              <p className="care-summary">{careSummary}</p>
            </div>
            <button type="button" onClick={() => setShowCare(false)} aria-label={t('Close care', 'Zamknij opiekę')} className="care-sheet-close tap-target">
              <GlyphIcon name="close" size={18} />
            </button>
          </header>
          <div className="care-actions-grid">
            <button type="button" onClick={handleOpenFood} className="care-action care-action--food" data-calling={careCalling.food || undefined}>
              <span className="care-action-icon"><GlyphIcon name="food" size={21} /></span>
              <span><span className="block text-xs text-warm-100">{t('Food', 'Jedzenie')}</span><span className="mt-0.5 block text-[10px] leading-tight text-warm-200/60">{t('Choose something from the shelf', 'Wybierz coś z półki')}</span></span>
              {careCalling.food && <i className="care-action-pulse" aria-hidden="true" />}
            </button>
            <button type="button" onClick={handleToilet} className="care-action care-action--toilet" data-calling={careCalling.toilet || undefined}>
              <span className="care-action-icon"><GlyphIcon name="toilet" size={21} /></span>
              <span><span className="block text-xs text-warm-100">{t('Toilet', 'Toaleta')}</span><span className="mt-0.5 block text-[10px] leading-tight text-warm-200/60">{t('A quiet bathroom break', 'Chwila w spokojnym kącie')}</span></span>
              {careCalling.toilet && <i className="care-action-pulse" aria-hidden="true" />}
            </button>
            <button type="button" onClick={handleWash} className="care-action care-action--wash" data-calling={careCalling.wash || undefined}>
              <span className="care-action-icon"><GlyphIcon name="wash" size={21} /></span>
              <span><span className="block text-xs text-warm-100">{t('Wash', 'Mycie')}</span><span className="mt-0.5 block text-[10px] leading-tight text-warm-200/60">{t('Warm water and clean fur', 'Ciepła woda i czyste futro')}</span></span>
              {careCalling.wash && <i className="care-action-pulse" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => handleCleanMess()} className="care-action care-action--clean" data-calling={careCalling.clean || undefined}>
              <span className="care-action-icon"><GlyphIcon name="clean" size={21} /></span>
              <span><span className="block text-xs text-warm-100">{t('Clean room', 'Sprzątanie')}</span><span className="mt-0.5 block text-[10px] leading-tight text-warm-200/60">{state.roomMess.length > 0 ? (polish ? `${state.roomMess.length} ${state.roomMess.length === 1 ? 'ślad' : 'ślady'}` : `${state.roomMess.length} ${state.roomMess.length === 1 ? 'trace' : 'traces'}`) : t('The floor is clear', 'Podłoga jest czysta')}</span></span>
              {careCalling.clean && <i className="care-action-pulse" aria-hidden="true" />}
            </button>
          </div>
        </section>
      )}

      {/* Inventory tray */}
      {showInventory && (
        <div ref={inventoryTrayRef} className="absolute bottom-20 left-3 right-3 rounded-[1.4rem] border border-white/[.09] bg-[#181b15]/[.98] p-4 shadow-[0_24px_70px_rgba(0,0,0,.58)] z-40 animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-warm-100/85 text-sm font-serif">{t('The shelf', 'Półka')}</p>
              <p className="text-warm-200/68 text-[10px] font-serif leading-relaxed">{t('Take something out. In the room, choose Use or Put away.', 'Wyjmij coś. W pokoju wybierzesz: Użyj albo Odłóż.')}</p>
            </div>
            <button onClick={() => setShowInventory(false)} className="tap-target shrink-0 rounded-full border border-warm-200/10 px-3 py-1.5 text-[10px] font-serif text-warm-100/70 hover:bg-warm-100/5">{t('Done', 'Gotowe')}</button>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-room-dark/35 p-1">
            {INVENTORY_GROUPS.map(group => (
              <button
                type="button"
                key={group.id}
                onClick={() => setInventoryGroupId(group.id)}
                className={`min-h-11 rounded-lg px-1 text-[9px] font-serif transition-colors ${inventoryGroupId === group.id ? 'bg-warm-100/90 text-room-dark shadow' : 'text-warm-200/42 hover:text-warm-100'}`}
              >
                {polish ? group.polish : group.english}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {activeInventoryItems.map(type => (
              <button
                type="button"
                key={type}
                aria-label={polish ? `Połóż: ${objectLabel(type, true)}` : `Place ${objectLabel(type, false)}`}
                title={objectLabel(type, polish)}
                className="min-h-[70px] rounded-2xl border border-warm-200/7 bg-room-dark/35 px-1.5 py-1.5 cursor-grab active:scale-[1.04] transition-all select-none flex flex-col items-center justify-center hover:border-warm-300/20 hover:bg-room-dark/55"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => startPointerSession({ source: 'inventory', type }, e)}
                onClick={(e) => {
                  if (e.detail === 0) placeInventoryObject(type);
                }}
              >
                <ObjectIcon type={type} size={42} className="drop-shadow-[0_3px_3px_rgba(0,0,0,.3)]" />
                <span className="mt-0.5 max-w-full truncate text-[9px] font-serif text-warm-100/55">{objectLabel(type, polish)}</span>
              </button>
            ))}
          </div>
          {activeInventoryItems.length === 0 && (
            <p className="mt-3 rounded-xl border border-dashed border-warm-200/10 py-3 text-center text-xs font-serif italic text-warm-200/35">{state.inventory.length === 0 ? t('Everything is in the room. Select a thing there to put it back.', 'Wszystko jest w pokoju. Wybierz tam rzecz, aby ją odłożyć.') : t('This part of the shelf is empty.', 'Ta część półki jest pusta.')}</p>
          )}
          {state.roomObjects.length > 1 && (
            <div className="mt-3 border-t border-warm-200/5 pt-3 text-center">
              <button onClick={handleTidyRoom} className="text-[10px] font-serif text-warm-200/35 hover:text-warm-100">{t('Put everything away', 'Odłóż wszystko')}</button>
            </div>
          )}
        </div>
      )}

      {showMemoryBook && <MemoryBookView state={state} version={version} onClose={() => setShowMemoryBook(false)} />}

      {/* Legacy markup remains temporarily as a compile-time reference while
          the material Memory Book above becomes the single rendered view. */}
      {false && showMemoryBook && (
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
                  {getDevelopmentDescription(state.development.stage, ui)}
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
                          {getFactKindLabel(fact.kind, ui)}: {fact.value}
                        </span>
                      ))}
                  </div>
                )}
                {state.socialLearning.imitated.length > 0 && (
                  <p className="text-warm-200/45 text-[10px] font-serif mt-2">
                    {t('Learning from you', 'Uczy się od ciebie')}: {state.socialLearning.imitated.slice(-3).map(habit => formatLearnedBehaviour(habit.action, habit.target, ui)).join(', ')}
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
                          {interest.label} · {getInterestStage(interest.level, ui)}
                        </span>
                      ))}
                    </div>
                  )}
                  {latestDream && (
                    <div className="mt-3 rounded-xl bg-room-dark/25 border border-warm-200/5 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-warm-300/40">{t('Last dream', 'Ostatni sen')} · {getDreamMoodLabel(latestDream.mood, ui)}</p>
                      <p className="text-warm-100/70 text-xs font-serif italic mt-1">{latestDream.fragment}</p>
                    </div>
                  )}
                  {confidentOpinions.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      {confidentOpinions.map(opinion => (
                        <p key={opinion.topic} className="text-warm-200/55 text-[10px] font-serif">
                          <span className="text-warm-100/70">{getInterestLabel(opinion.topic, ui)}</span> — {opinion.stance >= 0.25 ? t('drawn to it', 'ciągnie go do tego') : opinion.stance <= -0.25 ? t('pushes against it', 'odpycha go to') : t('still divided', 'wciąż ma mieszane uczucia')}
                        </p>
                      ))}
                    </div>
                  )}
                  {state.innerLife.privateThoughts.some(thought => !thought.revealedAt) && (
                    <p className="text-warm-300/35 text-[9px] font-serif mt-3">{t('Some thoughts are still private. Trust may uncover them.', 'Niektóre myśli nadal są prywatne. Zaufanie może je odsłonić.')}</p>
                  )}
                  {state.innerLife.selfAwareness.stage !== 'unaware' && (
                    <div className="mt-3 pt-3 border-t border-warm-200/5">
                      <p className="text-[9px] uppercase tracking-widest text-warm-300/40">{t('Mirror', 'Lustro')} · {getSelfAwarenessStageLabel(state.innerLife.selfAwareness.stage, ui)}</p>
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
                        <span className="text-warm-100/65"><span className="uppercase tracking-wider text-warm-200/35">{getOpenLoopKindLabel(loop.kind, ui)}</span> · {loop.subject}</span>
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
                  <p className="text-warm-200/30 text-[9px] font-serif mt-2">{t('Paper and pencil', 'Papier i ołówek')} · {getCreationMastery(state, ui)}</p>
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
              {sharedPhrases.length > 0 && (
                <div className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-2">{t('Our language', 'Nasz język')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {sharedPhrases.map(phrase => (
                      <span key={phrase.id} className="rounded-full border border-warm-300/10 bg-warm-300/5 px-2.5 py-1 text-[10px] text-warm-100/65 font-serif">“{phrase.text}”</span>
                    ))}
                  </div>
                  <p className="text-warm-200/25 text-[9px] font-serif mt-2">{t('Repeated sayings can slowly become something shared.', 'Powtarzane powiedzonka mogą powoli stać się czymś wspólnym.')}</p>
                </div>
              )}
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">{t('Becoming', 'Stawanie się')}</div>
                <div className="text-warm-100 text-sm font-serif capitalize">
                  {emergingTraits.join(' · ')}
                </div>
                <p className="text-warm-200/55 text-xs font-serif italic mt-1.5">
                  {getBondDescription(state.bond.stage, state.identity.name, ui)}
                </p>
                {discoveredPreferences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {discoveredPreferences.map(({ type, preference }) => (
                      <span key={type} className="inline-flex items-center gap-1 rounded-full bg-room-mid/70 border border-warm-200/10 px-2 py-1 text-[10px] text-warm-200/70">
                        <ObjectIcon type={type} size={17} /> {preference.affinity >= 12 ? t('favorite', 'ulubione') : t('unsure', 'niepewne')}
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
                      .map(o => formatLearnedBehaviour(o.action, o.target, ui))
                      .join(', ')}
                  </div>
                </div>
              )}
              {state.memories.filter(m => m.importance >= 6 && !m.tags.includes('dream')).slice(-10).map(mem => (
                <div key={mem.id} className="border-l-2 border-warm-300/30 pl-4">
                  <div className="text-warm-200/40 text-xs mb-1">
                    Day {Math.max(1, Math.floor((mem.timestamp - state.identity.birthTimestamp) / (24 * 60 * 60 * 1000)) + 1)}
                  </div>
                  <div className="text-warm-100 text-sm font-serif">{formatStoredMemory(mem.content, ui)}</div>
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

      {showBecoming && <BecomingView state={state} onClose={() => setShowBecoming(false)} />}

      {false && showBecoming && (
        <div className="absolute inset-0 bg-room-dark/97 backdrop-blur-xl z-50 animate-fade-in safe-top safe-bottom safe-x overflow-auto">
          <div className="max-w-md mx-auto p-6">
            <div className="flex justify-between items-start gap-4 mb-7">
              <div>
                <p className="text-warm-300/45 text-[9px] uppercase tracking-[0.22em]">{t('What I am becoming', 'Kim się staję')}</p>
                <h2 className="text-warm-100 text-2xl font-serif mt-1">{lifePathTitle}</h2>
                <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: pathVisual.accent }}>{getLifePathPhaseLabel(state.lifePath.phase, ui)}</p>
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
                      <div className="text-warm-200/35 text-[9px] uppercase tracking-widest mt-0.5">{getInterestStage(interest.level, ui)}</div>
                    </div>
                  ))}
                </div>
                {latestDream && <p className="text-warm-200/45 text-[10px] font-serif italic mt-3">Dreaming lately: “{latestDream.title}”</p>}
                {state.innerLife.selfAwareness.stage !== 'unaware' && (
                  <p className="text-warm-200/45 text-[10px] font-serif italic mt-1 capitalize">Mirror self · {state.innerLife.selfAwareness.stage}</p>
                )}
                {state.creations.length > 0 && (
                  <p className="text-warm-200/45 text-[10px] font-serif italic mt-1">{t('Making', 'Tworzenie')} · {getCreationMastery(state, ui)}</p>
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
        <div className="functional-sheet safe-top safe-bottom safe-x animate-fade-in">
          <div className="sheet-inner">
            <div className="flex justify-between items-center mb-7">
              <div>
                <p className="eyebrow text-[#a8ad91]/90">{t('On this device', 'Na tym urządzeniu')}</p>
                <h2 className="display-title text-warm-100 text-2xl mt-2">{t('Settings', 'Ustawienia')}</h2>
              </div>
              <button aria-label={t('Close settings', 'Zamknij ustawienia')} onClick={() => setShowSettings(false)} className="tap-target grid place-items-center text-warm-200/60 hover:text-warm-100 rounded-full"><GlyphIcon name="close" size={21} /></button>
            </div>
            <div className="space-y-3">
              <div className="ink-card p-4">
                <div className="text-warm-100/85 text-sm font-serif">{t('Language', 'Język')}</div>
                <p className="text-warm-200/62 text-[10px] font-serif mt-1">{t('Becoming speaks only Polish or English.', 'Becoming mówi tylko po polsku lub angielsku.')}</p>
                <div className="grid grid-cols-2 gap-2 mt-3" role="group" aria-label={t('Language', 'Język')}>
                  {(['pl', 'en'] as const).map(language => (
                    <button
                      key={language}
                      aria-pressed={ui === language}
                      onClick={() => onStateChange(prev => ({ ...prev, conversation: { ...prev.conversation, language } }))}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-serif transition-colors ${ui === language ? 'border-warm-300/35 bg-warm-300/15 text-warm-100' : 'border-warm-200/10 bg-room-dark/25 text-warm-200/68'}`}
                    >
                      {language === 'pl' ? 'Polski' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="ink-card flex items-center justify-between gap-5 p-4 cursor-pointer">
                <span>
                  <span className="block text-warm-100/85 text-sm font-serif">{t('Quiet sounds', 'Ciche dźwięki')}</span>
                  <span className="block text-warm-200/62 text-[10px] font-serif mt-1">{t('Soft tones for touch, choices and waking.', 'Delikatne tony przy dotyku, wyborach i budzeniu.')}</span>
                </span>
                <input type="checkbox" checked={sensoryPreferences.sound} onChange={event => updateSensoryPreference('sound', event.target.checked)} className="accent-[#d8bd8f] w-5 h-5" />
              </label>
              <label className="ink-card flex items-center justify-between gap-5 p-4 cursor-pointer">
                <span>
                  <span className="block text-warm-100/85 text-sm font-serif">{t('Gentle haptics', 'Delikatne wibracje')}</span>
                  <span className="block text-warm-200/62 text-[10px] font-serif mt-1">{t('Tiny pulses on devices that support vibration.', 'Krótkie impulsy na urządzeniach obsługujących wibracje.')}</span>
                </span>
                <input type="checkbox" checked={sensoryPreferences.haptics} onChange={event => updateSensoryPreference('haptics', event.target.checked)} className="accent-[#d8bd8f] w-5 h-5" />
              </label>
              <div className="ink-card p-4">
                <div className="text-warm-100/85 text-sm font-serif">{t('Keep this creature', 'Zachowaj tego stworka')}</div>
                <p className="text-warm-200/62 text-[10px] font-serif mt-1 leading-relaxed">{t('A private file can carry the whole life, memories, chats and creations to another device. Nothing is uploaded.', 'Prywatny plik przeniesie całe życie, wspomnienia, rozmowy i prace na inne urządzenie. Nic nie jest wysyłane.')}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={exportCreature} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Save backup', 'Zapisz backup')}</button>
                  <button onClick={() => importInputRef.current?.click()} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Open backup', 'Otwórz backup')}</button>
                </div>
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importCreature(event.target.files?.[0])} />
                <p className="text-warm-200/62 text-[9px] font-serif mt-3">{t('The file contains personal conversations. Store it somewhere you trust.', 'Plik zawiera prywatne rozmowy. Przechowuj go w zaufanym miejscu.')}</p>
              </div>
              {onReset && (
                <div className="rounded-2xl border border-red-200/10 bg-room-mid/25 p-4">
                  <div className="text-warm-100/70 text-sm font-serif">{t('Begin another life', 'Zacznij inne życie')}</div>
                  <p className="text-warm-200/62 text-[10px] font-serif mt-1">{t('Save a backup first if you may want to return to this creature.', 'Najpierw zapisz backup, jeśli możesz chcieć wrócić do tego stworka.')}</p>
                  <button onClick={onReset} className="mt-3 min-h-11 w-full rounded-xl border border-red-200/15 px-3 py-2 text-red-100/55 text-xs font-serif active:scale-[0.98] transition-transform">{t('Start over', 'Zacznij od nowa')}</button>
                </div>
              )}
            </div>
            {backupStatus && <p className="text-center text-warm-100/55 text-[10px] font-serif mt-5">{backupStatus}</p>}
            <p className="text-center text-warm-200/58 text-[9px] font-serif mt-7">{t('Sensory choices stay only on this device.', 'Ustawienia dźwięku i wibracji zostają tylko na tym urządzeniu.')}</p>
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
