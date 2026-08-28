import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ObjectType, RoomObject, CreatureBehavior, MeaningfulFirst } from '../types';
import CreatureCanvas from './CreatureCanvas';
import ChatInterface from './ChatInterface';
import ObjectIcon from './ObjectIcon';
import GlyphIcon from './GlyphIcon';
import MemoryBookView from './MemoryBookView';
import BecomingView from './BecomingView';
import CareMark from './CareMark';
import WeatherControls from './WeatherControls';
import WeatherLayer from './WeatherLayer';
import {
  NEED_COPY,
  NEED_ORDER,
  applyNeedDelta,
  cleanRoomMess,
  getDominantNeed,
  getNeedAction,
  getNeedLabel,
  getNeedName,
  getNeedUrgency,
  getNaturalNeedCue,
  getSleepBlocker,
  getVisibleNeedSignals,
  touchCreature,
} from '../systems/needsSystem';
import {
  getDevelopmentDescription,
  getDevelopmentLabel,
  getPendingMeaningfulFirst,
  markMeaningfulFirstAnnounced,
  recordAutonomousMoment,
  recordMeaningfulFirst,
  updateDevelopment,
} from '../systems/developmentSystem';

import { shouldInitiateConversation, generateInitiatedTopic, clearInitiatedTopic } from '../systems/socialLearningSystem';
import {
  chooseObjectReaction,
  chooseAutonomousMoment,
  getBondDescription,
  getEmergingTraitLabels,
  getVisiblePersonalitySignature,
  recordBondEvent,
} from '../systems/relationshipSystem';
import {
  ensureDailyMoment,
  getLifePathClues,
  getLifePathDescription,
  getLifePathPhaseLabel,
  getLifePathTitle,
  getLifePathVisual,
  getRankedLifePaths,
  resolveDailyMoment,
} from '../systems/lifePathSystem';
import {
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
import { getCreationMastery } from '../systems/creationSystem';
import { parseImportedGameState, serializeGameState } from '../systems/persistence';
import { formatLearnedBehaviour, formatStoredMemory, getFactKindLabel, getOpenLoopKindLabel, uiLanguage, uiText } from '../systems/uiLanguage';
import { evaluateTouchBoundary } from '../systems/boundarySystem';
import { getAdoptedSharedPhrases } from '../systems/sharedLanguageSystem';
import { simulateOfflineTime } from '../systems/offlineSimulation';
import {
  formatLocalClock,
  getCircadianDisposition,
  getPhaseLabel,
  getRoomLighting,
  getTimeOfDay,
} from '../systems/timeSystem';
import {
  beginOutdoorVisit,
  chooseEnvironmentReaction,
  endOutdoorVisit,
  getWeatherConditionLabel,
  getWeatherIcon,
  INDOOR_RETURN_PLACE,
  OUTDOOR_COOLDOWN_MS,
  OUTDOOR_PLACE,
  outdoorVisitBlocked,
  recordEnvironmentReaction,
  shouldEndOutdoorVisit,
  wantsOutdoors,
  WINDOW_PLACE,
} from '../systems/environmentSystem';
import { appendCreatureMessage, beginConversationTurn } from '../systems/conversationSystem';
import { isLlmAvailable, requestCreatureReply, shouldCreatureSelfSpeak } from '../systems/llmConversation';
import {
  applyWorldObjectReaction,
  applyConversationMicroReaction,
  beginWorldObjectApproach,
  createRoomObject,
  groundedWorldReply,
  offerObjectFromInventory,
  parseWorldIntent,
  performImmediateWorldAction,
  resultFromObjectReaction,
  WorldActionResult,
  WorldIntent,
} from '../systems/worldActionSystem';

interface RoomProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onReset?: () => void;
  version?: string;
}

