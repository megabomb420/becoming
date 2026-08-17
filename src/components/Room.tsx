import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ObjectType, RoomObject, CreatureBehavior } from '../types';
import CreatureCanvas from './CreatureCanvas';
import ChatInterface from './ChatInterface';
import { touchCreature, feedCreature, putToSleep, wakeUp } from '../systems/needsSystem';
import { updateDevelopment, learnWord } from '../systems/developmentSystem';
import { generateCreatureSpeech, shouldSpeak } from '../systems/languageSystem';
import { shouldInitiateConversation, generateInitiatedTopic, clearInitiatedTopic } from '../systems/socialLearningSystem';

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

// Walkable area bounds (percentage of room)
const WALK_BOUNDS = { minX: 12, maxX: 88, minY: 48, maxY: 78 };

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

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const Room: React.FC<RoomProps> = ({ state, onStateChange, version }) => {
  const [speech, setSpeech] = useState<string | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [creatureEmotion, setCreatureEmotion] = useState(state.emotionalState);
  const [initiatedTopic, setInitiatedTopic] = useState<string | null>(null);

  // Drag state
  const [draggingType, setDraggingType] = useState<ObjectType | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragFromInventory, setDragFromInventory] = useState(false);

  // Creature movement
  const [creaturePos, setCreaturePos] = useState(state.position);
  const [isMoving, setIsMoving] = useState(false);

  // Refs for latest state in callbacks / intervals
  const stateRef = useRef(state);
  const creatureEmotionRef = useRef(creatureEmotion);
  const creaturePosRef = useRef(creaturePos);
  const behaviorRef = useRef<CreatureBehavior>(state.creatureBehavior);
  const targetPosRef = useRef(state.position);
  const behaviorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const walkStartTimeRef = useRef<number>(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const initiateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const activityTimerRef = useRef<ReturnType<typeof setInterval>>();
  const roomRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with latest state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { creatureEmotionRef.current = creatureEmotion; }, [creatureEmotion]);
  useEffect(() => { creaturePosRef.current = creaturePos; }, [creaturePos]);
  useEffect(() => { behaviorRef.current = state.creatureBehavior; }, [state.creatureBehavior]);

  // ========== BEHAVIOUR STATE MACHINE ==========
  // Decides what the creature should do next based on needs, objects, and randomness.
  // Runs on a variable timer so the creature doesn't feel robotic.
  useEffect(() => {
    if (state.sleepState === 'sleeping') {
      onStateChange(prev => ({ ...prev, creatureBehavior: 'sleeping' }));
      return;
    }

    const chooseBehavior = () => {
      const currentState = stateRef.current;
      const currentPos = creaturePosRef.current;
      const roomObjects = currentState.roomObjects;
      const needs = currentState.needs;
      const personality = currentState.personality;

      // If currently walking, wait for visual arrival before deciding again.
      // We use elapsed time because creaturePos is set immediately to the target
      // for visual lerp smoothing; the state machine must not outrun the canvas.
      if (behaviorRef.current === 'walking') {
        const elapsed = Date.now() - walkStartTimeRef.current;
        const travelDist = dist(currentPos, targetPosRef.current);
        // Minimum 1.2s walk, or longer for far distances
        const minWalkTime = 1200 + travelDist * 25;
        if (elapsed < minWalkTime) {
          scheduleNext(400);
          return;
        }
        // Arrived
        setIsMoving(false);
      }

      // Check dominant needs
      let target: { x: number; y: number } | null = null;

      // Priority 1: Very hungry + food in room → eat
      if (needs.hunger < 35) {
        const foods = roomObjects.filter(o => o.type === 'apple' || o.type === 'broccoli');
        if (foods.length > 0) {
          const closest = foods.reduce((a, b) => dist(currentPos, a) < dist(currentPos, b) ? a : b);
          target = { x: closest.x, y: closest.y };
          onStateChange(prev => ({
            ...prev,
            creatureBehavior: 'walking',
            currentActivity: 'going to eat',
          }));
          // Schedule the actual eating after arrival
          setTimeout(() => {
            const food = foods[0];
            onStateChange(prev => {
              const fed = feedCreature(prev, food.type);
              const updated = learnWord(fed, food.type, 'food');
              setCreatureEmotion('happy');
              setTimeout(() => setCreatureEmotion('neutral'), 3000);
              triggerSpeech(food.type);
              return {
                ...updated,
                creatureBehavior: 'eating',
                currentActivity: `eating ${food.type}`,
              };
            });
            // After eating, clear behavior
            setTimeout(() => {
              onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
            }, 3000);
          }, 2000);
          scheduleNext(6000);
          return;
        }
      }

      // Priority 2: Sleepy + blanket in room → go to blanket
      if (!target && needs.energy < 25) {
        const blankets = roomObjects.filter(o => o.type === 'blanket');
        if (blankets.length > 0) {
          const closest = blankets.reduce((a, b) => dist(currentPos, a) < dist(currentPos, b) ? a : b);
          target = { x: closest.x, y: closest.y };
          onStateChange(prev => ({
            ...prev,
            creatureBehavior: 'walking',
            currentActivity: 'going to rest',
          }));
          scheduleNext(5000);
          return;
        }
      }

      // Priority 3: Investigate nearby objects
      if (!target && roomObjects.length > 0 && Math.random() < 0.4 + personality.curiosity / 200) {
        const interesting = roomObjects.filter(o => !o.beingUsedByCreature);
        if (interesting.length > 0) {
          const obj = interesting[Math.floor(Math.random() * interesting.length)];
          target = { x: obj.x, y: obj.y };
          onStateChange(prev => ({
            ...prev,
            creatureBehavior: 'walking',
            currentActivity: `investigating ${obj.type}`,
          }));

          // On arrival, react based on object type
          const arrivalTime = 1500 + dist(currentPos, target) * 20;
          setTimeout(() => {
            handleObjectReaction(obj.type);
          }, arrivalTime);

          scheduleNext(arrivalTime + 4000);
          return;
        }
      }

      // Priority 4: Low stimulation + ball in room → play
      if (!target && needs.stimulation < 40) {
        const balls = roomObjects.filter(o => o.type === 'ball');
        if (balls.length > 0 && Math.random() < 0.5) {
          const ball = balls[0];
          target = { x: ball.x + (Math.random() - 0.5) * 10, y: ball.y };
          onStateChange(prev => ({
            ...prev,
            creatureBehavior: 'walking',
            currentActivity: 'going to play',
          }));
          setTimeout(() => {
            setCreatureEmotion('happy');
            setTimeout(() => setCreatureEmotion('neutral'), 3000);
            onStateChange(prev => ({ ...prev, creatureBehavior: 'playing', currentActivity: 'playing with ball' }));
            triggerSpeech('play');
            setTimeout(() => {
              onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
            }, 4000);
          }, 2000);
          scheduleNext(8000);
          return;
        }
      }

      // Priority 5: Wander to an idle position (infrequent)
      if (!target && Math.random() < 0.25) {
        const idleSpot = IDLE_POSITIONS[Math.floor(Math.random() * IDLE_POSITIONS.length)];
        // Add slight randomness so it's not identical every time
        target = {
          x: idleSpot.x + (Math.random() - 0.5) * 8,
          y: idleSpot.y + (Math.random() - 0.5) * 6,
        };
        target = clampToWalkable(target);
        onStateChange(prev => ({
          ...prev,
          creatureBehavior: 'walking',
          currentActivity: null,
        }));
        scheduleNext(5000);
        return;
      }

      // Priority 6: Just idle / observe
      if (!target) {
        const nextBehavior = Math.random() < 0.3 ? 'observing' : 'idle';
        onStateChange(prev => ({
          ...prev,
          creatureBehavior: nextBehavior,
          currentActivity: null,
        }));
        scheduleNext(4000 + Math.random() * 6000);
        return;
      }

      if (target) {
        targetPosRef.current = clampToWalkable(target);
        walkStartTimeRef.current = Date.now();
        setIsMoving(true);
        setCreaturePos(targetPosRef.current);
      }
    };

    const scheduleNext = (delay: number) => {
      clearTimeout(behaviorTimerRef.current);
      behaviorTimerRef.current = setTimeout(chooseBehavior, delay);
    };

    // Initial behavior kickoff
    scheduleNext(2000 + Math.random() * 3000);

    return () => clearTimeout(behaviorTimerRef.current);
  }, [state.sleepState, onStateChange]);

  // React to specific object types when investigated
  const handleObjectReaction = useCallback((type: ObjectType) => {
    const currentState = stateRef.current;
    switch (type) {
      case 'apple':
      case 'broccoli': {
        if (currentState.needs.hunger < 60) {
          onStateChange(prev => {
            const fed = feedCreature(prev, type);
            const updated = learnWord(fed, type, 'food');
            setCreatureEmotion('happy');
            setTimeout(() => setCreatureEmotion('neutral'), 3000);
            triggerSpeech(type);
            return { ...updated, creatureBehavior: 'eating', currentActivity: `eating ${type}` };
          });
          setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 4000);
        } else {
          setCreatureEmotion('curious');
          setTimeout(() => setCreatureEmotion('neutral'), 2000);
          onStateChange(prev => ({ ...prev, creatureBehavior: 'investigating', currentActivity: `sniffing ${type}` }));
          triggerSpeech('smell');
          setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 3000);
        }
        break;
      }
      case 'ball': {
        setCreatureEmotion('happy');
        setTimeout(() => setCreatureEmotion('neutral'), 3000);
        onStateChange(prev => ({ ...prev, creatureBehavior: 'playing', currentActivity: 'playing with ball' }));
        triggerSpeech('ball');
        setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 3000);
        break;
      }
      case 'paper': {
        setCreatureEmotion('curious');
        setTimeout(() => setCreatureEmotion('neutral'), 2000);
        onStateChange(prev => ({ ...prev, creatureBehavior: 'investigating', currentActivity: 'inspecting paper' }));
        setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 3000);
        break;
      }
      case 'blanket': {
        onStateChange(prev => ({ ...prev, creatureBehavior: 'observing', currentActivity: 'resting on blanket' }));
        setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 5000);
        break;
      }
      case 'mirror': {
        setCreatureEmotion('curious');
        setTimeout(() => setCreatureEmotion('neutral'), 2000);
        onStateChange(prev => ({ ...prev, creatureBehavior: 'investigating', currentActivity: 'looking at mirror' }));
        setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 3000);
        break;
      }
      case 'box':
      case 'stone':
      case 'pencil': {
        setCreatureEmotion('curious');
        setTimeout(() => setCreatureEmotion('neutral'), 2000);
        onStateChange(prev => ({ ...prev, creatureBehavior: 'investigating', currentActivity: `inspecting ${type}` }));
        setTimeout(() => onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null })), 2500);
        break;
      }
      default:
        onStateChange(prev => ({ ...prev, creatureBehavior: 'idle', currentActivity: null }));
    }
  }, [onStateChange]);

  // Sync local creature position to game state (but not while walking)
  useEffect(() => {
    if (isMoving) return;
    const dx = Math.abs(creaturePos.x - state.position.x);
    const dy = Math.abs(creaturePos.y - state.position.y);
    if (dx > 1 || dy > 1) {
      onStateChange(prev => ({
        ...prev,
        position: creaturePos,
        facing: creaturePos.x > prev.position.x ? 'right' : creaturePos.x < prev.position.x ? 'left' : prev.facing,
      }));
    }
  }, [creaturePos, isMoving, state.position.x, state.position.y, onStateChange]);

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
      if (shouldSpeak(currentState)) {
        const text = generateCreatureSpeech(currentState, { trigger: 'idle', emotionalState: currentEmotion });
        if (text) {
          setSpeech(text);
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = setTimeout(() => setSpeech(null), 4000);
        }
      }
    }, 8000 + Math.random() * 10000);
    return () => clearInterval(interval);
  }, []);

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

  const triggerSpeech = useCallback((text: string) => {
    setSpeech(text);
    clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = setTimeout(() => setSpeech(null), 4000);
  }, []);

  const handleTapCreature = useCallback(() => {
    onStateChange(prev => {
      const updated = touchCreature(prev, 'tap');
      setCreatureEmotion('curious');
      setTimeout(() => setCreatureEmotion('neutral'), 2000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'curious' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [onStateChange, triggerSpeech]);

  const handleStrokeCreature = useCallback(() => {
    onStateChange(prev => {
      const updated = touchCreature(prev, 'stroke');
      setCreatureEmotion('happy');
      setTimeout(() => setCreatureEmotion('neutral'), 3000);
      if (shouldSpeak(updated)) {
        const text = generateCreatureSpeech(updated, { trigger: 'touch', emotionalState: 'happy' });
        if (text) triggerSpeech(text);
      }
      return updated;
    });
  }, [onStateChange, triggerSpeech]);

  const handleHoldStart = useCallback(() => {}, []);

  const handleHoldEnd = useCallback(() => {
    onStateChange(prev => {
      const updated = touchCreature(prev, 'hold');
      setCreatureEmotion('happy');
      setTimeout(() => setCreatureEmotion('neutral'), 3000);
      return updated;
    });
  }, [onStateChange]);

  // ========== DRAG & DROP ==========
  // Drag from inventory
  const handleInventoryDragStart = (type: ObjectType, e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingType(type);
    setDragFromInventory(true);
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Drag existing room object
  const handleObjectDragStart = (objId: string, e: React.PointerEvent) => {
    e.preventDefault();
    const obj = state.roomObjects.find(o => o.id === objId);
    if (!obj) return;
    setDraggingType(obj.type);
    setDragFromInventory(false);
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    // Mark this object as being dragged by removing it temporarily
    onStateChange(prev => ({
      ...prev,
      roomObjects: prev.roomObjects.filter(o => o.id !== objId),
    }));
    // Store the object data on a ref for later
    (roomRef.current as any).__draggingObj = obj;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingType) return;
    e.preventDefault();
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingType) return;
    const rect = roomRef.current?.getBoundingClientRect();
    if (!rect) {
      setDraggingType(null);
      setDragFromInventory(false);
      return;
    }

    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    const pctX = (dropX / rect.width) * 100;
    const pctY = (dropY / rect.height) * 100;

    // Only allow dropping in the room area (not on the bottom controls)
    if (pctY > 88) {
      // Dropped in bottom bar area — cancel
      if (!dragFromInventory && (roomRef.current as any).__draggingObj) {
        // Restore the object to its original position
        const obj = (roomRef.current as any).__draggingObj;
        onStateChange(prev => ({
          ...prev,
          roomObjects: [...prev.roomObjects, obj],
        }));
      }
      setDraggingType(null);
      setDragFromInventory(false);
      (roomRef.current as any).__draggingObj = null;
      return;
    }

    if (dragFromInventory) {
      // Placing new object from inventory
      const newObject: RoomObject = {
        id: `${draggingType}-${Date.now()}`,
        type: draggingType,
        x: Math.max(5, Math.min(95, pctX)),
        y: Math.max(5, Math.min(90, pctY)),
        state: {},
        interactions: 0,
        placedByUser: true,
        beingUsedByCreature: false,
      };
      onStateChange(prev => ({
        ...prev,
        roomObjects: [...prev.roomObjects, newObject],
        inventory: prev.inventory.filter(i => i !== draggingType),
      }));
    } else {
      // Moving existing object
      const obj = (roomRef.current as any).__draggingObj;
      if (obj) {
        onStateChange(prev => ({
          ...prev,
          roomObjects: [
            ...prev.roomObjects,
            {
              ...obj,
              x: Math.max(5, Math.min(95, pctX)),
              y: Math.max(5, Math.min(90, pctY)),
            },
          ],
        }));
      }
    }

    setDraggingType(null);
    setDragFromInventory(false);
    (roomRef.current as any).__draggingObj = null;
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

  const ageDays = Math.floor(state.development.chronologicalAge / (24 * 60 * 60 * 1000));

  return (
    <div
      ref={roomRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: draggingType ? 'none' : 'pan-y' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Room background */}
      <div className={`absolute inset-0 transition-all duration-1000 ${state.sleepState === 'sleeping' ? 'brightness-50' : 'brightness-100'}`}>
        <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-room-mid" />
        <div className="absolute top-0 left-0 right-0 h-[65%]" style={{ background: 'linear-gradient(180deg, #1e1b16 0%, #1a1814 100%)' }} />
        <div className="absolute top-[20%] left-[50%] w-[300px] h-[300px] -translate-x-1/2 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(200,170,120,0.3) 0%, transparent 70%)' }} />
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
        <div
          key={obj.id}
          className="absolute select-none hover:scale-110 transition-transform"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '2rem',
            cursor: 'grab',
            touchAction: 'none',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          }}
          onPointerDown={(e) => handleObjectDragStart(obj.id, e)}
        >
          {objectEmojis[obj.type]}
        </div>
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

      {/* Speech bubble */}
      {speech && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 animate-fade-in z-40">
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
      <div className="absolute top-0 left-0 right-0 safe-top px-4 py-3 flex justify-between items-center z-30">
        <div className="text-warm-200/60 text-xs font-serif tracking-wider">
          {ageDays === 0 ? 'New' : `Day ${ageDays}`}
        </div>
        <button onClick={() => setShowMemoryBook(true)} className="text-warm-200/60 hover:text-warm-100 text-xs font-serif tracking-wider transition-colors">
          Memories
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 safe-bottom px-4 py-4 flex justify-center gap-3 z-30">
        <button onClick={handleSleepToggle} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          {state.sleepState === 'sleeping' ? '☀️' : '🌙'}
        </button>
        <button onClick={() => setShowChat(true)} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          💬
        </button>
        <button onClick={() => setShowInventory(!showInventory)} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          📦
        </button>
      </div>

      {/* Inventory tray */}
      {showInventory && (
        <div className="absolute bottom-20 left-4 right-4 bg-room-mid/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-40 animate-slide-up">
          <p className="text-warm-200/60 text-xs mb-3 text-center font-serif">Drag an object into the room</p>
          {state.inventory.length === 0 ? (
            <p className="text-warm-200/30 text-xs text-center font-serif italic">No objects left</p>
          ) : (
            <div className="flex gap-4 flex-wrap justify-center">
              {state.inventory.map(type => (
                <div
                  key={type}
                  className="text-3xl cursor-grab active:scale-110 transition-transform select-none"
                  style={{ touchAction: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
                  onPointerDown={(e) => handleInventoryDragStart(type, e)}
                >
                  {objectEmojis[type]}
                </div>
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

      {/* Chat Interface */}
      {showChat && (
        <ChatInterface state={state} onStateChange={onStateChange} onClose={() => setShowChat(false)} initialMessage={initiatedTopic || undefined} />
      )}
    </div>
  );
};

export default Room;
