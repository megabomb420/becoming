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

interface RoomProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
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

const Room: React.FC<RoomProps> = ({ state, onStateChange, version }) => {
  const [speech, setSpeech] = useState<string | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [showBecoming, setShowBecoming] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showChat, setShowChat] = useState(false);
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

  // Keep refs in sync with latest state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { creatureEmotionRef.current = creatureEmotion; }, [creatureEmotion]);
  useEffect(() => { creaturePosRef.current = creaturePos; }, [creaturePos]);
  useEffect(() => { behaviorRef.current = state.creatureBehavior; }, [state.creatureBehavior]);

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
    emotionTimerRef.current = setTimeout(() => setCreatureEmotion('neutral'), duration);
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
        currentActivity: reaction.activity,
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
      return evolveLifePathFromObject(experienced, type, reaction.outcome);
    });

    behaviorRef.current = reaction.behavior;
    showCreatureCue({ icon: reaction.icon, label: reaction.label, tone: 'reaction' }, reactionDuration);
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
  }, [onStateChange, setTemporaryEmotion, showCreatureCue, triggerSpeech]);

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
    showCreatureCue({ icon: '!', label: `notices the ${objectLabels[object.type]}`, tone: 'notice' });
    onStateChange(prev => ({
      ...prev,
      facing: object.x > currentPos.x ? 'right' : object.x < currentPos.x ? 'left' : prev.facing,
      creatureBehavior: 'observing',
      currentActivity: `noticing the ${objectLabels[object.type]}`,
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
      showCreatureCue({ icon: '→', label: `goes to the ${objectLabels[object.type]}`, tone: 'movement' });
      onStateChange(prev => ({
        ...prev,
        facing: target.x > prev.position.x ? 'right' : target.x < prev.position.x ? 'left' : prev.facing,
        creatureBehavior: 'walking',
        currentActivity: `approaching the ${objectLabels[object.type]}`,
      }));

      movementTimerRef.current = setTimeout(() => {
        if (activeObjectRef.current === object.id) {
          finishObjectInteraction(object.id, object.type, target, initiatedByUser);
        }
      }, travelTime);
    }, noticeDelay);
  }, [clearActionTimers, finishObjectInteraction, onStateChange, setTemporaryEmotion, showCreatureCue]);

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
            onStateChange(prev => clearInitiatedTopic(prev));
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
    showCreatureCue({ icon: '?', label: 'notices your touch', tone: 'notice' }, 1600);
    onStateChange(prev => {
      const updated = recordBondEvent(touchCreature(prev, 'tap'), 'tap');
      setTemporaryEmotion('curious', 2000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'curious' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [onStateChange, setTemporaryEmotion, showCreatureCue, triggerSpeech]);

  const handleStrokeCreature = useCallback(() => {
    showCreatureCue({ icon: '♡', label: 'leans into your hand', tone: 'reaction' }, 2400);
    onStateChange(prev => {
      const updated = recordBondEvent(touchCreature(prev, 'stroke'), 'stroke');
      setTemporaryEmotion('happy', 3000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'happy' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [onStateChange, setTemporaryEmotion, showCreatureCue, triggerSpeech]);

  const handleHoldStart = useCallback(() => {}, []);

  const handleHoldEnd = useCallback(() => {
    showCreatureCue({ icon: '♡', label: 'settles close', tone: 'reaction' }, 2600);
    onStateChange(prev => {
      const updated = recordBondEvent(touchCreature(prev, 'hold'), 'hold');
      setTemporaryEmotion('happy', 3000);
      return updated;
    });
  }, [onStateChange, setTemporaryEmotion, showCreatureCue]);

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
    if (state.sleepState === 'sleeping') {
      onStateChange(prev => wakeUp(prev));
    } else {
      onStateChange(prev => putToSleep(prev));
    }
  };

  const handleOpenChatWithTopic = () => {
    setShowChat(true);
    setInitiatedTopic(null);
  };

  const handleMomentChoice = (choiceId: string, result: string) => {
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
          aria-label={`Use ${objectLabels[obj.type]}`}
          title={`Use ${objectLabels[obj.type]}`}
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
            {state.identity.name || 'The creature'} is {state.currentActivity}
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
        <button onClick={() => setShowBecoming(true)} className="text-left group">
          <div className="text-warm-200/60 text-xs font-serif tracking-wider group-hover:text-warm-100 transition-colors">
            {state.identity.name || 'New'} · {developmentLabel}
          </div>
          <div className="text-[9px] font-serif uppercase tracking-[0.16em] mt-0.5 transition-colors" style={{ color: pathVisual.accent }}>
            {lifePathTitle}
          </div>
        </button>
        <div className="flex gap-3">
          <button onClick={() => setShowBecoming(true)} className="text-warm-200/45 hover:text-warm-100 text-xs font-serif tracking-wider transition-colors">
            Becoming
          </button>
          <button onClick={() => setShowMemoryBook(true)} className="text-warm-200/60 hover:text-warm-100 text-xs font-serif tracking-wider transition-colors">
            Memories
          </button>
        </div>
      </div>

      {/* Daily moments are small dilemmas, not quests. Their choice changes
          the creature's path and becomes a remembered event. */}
      {state.lifePath.pendingMoment && !showChat && !showMemoryBook && !showBecoming && state.sleepState !== 'sleeping' && (
        <div className="absolute left-4 right-4 bottom-24 z-40 animate-slide-up">
          <div className="max-w-md mx-auto rounded-2xl border border-warm-300/20 bg-room-dark/94 backdrop-blur-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/55">A moment · Day {state.lifePath.pendingMoment.day}</p>
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
            <p className="text-[9px] uppercase tracking-[0.2em] text-warm-300/45">This became a memory</p>
            <p className="text-warm-100/85 text-xs font-serif leading-relaxed mt-1">{momentResult}</p>
          </div>
        </div>
      )}

      {/* Conversation is the primary way this creature grows. */}
      {state.conversation.totalUserMessages === 0 && !showInventory && state.sleepState !== 'sleeping' && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 rounded-full bg-warm-100/90 text-room-dark px-4 py-2 text-xs font-serif shadow-xl animate-cue-pop"
        >
          Talk to {state.identity.name || 'the creature'}
        </button>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 safe-bottom px-4 py-4 flex justify-center items-end gap-3 z-30">
        <button aria-label={state.sleepState === 'sleeping' ? 'Wake creature' : 'Put creature to sleep'} title={state.sleepState === 'sleeping' ? 'Wake creature' : 'Sleep'} onClick={handleSleepToggle} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          {state.sleepState === 'sleeping' ? '☀️' : '🌙'}
        </button>
        <button aria-label="Talk to creature" title="Talk" onClick={() => setShowChat(true)} className="w-[4.5rem] h-14 rounded-2xl bg-warm-100/90 text-room-dark backdrop-blur-sm border border-warm-50/30 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform">
          <span className="text-lg leading-none" aria-hidden="true">💬</span>
          <span className="text-[10px] font-serif mt-0.5">Talk</span>
        </button>
        <button aria-label="Open things" title="Things" aria-expanded={showInventory} onClick={() => setShowInventory(!showInventory)} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          📦
        </button>
      </div>

      {/* Inventory tray */}
      {showInventory && (
        <div className="absolute bottom-20 left-4 right-4 bg-room-mid/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-40 animate-slide-up">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-warm-100/75 text-xs font-serif">Things</p>
              <p className="text-warm-200/40 text-[10px] font-serif">Tap to place · drag to choose a spot</p>
            </div>
            {state.roomObjects.length > 0 && (
              <button onClick={handleTidyRoom} className="text-warm-200/45 hover:text-warm-100 text-[10px] font-serif border border-warm-200/10 rounded-lg px-2.5 py-1.5">
                Tidy room
              </button>
            )}
          </div>
          {state.inventory.length === 0 ? (
            <p className="text-warm-200/30 text-xs text-center font-serif italic py-2">Everything is in the room</p>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center">
              {[...state.inventory]
                .sort((a, b) => INVENTORY_ORDER.indexOf(a) - INVENTORY_ORDER.indexOf(b))
                .map(type => (
                <button
                  type="button"
                  key={type}
                  aria-label={`Place ${objectLabels[type]}`}
                  title={objectLabels[type]}
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
              <h2 className="text-warm-100 text-xl font-serif">Memory Book</h2>
              <button onClick={() => setShowMemoryBook(false)} className="text-warm-200/60 hover:text-warm-100 text-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">Day 1</div>
                <div className="text-warm-100 text-sm font-serif">Arrived.</div>
              </div>
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">Growing mind</div>
                <div className="text-warm-100 text-sm font-serif">{developmentLabel}</div>
                <p className="text-warm-200/55 text-xs font-serif italic mt-1.5">
                  {getDevelopmentDescription(state.development.stage)}
                </p>
                <p className="text-warm-200/35 text-[10px] font-serif mt-2">
                  {state.conversation.totalUserMessages} conversation{state.conversation.totalUserMessages === 1 ? '' : 's'} remembered
                  {ageDays > 0 ? ` · Day ${ageDays}` : ''}
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
                    Learning from you: {state.socialLearning.imitated.slice(-3).map(habit => `${habit.action} ${habit.target}`).join(', ')}
                  </p>
                )}
              </div>
              <div className="border-l-2 border-warm-300/30 pl-4">
                <div className="text-warm-200/40 text-xs mb-1">Becoming</div>
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
                  <div className="text-warm-200/40 text-xs mb-1">Observed</div>
                  <div className="text-warm-100 text-sm font-serif">
                    {state.socialLearning.observations
                      .filter(o => o.exposureCount >= 2)
                      .slice(0, 5)
                      .map(o => `${o.action} ${o.target}`)
                      .join(', ')}
                  </div>
                </div>
              )}
              {state.memories.filter(m => m.importance >= 6).slice(-10).map(mem => (
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
                <p className="text-warm-300/45 text-[9px] uppercase tracking-[0.22em]">What I am becoming</p>
                <h2 className="text-warm-100 text-2xl font-serif mt-1">{lifePathTitle}</h2>
                <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: pathVisual.accent }}>{state.lifePath.phase}</p>
                <p className="text-warm-200/30 text-[9px] font-serif mt-1">
                  Skin · {state.lifePath.phase === 'embodied' ? 'full form' : state.lifePath.secondary ? 'hybrid signs' : state.lifePath.phase === 'committed' ? 'settling in' : state.lifePath.phase === 'recovering' ? 'changing again' : 'first signs'}
                </p>
              </div>
              <button onClick={() => setShowBecoming(false)} className="text-warm-200/60 hover:text-warm-100 text-sm">Close</button>
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
              <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">Visible tendencies</h3>
              <div className="space-y-2 mt-3">
                {lifePathClues.length > 0 ? lifePathClues.map(clue => (
                  <div key={clue} className="border-l border-warm-300/30 pl-3 text-warm-100/75 text-xs font-serif leading-relaxed">{clue}</div>
                )) : <p className="text-warm-200/35 text-xs font-serif italic">Still too young to have hardened into a type.</p>}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">Pull of possible lives</h3>
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
                <h3 className="text-warm-200/45 text-[10px] uppercase tracking-[0.18em]">Turns in the road</h3>
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

            <p className="mt-8 text-center text-warm-200/20 text-[9px] font-serif">No path is permanent. Repetition strengthens it; consequences and choices can bend it.</p>
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