const objectLabels: Record<ObjectType, string> = {
  food_bowl: 'bowl',
  water_bowl: 'water bowl',
  litter_box: 'litter box',
  wash_basin: 'wash basin',
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
  water_bowl: 'miska z wodą',
  litter_box: 'kuweta',
  wash_basin: 'miska do mycia',
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
  if (type === 'water_bowl') return id.includes('drink') ? 'pije powoli i wyraźnie się rozluźnia' : 'bierze mały łyk wody';
  if (type === 'litter_box') return id.includes('use') ? 'korzysta z kuwety i starannie po sobie zakrywa' : 'sprawdza kuwetę, ale jeszcze jej nie potrzebuje';
  if (type === 'wash_basin') return id.includes('clean') ? 'zmywa plamki, łapka po łapce' : 'moczy jedną łapkę i uznaje, że wystarczy';
  if (id.includes('save')) return `wącha ${objectLabel(type, true)} i odkłada na później`;
  if (type === 'apple' || type === 'broccoli') return `siada i je: ${objectLabel(type, true)}`;
  if (type === 'ball') return id.includes('care-first') ? 'rusza do piłki, ale zatrzymuje się — najpierw potrzebuje opieki' : id.includes('tired') ? 'patrzy, jak piłka się toczy' : 'rzuca się za piłką i rozpoczyna zabawę';
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
  'water_bowl',
  'litter_box',
  'wash_basin',
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
  { id: 'care', english: 'Care', polish: 'Opieka', items: ['water_bowl', 'litter_box', 'wash_basin', 'apple', 'broccoli', 'blanket'] },
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

function chooseAutoPlacePosition(state: GameState) {
  return AUTO_PLACE_SLOTS.reduce((best, candidate) => {
    const nearestAtBest = state.roomObjects.length === 0 ? 100 : Math.min(...state.roomObjects.map(obj => dist(best, obj)));
    const nearestAtCandidate = state.roomObjects.length === 0 ? 100 : Math.min(...state.roomObjects.map(obj => dist(candidate, obj)));
    return nearestAtCandidate > nearestAtBest ? candidate : best;
  }, AUTO_PLACE_SLOTS[0]);
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

function urgencyLabel(urgency: ReturnType<typeof getNeedUrgency>, polish: boolean) {
  const labels = {
    settled: polish ? 'w normie' : 'settled',
    notice: polish ? 'sygnał' : 'notice',
    attention: polish ? 'wymaga uwagi' : 'attention',
    urgent: polish ? 'pilna' : 'urgent',
  };
  return labels[urgency];
}

function urgencyColor(urgency: ReturnType<typeof getNeedUrgency>) {
  if (urgency === 'urgent') return '#e39a82';
  if (urgency === 'attention') return '#d6b276';
  if (urgency === 'notice') return '#b9b394';
  return '#8fa695';
}

const Room: React.FC<RoomProps> = ({ state, onStateChange, onReset, version }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const artBase = import.meta.env.BASE_URL;
  const [roomInput, setRoomInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [mindState, setMindState] = useState<'ready' | 'connecting' | 'online' | 'instinct'>('ready');
  const [speechFresh, setSpeechFresh] = useState(true);
  const [microBehavior, setMicroBehavior] = useState<CreatureBehavior | null>(null);
  const [microFacing, setMicroFacing] = useState<'left' | 'right' | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [showBecoming, setShowBecoming] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [showNeeds, setShowNeeds] = useState(false);
  const [inventoryGroupId, setInventoryGroupId] = useState('care');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [sensoryPreferences, setSensoryPreferences] = useState<SensoryPreferences>(() => loadSensoryPreferences());
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [creatureEmotion, setCreatureEmotion] = useState(state.emotionalState);
  const [initiatedTopic, setInitiatedTopic] = useState<string | null>(null);
  const [creatureCue, setCreatureCue] = useState<CreatureCue | null>(null);
  const [momentResult, setMomentResult] = useState<string | null>(null);
  const [firstMoment, setFirstMoment] = useState<MeaningfulFirst | null>(null);
  const [careEffect, setCareEffect] = useState<CareRitualEffect>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

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
  const speechFadeRef = useRef<ReturnType<typeof setTimeout>>();
  const microReactionTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const initiateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const activityTimerRef = useRef<ReturnType<typeof setInterval>>();
  const momentResultTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const firstMomentTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const returnTraceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const careEffectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastCareSignalRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const lastSelfSpeakAtRef = useRef(0);
  const selfSpeakInFlightRef = useRef(false);
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
    const updateClock = () => setClockNow(Date.now());
    const interval = setInterval(updateClock, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateClock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const greeting = state.presence.pendingGreeting;
    if (!greeting || state.presence.pendingTrace || initiatedTopic || showChat || state.sleepState === 'sleeping') return;
    setInitiatedTopic(greeting);
    onStateChange(prev => appendCreatureMessage(consumeReturnGreeting(prev), greeting));
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
      const parsed = parseImportedGameState(await file.text());
      const now = Date.now();
      const awayMs = Math.max(0, now - parsed.lastSaved);
      const imported = awayMs >= 60_000
        ? simulateOfflineTime(parsed, awayMs, now).state
        : { ...parsed, needsUpdatedAt: now, lastSaved: now };
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

  const triggerSpeech = useCallback((text: string, remember = true) => {
    if (!text.trim()) return;
    lastSpeechAtRef.current = Date.now();
    setSpeechFresh(true);
    clearTimeout(speechFadeRef.current);
    speechFadeRef.current = setTimeout(() => setSpeechFresh(false), 7000);
    onStateChange(prev => remember
      ? appendCreatureMessage(prev, text)
      : {
          ...prev,
          conversation: {
            ...prev.conversation,
            lastCreatureMessage: text,
            lastConversationAt: Date.now(),
          },
        });
  }, [onStateChange]);

  useEffect(() => {
    if (!state.conversation.lastCreatureMessage) return;
    setSpeechFresh(true);
    clearTimeout(speechFadeRef.current);
    speechFadeRef.current = setTimeout(() => setSpeechFresh(false), 7000);
    return () => clearTimeout(speechFadeRef.current);
  }, [state.conversation.lastCreatureMessage]);

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
    worldIntent?: WorldIntent,
    onWorldResult?: (result: WorldActionResult) => void,
  ) => {
    setIsMoving(false);

    const reaction = chooseObjectReaction(stateRef.current, type);
    const localizedReaction = reactionLabel(reaction.id, type, reaction.label, polish);
    const reactionDuration = reaction.duration;
    const reactionEmotion = reaction.emotion;
    onStateChange(prev => applyWorldObjectReaction(prev, objectId, reaction, target, localizedReaction, initiatedByUser));

    behaviorRef.current = reaction.behavior;
    showCreatureCue({ icon: reaction.icon, label: localizedReaction, tone: 'reaction' }, reactionDuration);
    setTemporaryEmotion(reactionEmotion, reactionDuration);
    if (worldIntent && onWorldResult) {
      const object = stateRef.current.roomObjects.find(item => item.id === objectId) ?? {
        id: objectId, type, x: target.x, y: target.y, state: {}, interactions: 0, placedByUser: true, beingUsedByCreature: true,
      };
      const result = resultFromObjectReaction(worldIntent, object, reaction.outcome, Boolean(reaction.consumes));
      window.setTimeout(() => onWorldResult(result), 520);
    }

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

  const beginObjectInteraction = useCallback((
    object: RoomObject,
    initiatedByUser = true,
    autonomousMomentId?: Parameters<typeof recordAutonomousMoment>[1],
    worldIntent?: WorldIntent,
    onWorldResult?: (result: WorldActionResult) => void,
  ) => {
    const currentState = stateRef.current;
    if (currentState.sleepState === 'sleeping') return;
    if (currentState.world.place === 'outdoors') {
      const ended = endOutdoorVisit(currentState);
      stateRef.current = ended;
      onStateChange(ended);
    }

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
    const { target } = beginWorldObjectApproach({ ...currentState, position: currentPos }, object);
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
        ...beginWorldObjectApproach(prev, object).state,
        currentActivity: polish ? `podchodzi do ${objectLabel(object.type, true)}` : `approaching the ${objectLabel(object.type, false)}`,
      }));

      movementTimerRef.current = setTimeout(() => {
        if (activeObjectRef.current === object.id) {
          finishObjectInteraction(object.id, object.type, target, initiatedByUser, worldIntent, onWorldResult);
        }
      }, travelTime);
    }, noticeDelay);
  }, [clearActionTimers, finishObjectInteraction, onStateChange, polish, setTemporaryEmotion, showCreatureCue]);

  const walkToIdlePosition = useCallback((targetInput: { x: number; y: number }, options?: { outdoors?: boolean }) => {
    if (activeObjectRef.current || stateRef.current.sleepState === 'sleeping') return;
    clearTimeout(movementTimerRef.current);
    const currentPos = creaturePosRef.current;
    const target = options?.outdoors
      ? { x: Math.max(12, Math.min(88, targetInput.x)), y: Math.max(36, Math.min(78, targetInput.y)) }
      : clampToWalkable(targetInput);
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
    const now = Date.now();
    const needSignal = getVisibleNeedSignals(currentState, 1)[0];
    const needMoment = needSignal && (needSignal.urgency === 'urgent' || needSignal.urgency === 'attention') ? {
      icon: needSignal.icon,
      label: getNaturalNeedCue(currentState, polish, needSignal.key),
      tone: 'notice' as const,
      behavior: (needSignal.key === 'stimulation' ? 'investigating' : needSignal.key === 'hunger' || needSignal.key === 'hydration' ? 'observing' : 'reacting') as CreatureBehavior,
      emotion: needSignal.urgency === 'urgent' ? 'uncertain' : 'neutral',
      duration: needSignal.urgency === 'urgent' ? 3400 : 2800,
    } : null;
    const weatherReaction = needMoment ? null : chooseEnvironmentReaction(currentState, ui, now);
    const environmentMoment = weatherReaction ? {
      icon: weatherReaction.icon,
      label: weatherReaction.label,
      tone: 'ambient' as const,
      behavior: weatherReaction.behavior,
      emotion: weatherReaction.emotion,
      duration: weatherReaction.duration,
    } : null;
    const worldMoment = needMoment ?? environmentMoment;
    if (worldMoment) {
      behaviorRef.current = worldMoment.behavior;
      setTemporaryEmotion(worldMoment.emotion, worldMoment.duration);
      showCreatureCue(worldMoment, worldMoment.duration);
      onStateChange(prev => {
        let next: GameState = { ...prev, creatureBehavior: worldMoment.behavior, currentActivity: worldMoment.label };
        if (weatherReaction && worldMoment === environmentMoment) {
          next = applyNeedDelta(next, weatherReaction.needDelta, now);
          next = recordEnvironmentReaction(next, weatherReaction, now);
        }
        return next;
      });
      ambientTimerRef.current = setTimeout(() => {
        if (behaviorRef.current !== worldMoment.behavior) return;
        behaviorRef.current = 'idle';
        onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
      }, worldMoment.duration);
      return;
    }

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
    onStateChange(prev => ({ ...prev, creatureBehavior: moment.behavior, currentActivity: label }));
    ambientTimerRef.current = setTimeout(() => {
      if (activeObjectRef.current || behaviorRef.current !== moment.behavior) return;
      behaviorRef.current = 'idle';
      onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
    }, moment.duration);
  }, [beginObjectInteraction, onStateChange, polish, setTemporaryEmotion, showCreatureCue, triggerSpeech, ui, walkToIdlePosition]);

  // Intentional autonomous behaviour. The interval only chooses a new goal
  // while the creature is idle; user-selected objects always take priority.
  useEffect(() => {
    if (state.sleepState === 'sleeping') {
      clearActionTimers();
      clearTimeout(speechFadeRef.current);
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

      if (currentState.world.place === 'outdoors') {
        if (shouldEndOutdoorVisit(currentState, Date.now())) {
          const ended = endOutdoorVisit(currentState, Date.now());
          stateRef.current = ended;
          onStateChange(ended);
          walkToIdlePosition(INDOOR_RETURN_PLACE);
        }
        return;
      }

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
      if (currentState.needs.hydration < 48) goal = closestOfType(['water_bowl']);
      if (!goal && (currentState.needs.bladder < 48 || currentState.needs.bowel < 48)) goal = closestOfType(['litter_box']);
      if (!goal && currentState.needs.hunger < 48) goal = closestOfType(['apple', 'broccoli']);
      if (!goal && currentState.needs.hygiene < 48) goal = closestOfType(['wash_basin']);
      const disposition = getCircadianDisposition(getTimeOfDay(Date.now(), currentState.world), currentState.needs.energy, false);
      if (!goal && (currentState.needs.energy < 40 || disposition === 'ready_to_sleep')) goal = closestOfType(['blanket']);
      if (!goal && currentState.needs.comfort < 48) goal = closestOfType(['blanket']);
      if (!goal && currentState.needs.stimulation < 48 && (disposition === 'active' || currentState.needs.stimulation < 25)) goal = closestOfType(['ball']);

      // Weather first suggests a place in the room; only after arriving can
      // the normal ambient loop show the individual reaction. This keeps the
      // chain visible: outside stimulus → choice of place → body language.
      if (!goal) {
        const environmentReaction = chooseEnvironmentReaction(currentState, ui, Date.now());
        if (environmentReaction?.positionHint) {
          const blanket = currentState.roomObjects.find(object => object.type === 'blanket');
          const environmentTarget = environmentReaction.positionHint === 'window'
            ? { x: 50, y: 50 }
            : environmentReaction.positionHint === 'shelter'
              ? { x: 24, y: 65 }
              : environmentReaction.positionHint === 'warm'
                ? blanket ? { x: blanket.x + (blanket.x < 50 ? 9 : -9), y: blanket.y } : { x: 34, y: 69 }
                : { x: 73, y: 71 };
          if (dist(currentPos, environmentTarget) > 8) {
            walkToIdlePosition(environmentTarget);
            return;
          }
        }
        if (wantsOutdoors(currentState) && !outdoorVisitBlocked(currentState) && Date.now() - (currentState.world.lastOutdoorAt || 0) > OUTDOOR_COOLDOWN_MS) {
          if (dist(currentPos, WINDOW_PLACE) > 8) {
            walkToIdlePosition(WINDOW_PLACE);
            return;
          }
          const visit = beginOutdoorVisit(currentState, Date.now());
          stateRef.current = visit;
          onStateChange(visit);
          walkToIdlePosition(OUTDOOR_PLACE, { outdoors: true });
          return;
        }
      }

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
  }, [beginObjectInteraction, clearActionTimers, onStateChange, polish, setTemporaryEmotion, showCare, showChat, showCreatureCue, showInventory, startAmbientMoment, state.sleepState, ui, walkToIdlePosition]);

  useEffect(() => () => {
    clearActionTimers();
    clearTimeout(emotionTimerRef.current);
    clearTimeout(speechFadeRef.current);
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

  // Rare DeepSeek self-speak on the existing room cadence. No extra heartbeat.
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = stateRef.current;
      if (showChat || showCare || activeObjectRef.current || currentState.sleepState === 'sleeping') return;
      if (behaviorRef.current !== 'idle' || selfSpeakInFlightRef.current) return;
      if (!isLlmAvailable()) return;
      if (Date.now() - lastSpeechAtRef.current < 90_000) return;
      if (Date.now() - lastSelfSpeakAtRef.current < 180_000) return;
      if (!shouldCreatureSelfSpeak(currentState)) return;
      selfSpeakInFlightRef.current = true;
      lastSelfSpeakAtRef.current = Date.now();
      void requestCreatureReply(currentState, { kind: 'self' })
        .then(text => {
          if (text.trim()) triggerSpeech(text);
        })
        .catch(() => {})
        .finally(() => {
          selfSpeakInFlightRef.current = false;
        });
    }, 8000 + Math.random() * 10000);
    return () => clearInterval(interval);
  }, [showChat, showCare, triggerSpeech]);

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
            onStateChange(prev => appendCreatureMessage(clearInitiatedTopic(prev, topic.observationId), topic.openingLine, Date.now(), { roomBubble: false }));
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
    const boundary = evaluateTouchBoundary(stateRef.current, 'tap');
    if (!boundary.accepted) {
      showCreatureCue({ icon: '·', label: boundary.label || t('needs a moment', 'potrzebuje chwili'), tone: 'notice' }, 2600);
      setTemporaryEmotion('uncertain', 2800);
      onStateChange(boundary.state);
      return;
    }
    showCreatureCue({ icon: '?', label: t('notices your touch', 'zauważa twój dotyk'), tone: 'notice' }, 1600);
    const updated = recordBondEvent(touchCreature(boundary.state, 'tap'), 'tap');
    setTemporaryEmotion('curious', 2000);
    onStateChange(updated);
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t, triggerSpeech]);

  const handleStrokeCreature = useCallback(() => {
    emitCue('comfort');
    const boundary = evaluateTouchBoundary(stateRef.current, 'stroke');
    if (!boundary.accepted) {
      showCreatureCue({ icon: '·', label: boundary.label || t('needs a moment', 'potrzebuje chwili'), tone: 'notice' }, 2600);
      setTemporaryEmotion('uncertain', 2800);
      onStateChange(boundary.state);
      return;
    }
    showCreatureCue({ icon: '♡', label: t('leans into your hand', 'przysuwa się do twojej dłoni'), tone: 'reaction' }, 2400);
    const updated = recordBondEvent(touchCreature(boundary.state, 'stroke'), 'stroke');
    setTemporaryEmotion('happy', 3000);
    onStateChange(updated);
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t, triggerSpeech]);

  const handleHoldStart = useCallback(() => {}, []);

  const handleHoldEnd = useCallback(() => {
    emitCue('comfort');
    const boundary = evaluateTouchBoundary(stateRef.current, 'hold');
    if (!boundary.accepted) {
      showCreatureCue({ icon: '·', label: boundary.label || t('not yet', 'jeszcze nie'), tone: 'notice' }, 2800);
      setTemporaryEmotion('uncertain', 3000);
      onStateChange(boundary.state);
      return;
    }
    showCreatureCue({ icon: '♡', label: t('settles close', 'układa się blisko'), tone: 'reaction' }, 2600);
    const updated = recordBondEvent(touchCreature(boundary.state, 'hold'), 'hold');
    setTemporaryEmotion('happy', 3000);
    onStateChange(updated);
  }, [emitCue, onStateChange, setTemporaryEmotion, showCreatureCue, t]);

  // ========== OBJECT INPUT ==========
  // A short press places/uses an object. A moved pointer repositions it. This
  // keeps the primary interaction reliable on phones without removing drag.
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
      chosenPosition = chooseAutoPlacePosition(currentState);
    }

    const object = createRoomObject(type, clampObjectPosition(chosenPosition));
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
    const now = Date.now();
    const execution = performImmediateWorldAction(stateRef.current, { kind: 'toilet', objectType: 'litter_box' }, now);
    if (execution.result.status === 'blocked') {
      showCreatureCue({ icon: '·', label: t('is sleeping too deeply right now', 'teraz śpi zbyt mocno'), tone: 'ambient' }, 2400);
      return;
    }
    if (execution.result.status === 'already_satisfied') {
      setShowCare(false);
      showCreatureCue({ icon: '·', label: t('does not need the toilet right now', 'teraz nie potrzebuje toalety'), tone: 'ambient' }, 2600);
      return;
    }

    clearActionTimers();
    setShowCare(false);
    emitCue('toilet');
    showCareEffect('toilet', 3300);
    const activity = execution.result.reason === 'both'
      ? t('takes a proper bathroom break', 'załatwia wszystko w spokojnym kącie')
      : execution.result.reason === 'poop'
        ? t('uses the toilet and looks relieved', 'robi kupę w toalecie i wyraźnie odczuwa ulgę')
        : t('uses the toilet and relaxes', 'robi siku w toalecie i od razu się rozluźnia');
    behaviorRef.current = 'toileting';
    setTemporaryEmotion('happy', 3300);
    showCreatureCue({ icon: '○', label: activity, tone: 'reaction' }, 3200);
    onStateChange({ ...execution.state, emotionalState: 'neutral', creatureBehavior: 'toileting', currentActivity: activity });
    finishCareAnimation('toileting', 3300);
  };

  const handleWash = () => {
    const execution = performImmediateWorldAction(stateRef.current, { kind: 'wash', objectType: 'wash_basin' });
    if (execution.result.status === 'blocked') {
      showCreatureCue({ icon: '·', label: t('can be washed after waking', 'można go umyć po obudzeniu'), tone: 'ambient' }, 2400);
      return;
    }
    if (execution.result.status === 'already_satisfied') {
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
    onStateChange({ ...execution.state, emotionalState: 'neutral', creatureBehavior: 'washing', currentActivity: activity });
    finishCareAnimation('washing', 3500);
  };

  const handleCleanMess = (messId?: string) => {
    const direct = messId ? cleanRoomMess(stateRef.current, messId) : null;
    const execution = direct
      ? { state: direct.state, result: { intent: { kind: 'clean' as const }, status: direct.performed ? 'success' as const : 'already_satisfied' as const, reason: direct.result } }
      : performImmediateWorldAction(stateRef.current, { kind: 'clean' });
    if (execution.result.status === 'already_satisfied') {
      setShowCare(false);
      showCreatureCue({ icon: '·', label: t('the room is already clean', 'pokój jest już czysty'), tone: 'ambient' }, 2400);
      return;
    }
    emitCue('clean');
    showCareEffect('clean', 2700);
    setShowCare(false);
    showCreatureCue({ icon: '◇', label: messId ? t('the floor is clean again', 'podłoga znów jest czysta') : t('the room feels clear again', 'w pokoju znów jest czysto'), tone: 'reaction' }, 2600);
    const cleaned = execution.state.roomMess.length === 0 ? { ...execution.state, emotionalState: 'neutral' } : execution.state;
    onStateChange(messId ? recordBondEvent(cleaned, 'care') : cleaned);
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
    const intent: WorldIntent = { kind: state.sleepState === 'sleeping' ? 'wake' : 'sleep' };
    const execution = performImmediateWorldAction(stateRef.current, intent);
    if (execution.result.status === 'blocked') {
      const blocker = getSleepBlocker(stateRef.current);
      if (blocker) {
        showCreatureCue({ icon: NEED_COPY[blocker].icon, label: getNaturalNeedCue(state, polish, blocker), tone: 'notice' }, 3400);
        setTemporaryEmotion('uncertain', 3200);
        return;
      }
    }
    if (execution.result.status === 'refused') {
      showCreatureCue({ icon: '·', label: t('is not sleepy yet', 'jeszcze nie jest senny'), tone: 'notice' }, 2800);
      return;
    }
    onStateChange(execution.state);
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

  const completeWorldAction = useCallback((result: WorldActionResult) => {
    triggerSpeech(groundedWorldReply(result, ui));
  }, [triggerSpeech, ui]);

  const offerAndApproach = useCallback((intent: WorldIntent, type: ObjectType) => {
    const offered = offerObjectFromInventory(stateRef.current, type, chooseAutoPlacePosition(stateRef.current));
    if (offered.result.status === 'unavailable' || !offered.result.objectId) {
      completeWorldAction(offered.result);
      return;
    }
    stateRef.current = offered.state;
    onStateChange(offered.state);
    const object = offered.state.roomObjects.find(item => item.id === offered.result.objectId);
    if (!object) {
      completeWorldAction({ ...offered.result, status: 'unavailable' });
      return;
    }
    showCreatureCue({ icon: '!', label: polish ? `zauważa: ${objectLabel(type, true)}` : `notices the ${objectLabel(type, false)}`, tone: 'notice' });
    window.setTimeout(() => beginObjectInteraction(object, true, undefined, intent, completeWorldAction), 180);
  }, [beginObjectInteraction, completeWorldAction, onStateChange, polish, showCreatureCue]);

  const runWorldIntent = useCallback((intent: WorldIntent) => {
    if (intent.kind === 'offer_object' && intent.objectType) {
      offerAndApproach(intent, intent.objectType);
      return;
    }

    if (intent.kind === 'use_object' || intent.kind === 'drink') {
      const desiredType = intent.kind === 'drink' ? 'water_bowl' : intent.objectType;
      const object = desiredType
        ? stateRef.current.roomObjects.find(item => item.type === desiredType)
        : stateRef.current.roomObjects.find(item => item.type === 'apple' || item.type === 'broccoli');
      if (object) {
        beginObjectInteraction(object, true, undefined, intent, completeWorldAction);
        return;
      }
      const inventoryType = desiredType ?? stateRef.current.inventory.find(item => item === 'apple' || item === 'broccoli');
      if (inventoryType) {
        offerAndApproach(intent, inventoryType);
        return;
      }
      completeWorldAction({ intent, status: 'unavailable', objectType: desiredType });
      return;
    }

    if (intent.kind === 'come_here') {
      if (stateRef.current.sleepState === 'sleeping') {
        completeWorldAction({ intent, status: 'blocked', reason: 'sleeping' });
        return;
      }
      if (stateRef.current.world.place === 'outdoors') {
        const ended = endOutdoorVisit(stateRef.current);
        stateRef.current = ended;
        onStateChange(ended);
      }
      const target = clampToWalkable({ x: 50, y: 74 });
      walkToIdlePosition(target);
      window.setTimeout(() => completeWorldAction({ intent, status: 'success' }), 1100);
      return;
    }

    const execution = performImmediateWorldAction(stateRef.current, intent);
    stateRef.current = execution.state;
    onStateChange(execution.state);

    if (execution.result.status === 'success' && intent.kind === 'go_outside') {
      walkToIdlePosition(OUTDOOR_PLACE, { outdoors: true });
    }
    if (execution.result.status === 'success' && intent.kind === 'come_inside') {
      walkToIdlePosition(INDOOR_RETURN_PLACE);
    }

    if (execution.result.status === 'success') {
      if (intent.kind === 'toilet') {
        emitCue('toilet');
        showCareEffect('toilet', 3300);
        setMicroBehavior('toileting');
      } else if (intent.kind === 'wash') {
        emitCue('wash');
        showCareEffect('wash', 3500);
        setMicroBehavior('washing');
      } else if (intent.kind === 'clean') {
        emitCue('clean');
        showCareEffect('clean', 2700);
      } else if (intent.kind === 'sleep') {
        emitCue('sleep');
      } else if (intent.kind === 'wake') {
        emitCue('wake');
      }
    } else if (execution.result.status === 'refused' || execution.result.status === 'blocked') {
      setTemporaryEmotion('uncertain', 2600);
    }
    window.setTimeout(() => completeWorldAction(execution.result), execution.result.status === 'success' ? 520 : 120);
  }, [beginObjectInteraction, completeWorldAction, emitCue, offerAndApproach, onStateChange, setTemporaryEmotion, showCareEffect, walkToIdlePosition]);

  const sendConversationMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isThinking) return;

    const intent = parseWorldIntent(text);
    const turn = beginConversationTurn(stateRef.current, text, Date.now(), { worldAction: Boolean(intent) });
    stateRef.current = turn.state;
    onStateChange(turn.state);

    if (intent) {
      // The object pipeline owns notice → walk → react. A generic conversation
      // micro-reaction used to mask its walking body language for 2.4 seconds.
      clearTimeout(microReactionTimerRef.current);
      setMicroBehavior(null);
      setMicroFacing(null);
      setShowChat(false);
      runWorldIntent(intent);
      return;
    }

    const micro = applyConversationMicroReaction(turn.state, text);
    setMicroBehavior(micro.behavior);
    if (micro.object) setMicroFacing(micro.object.x >= creaturePosRef.current.x ? 'right' : 'left');
    setTemporaryEmotion(micro.emotion, 2400);
    clearTimeout(microReactionTimerRef.current);
    microReactionTimerRef.current = setTimeout(() => {
      setMicroBehavior(null);
      setMicroFacing(null);
    }, 2400);

    setIsThinking(true);
    setMindState('connecting');
    try {
      const reply = await requestCreatureReply(turn.state);
      triggerSpeech(reply);
      setMindState('online');
    } catch (error) {
      console.warn('AI reply unavailable; no substitute line.', error);
      setMindState('ready');
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, onStateChange, runWorldIntent, setTemporaryEmotion, triggerSpeech]);

  const handleRoomSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = roomInput.trim();
    if (!message) return;
    setRoomInput('');
    void sendConversationMessage(message);
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
  const learnedWeatherPreferences = (Object.keys(state.world.preferences) as Array<keyof typeof state.world.preferences>)
    .map(condition => ({ condition, preference: state.world.preferences[condition] }))
    .filter(({ preference }) => preference.exposures >= 2 && Math.abs(preference.affinity) >= 3)
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
  const outdoors = state.world.place === 'outdoors';
  const timeOfDay = getTimeOfDay(clockNow, state.world);
  const lighting = getRoomLighting(timeOfDay, state.world, clockNow);
  const visibleNeedSignals = getVisibleNeedSignals(state, 3);
  const dominantNeed = getDominantNeed(state, true);
  const weatherActive = state.world.settings.mode === 'device' || state.world.settings.mode === 'city';
  const weatherSummary = weatherActive && state.world.current
    ? `${getWeatherConditionLabel(state.world.current.condition, ui)}, ${Math.round(state.world.current.temperatureC)}°`
    : null;
  const roomSpeech = state.conversation.lastCreatureMessage;

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
      <div
        className="absolute inset-0"
        style={{
          filter: `brightness(${lighting.brightness * (state.sleepState === 'sleeping' ? 0.82 : 1)})`,
          transition: 'filter 1800ms ease, opacity 900ms ease',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[66%] transition-opacity duration-700" style={{ background: `linear-gradient(180deg, ${lighting.wallTop} 0%, ${lighting.wallBottom} 82%, ${lighting.floorBottom} 100%)`, transition: 'background 30s linear, opacity 900ms ease', opacity: outdoors ? 0.28 : 1 }} />
        <div
          className="absolute inset-x-0 top-0 h-[58%] pointer-events-none"
          style={{
            opacity: lighting.starOpacity,
            backgroundImage: 'radial-gradient(circle at 18% 24%, rgba(240,230,210,.65) 0 1px, transparent 1.5px), radial-gradient(circle at 68% 16%, rgba(215,226,238,.55) 0 1px, transparent 1.5px), radial-gradient(circle at 82% 38%, rgba(240,230,210,.5) 0 1px, transparent 1.5px)',
            backgroundSize: '96px 84px, 128px 110px, 154px 132px',
            transition: 'opacity 30s linear',
          }}
        />
        <div className="absolute top-[11%] left-[13%] right-[13%] h-px bg-warm-200/5" />
        <div className="absolute top-[11%] bottom-[34%] left-[13%] w-px bg-warm-200/5" />
        <div className="absolute top-[11%] bottom-[34%] right-[13%] w-px bg-warm-200/5" />
        <div className="absolute bottom-0 left-0 right-0 h-[35%] transition-opacity duration-700" style={{ background: `linear-gradient(180deg, ${lighting.floorTop} 0%, ${lighting.floorBottom} 100%)`, transition: 'background 30s linear, opacity 900ms ease', opacity: outdoors ? 0.22 : 1 }} />
        <div className="absolute top-[64.7%] left-0 right-0 h-[2px] bg-[#100f0d]/70 shadow-[0_-1px_0_rgba(224,203,176,0.05)] transition-opacity duration-700" style={{ opacity: outdoors ? 0.15 : 1 }} />
        <div className="absolute bottom-0 left-0 right-0 h-[35%] opacity-25" style={{ background: 'repeating-linear-gradient(102deg, transparent 0 46px, rgba(8,7,6,.45) 47px 49px)', opacity: outdoors ? 0.06 : 0.25 }} />
        <WeatherLayer world={state.world} lighting={lighting} time={timeOfDay} seed={state.identity.seed} now={clockNow} expanded={outdoors} />
        <div className="absolute top-[16%] left-[50%] w-[390px] h-[390px] -translate-x-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${lighting.ambientGlow} 0%, transparent 70%)`, transition: 'background 30s linear' }} />
        <div className="absolute inset-0 transition-colors duration-[1800ms]" style={{ background: pathVisual.roomTint }} />
        <div className="absolute inset-0" style={{ background: lighting.veil, transition: 'background 30s linear' }} />
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
          className="absolute z-20 select-none p-3 -m-3 bg-transparent border-0 transition-opacity duration-700"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
            cursor: 'grab',
            touchAction: 'none',
            opacity: draggingObjectId === obj.id ? 0.25 : outdoors ? 0.28 : 1,
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
          creatureBehavior: microBehavior ?? state.creatureBehavior,
          position: creaturePos,
          facing: microFacing ?? (creaturePos.x > state.position.x ? 'right' : creaturePos.x < state.position.x ? 'left' : state.facing),
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
      {roomSpeech && (
        <button
          type="button"
          onClick={initiatedTopic ? handleOpenChatWithTopic : handleOpenChat}
          aria-label={t('Open conversation history', 'Otwórz historię rozmowy')}
          className={`room-speech absolute -translate-x-1/2 -translate-y-full animate-fade-in z-40 transition-all duration-700 ${speechFresh ? 'is-fresh' : 'is-settled'}`}
          style={{ left: `${Math.max(30, Math.min(70, creaturePos.x))}%`, top: `${Math.max(18, creaturePos.y - 19)}%` }}
        >
          <div className="relative bg-warm-100/90 text-room-dark px-4 py-2 rounded-2xl text-sm font-serif shadow-lg backdrop-blur-sm max-w-[min(240px,72vw)] text-center">
            {roomSpeech}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-warm-100/90 rotate-45" />
          </div>
        </button>
      )}

      {returnTrace && !showChat && !showMemoryBook && !showBecoming && !showCare && (
        <div className="absolute left-4 right-4 bottom-36 z-40 pointer-events-none animate-fade-in" aria-live="polite">
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
        <div className="absolute left-5 right-5 bottom-36 z-40 pointer-events-none animate-cue-pop" aria-live="polite">
          <div className="max-w-sm mx-auto rounded-[1.2rem_.4rem_1.2rem_1.2rem] border border-[#c7a66c]/20 bg-[#1b1f18]/96 px-4 py-3 shadow-2xl">
            <p className="eyebrow text-[#c7a66c]/58">{t('A first, quietly kept', 'Pierwszy raz, cicho zachowany')}</p>
            <p className="display-title text-[#ece8da]/92 text-base mt-1.5">{polish ? firstMoment.titlePl : firstMoment.titleEn}</p>
            <p className="text-[#d8d2bf]/62 text-[10px] font-serif leading-relaxed mt-1">{polish ? firstMoment.detailPl : firstMoment.detailEn}</p>
          </div>
        </div>
      )}

      {/* The safe area and header are one real layout block. Controls below it
          can no longer slide underneath a mobile status bar or notch. */}
      <header className="room-header relative z-30 safe-top px-4 pb-3">
        <div className="flex justify-between items-start">
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
        <button
          type="button"
          onClick={() => setShowNeeds(true)}
          aria-label={`${t('Open care and needs', 'Otwórz opiekę i potrzeby')}${weatherSummary ? ` · ${weatherSummary}` : ''}`}
          className="mx-auto mt-1 flex min-h-9 w-full max-w-md items-center gap-2 rounded-full border border-warm-200/10 bg-room-dark/68 px-3 py-1.5 text-left shadow-lg backdrop-blur-md transition-colors hover:bg-room-dark/82"
        >
          <span className="shrink-0 whitespace-nowrap text-[9px] font-serif uppercase tracking-[0.13em] text-warm-200/50">
            {getPhaseLabel(timeOfDay.phase, ui)} · {formatLocalClock(timeOfDay)}
          </span>
          {weatherSummary && state.world.current && (
            <span className={`shrink-0 whitespace-nowrap text-[9px] font-serif text-warm-200/48 ${state.world.status === 'stale' || state.world.lastError ? 'opacity-55' : ''}`} title={weatherSummary}>
              <span aria-hidden="true">{getWeatherIcon(state.world.current.condition)}</span> {Math.round(state.world.current.temperatureC)}°
            </span>
          )}
          <span className="h-3 w-px shrink-0 bg-warm-200/10" />
          {visibleNeedSignals.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              {visibleNeedSignals.map(signal => (
                <span key={signal.key} className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] font-serif" style={{ color: urgencyColor(signal.urgency) }}>
                  <span aria-hidden="true">{signal.icon}</span>
                  <span className="max-w-[5.7rem] truncate">{getNeedLabel(signal.key, polish)}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="truncate text-[10px] font-serif italic text-warm-200/45">
              {t('all is calm', 'wszystko spokojne')}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-warm-200/30" aria-hidden="true">⌄</span>
        </button>
      </header>

      {/* Daily moments are small dilemmas, not quests. Their choice changes
          the creature's path and becomes a remembered event. */}
      {state.lifePath.pendingMoment && !showChat && !showMemoryBook && !showBecoming && !showCare && state.sleepState !== 'sleeping' && (
        <div className="absolute left-4 right-4 bottom-36 z-40 animate-slide-up">
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
        <div className="absolute left-5 right-5 bottom-36 z-40 pointer-events-none animate-cue-pop">
          <div className="max-w-sm mx-auto rounded-2xl border border-warm-300/20 bg-room-mid/94 backdrop-blur-xl px-4 py-3 text-center shadow-2xl">
            <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/45">{t('This became a memory', 'To stało się wspomnieniem')}</p>
            <p className="text-warm-100/85 text-xs font-serif leading-relaxed mt-1">{momentResult}</p>
          </div>
        </div>
      )}

      {/* Ordinary conversation happens in the room. History expands only when
          the player asks for it. */}
      <div className="room-conversation-zone absolute bottom-0 left-0 right-0 safe-bottom px-3 pb-2 z-30">
        <form onSubmit={handleRoomSubmit} className="room-conversation-bar mx-auto flex w-full max-w-md items-center gap-1.5 rounded-[1.25rem] p-1.5">
          <input
            value={roomInput}
            onChange={event => setRoomInput(event.target.value.slice(0, 500))}
            placeholder={polish ? `Powiedz coś ${state.identity.name || 'stworkowi'}…` : `Say something to ${state.identity.name || 'the creature'}…`}
            aria-label={t('Your message to the creature', 'Twoja wiadomość do stworka')}
            disabled={isThinking}
            className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-serif text-warm-100 placeholder:text-warm-200/38 focus:outline-none"
          />
          <button type="button" onClick={handleOpenChat} aria-label={t('Open conversation history', 'Otwórz historię rozmowy')} title={t('Conversation history', 'Historia rozmowy')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-warm-200/55 hover:text-warm-100">
            <GlyphIcon name="chat" size={19} />
          </button>
          <button type="submit" disabled={!roomInput.trim() || isThinking} aria-label={t('Send', 'Wyślij')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warm-100 text-room-dark transition-all active:scale-95 disabled:opacity-30">
            <GlyphIcon name="send" size={19} />
          </button>
        </form>
        <nav className="room-dock mx-auto mt-1.5 flex w-fit items-center gap-1 rounded-[1.7rem] px-1.5 py-1" aria-label={t('Room actions', 'Działania w pokoju')}>
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
          <button aria-label={t('Open things', 'Otwórz rzeczy')} title={t('Things', 'Rzeczy')} aria-expanded={showInventory} onClick={() => { setShowCare(false); setShowInventory(current => !current); }} className={`dock-action ${showInventory ? 'bg-[#ece8da] !text-[#171913]' : ''}`}>
            <GlyphIcon name="shelf" size={22} />
          </button>
        </nav>
      </div>

      {showCare && (
        <section className="care-sheet absolute bottom-36 left-3 right-3 z-40 mx-auto max-w-md animate-slide-up" aria-label={t('Daily care', 'Codzienna opieka')}>
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
        <div ref={inventoryTrayRef} className="absolute bottom-36 left-3 right-3 rounded-[1.4rem] border border-white/[.09] bg-[#181b15]/[.98] p-4 shadow-[0_24px_70px_rgba(0,0,0,.58)] z-40 animate-slide-up">
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

      {showNeeds && (
        <div className="absolute inset-0 z-[60] animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="care-title">
          <button type="button" aria-label={t('Close care', 'Zamknij opiekę')} className="absolute inset-0 h-full w-full bg-[#100f0d]/72 backdrop-blur-sm" onClick={() => setShowNeeds(false)} />
          <section className="safe-bottom absolute bottom-0 left-0 right-0 max-h-[82%] overflow-y-auto rounded-t-[1.75rem] border-t border-warm-200/12 bg-[#211e1a]/98 shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="mx-auto max-w-md p-4 pb-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/50">{t('Care', 'Opieka')}</p>
                  <h2 id="care-title" className="mt-0.5 text-lg font-serif text-warm-100">{t('How are they?', 'Jak się czuje?')}</h2>
                  <p className="mt-1 max-w-xs text-[10px] leading-relaxed font-serif text-warm-200/45">
                    {t('Every need reads the same way: settled → notice → attention → urgent.', 'Każda potrzeba narasta w ten sam sposób: w normie → sygnał → wymaga uwagi → pilna.')}
                  </p>
                </div>
                <button type="button" onClick={() => setShowNeeds(false)} className="min-h-11 -my-2 px-2 py-2 text-xs font-serif text-warm-200/60 hover:text-warm-100">{t('Close', 'Zamknij')}</button>
              </div>

              {dominantNeed && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-warm-300/12 bg-room-dark/35 px-3 py-2">
                  <span className="text-sm" style={{ color: urgencyColor(getNeedUrgency(state.needs[dominantNeed])) }}>{NEED_COPY[dominantNeed].icon}</span>
                  <p className="text-[11px] font-serif italic text-warm-100/72">
                    {state.identity.name || t('The creature', 'Stworek')} {getNaturalNeedCue(state, polish, dominantNeed)}.
                  </p>
                </div>
              )}

              <div className="mt-3 divide-y divide-warm-200/7">
                {NEED_ORDER.map(key => {
                  const urgency = getNeedUrgency(state.needs[key]);
                  return (
                    <div key={key} className="grid grid-cols-[1.7rem_minmax(0,1fr)_auto] items-start gap-2 py-2.5">
                      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full border border-warm-200/10 bg-room-dark/35 text-xs" style={{ color: urgencyColor(urgency) }} aria-hidden="true">
                        {NEED_COPY[key].icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-serif text-warm-100/82">{getNeedName(key, polish)}</p>
                        <p className="mt-0.5 text-[9px] leading-relaxed font-serif text-warm-200/38">{getNeedAction(key, polish)}</p>
                      </div>
                      <span className="mt-0.5 whitespace-nowrap rounded-full border px-2 py-1 text-[8px] font-serif uppercase tracking-[0.08em]" style={{ color: urgencyColor(urgency), borderColor: `${urgencyColor(urgency)}35`, backgroundColor: `${urgencyColor(urgency)}0d` }}>
                        {urgencyLabel(urgency, polish)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
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
                  <p className="text-warm-200/30 text-[9px] font-serif mt-2">{t('Making', 'Tworzenie')} · {getCreationMastery(state, ui)}</p>
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
                {learnedWeatherPreferences.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[9px] uppercase tracking-widest text-warm-300/35">{t('Weather becoming familiar', 'Oswajana pogoda')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {learnedWeatherPreferences.map(({ condition, preference }) => (
                        <span key={condition} className="rounded-full border border-warm-200/10 bg-room-mid/70 px-2 py-1 text-[10px] font-serif text-warm-200/65">
                          {getWeatherIcon(condition)} {getWeatherConditionLabel(condition, ui)} · {preference.affinity >= 6 ? t('drawn to it', 'lubi ją') : preference.affinity <= -3 ? t('wary', 'podchodzi ostrożnie') : t('learning', 'poznaje ją')}
                        </span>
                      ))}
                    </div>
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

      {!state.world.settings.onboardingSeen && (
        <WeatherControls state={state} language={ui} onStateChange={onStateChange} variant="onboarding" />
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
              <button aria-label={t('Close settings', 'Zamknij ustawienia')} onClick={() => { setShowSettings(false); setResetArmed(false); }} className="tap-target grid place-items-center text-warm-200/60 hover:text-warm-100 rounded-full"><GlyphIcon name="close" size={21} /></button>
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
              <WeatherControls state={state} language={ui} onStateChange={onStateChange} variant="settings" />
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
                <p className="text-warm-200/62 text-[10px] font-serif mt-1 leading-relaxed">{t('A private file can carry the whole life, memories, chats, creations and chosen weather place to another device. Nothing is uploaded.', 'Prywatny plik przeniesie całe życie, wspomnienia, rozmowy, prace i wybrane miejsce pogody na inne urządzenie. Nic nie jest wysyłane.')}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={exportCreature} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Save backup', 'Zapisz backup')}</button>
                  <button onClick={() => importInputRef.current?.click()} className="min-h-11 rounded-xl border border-warm-200/15 bg-room-dark/30 px-3 py-2 text-warm-100/75 text-xs font-serif active:scale-[0.98] transition-transform">{t('Open backup', 'Otwórz backup')}</button>
                </div>
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => void importCreature(event.target.files?.[0])} />
                <p className="text-warm-200/62 text-[9px] font-serif mt-3">{t('The file contains personal conversations and the rounded weather location. Store it somewhere you trust.', 'Plik zawiera prywatne rozmowy i zaokrągloną lokalizację pogody. Przechowuj go w zaufanym miejscu.')}</p>
              </div>
              {onReset && (
                <div className="relative z-50 rounded-2xl border border-red-200/10 bg-room-mid/25 p-4">
                  <div className="text-warm-100/70 text-sm font-serif">{t('Begin another life', 'Zacznij inne życie')}</div>
                  <p className="text-warm-200/62 text-[10px] font-serif mt-1">{t('Save a backup first if you may want to return to this creature.', 'Najpierw zapisz backup, jeśli możesz chcieć wrócić do tego stworka.')}</p>
                  {resetArmed ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-red-100/80 text-xs font-serif">{t('Really start over? This cannot be undone.', 'Na pewno zacząć od nowa? Tego nie da się cofnąć.')}</p>
                      <button
                        type="button"
                        onClick={onReset}
                        className="min-h-11 w-full rounded-xl border border-red-200/35 bg-red-200/10 px-3 py-2 text-red-100 text-xs font-serif active:scale-[0.98] transition-transform"
                      >
                        {t('Yes, start over', 'Tak, zacznij od nowa')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetArmed(false)}
                        className="min-h-11 w-full rounded-xl border border-warm-200/15 px-3 py-2 text-warm-100/70 text-xs font-serif active:scale-[0.98] transition-transform"
                      >
                        {t('Cancel', 'Anuluj')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setResetArmed(true)}
                      className="mt-3 min-h-11 w-full rounded-xl border border-red-200/15 px-3 py-2 text-red-100/55 text-xs font-serif active:scale-[0.98] transition-transform"
                    >
                      {t('Start over', 'Zacznij od nowa')}
                    </button>
                  )}
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
        <ChatInterface
          state={state}
          onStateChange={onStateChange}
          onClose={() => setShowChat(false)}
          onSendMessage={sendConversationMessage}
          isThinking={isThinking}
          mindState={mindState}
        />
      )}
    </div>
  );
};

export default Room;
