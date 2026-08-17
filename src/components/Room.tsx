import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ObjectType } from '../types';
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

const Room: React.FC<RoomProps> = ({ state, onStateChange, version }) => {
  const [speech, setSpeech] = useState<string | null>(null);
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [draggingObj, setDraggingObj] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [creatureEmotion, setCreatureEmotion] = useState(state.emotionalState);
  const [showObjectMenu, setShowObjectMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [creaturePos, setCreaturePos] = useState(state.position);
  const [isMoving, setIsMoving] = useState(false);
  const [initiatedTopic, setInitiatedTopic] = useState<string | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setInterval>>();
  const moveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const initiateTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const roomRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const creatureEmotionRef = useRef(creatureEmotion);

  // Keep refs in sync with latest state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { creatureEmotionRef.current = creatureEmotion; }, [creatureEmotion]);

  // Idle movement
  useEffect(() => {
    if (state.sleepState === 'sleeping' || state.development.stage === 'egg') return;
    const scheduleMove = () => {
      const delay = 3000 + Math.random() * 8000;
      moveTimerRef.current = setTimeout(() => {
        if (Math.random() < 0.6) {
          const objects = stateRef.current.roomObjects;
          const target = objects[Math.floor(Math.random() * objects.length)];
          const offsetX = (Math.random() - 0.5) * 15;
          const offsetY = (Math.random() - 0.5) * 10;
          setCreaturePos({
            x: Math.max(15, Math.min(85, target.x + offsetX)),
            y: Math.max(40, Math.min(80, target.y + offsetY)),
          });
          setIsMoving(true);
          setTimeout(() => setIsMoving(false), 2000);
        } else {
          setCreaturePos({ x: 20 + Math.random() * 60, y: 45 + Math.random() * 30 });
          setIsMoving(true);
          setTimeout(() => setIsMoving(false), 2000);
        }
        scheduleMove();
      }, delay);
    };
    scheduleMove();
    return () => clearTimeout(moveTimerRef.current);
  }, [state.sleepState, state.development.stage]);

  // Sync position to state when idle
  useEffect(() => {
    if (isMoving) return;
    const dx = Math.abs(creaturePos.x - state.position.x);
    const dy = Math.abs(creaturePos.y - state.position.y);
    if (dx > 1 || dy > 1) {
      onStateChange(prev => ({ ...prev, position: creaturePos, facing: creaturePos.x > prev.position.x ? 'right' : creaturePos.x < prev.position.x ? 'left' : prev.facing }));
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

  // Random speech — uses refs to avoid stale closures
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

  // Creature-initiated conversation check — uses refs to avoid stale closures
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

  const handleObjectDragStart = (objId: string, e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingObj(objId);
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingObj) return;
    e.preventDefault();
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingObj) return;
    const rect = roomRef.current?.getBoundingClientRect();
    if (rect) {
      const currentState = stateRef.current;
      const creatureX = (currentState.position.x / 100) * rect.width;
      const creatureY = (currentState.position.y / 100) * rect.height;
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      const dist = Math.sqrt((dropX - creatureX) ** 2 + (dropY - creatureY) ** 2);
      const obj = currentState.roomObjects.find(o => o.id === draggingObj);
      if (obj && dist < 80) {
        if (obj.type === 'apple' || obj.type === 'broccoli') {
          onStateChange(prev => {
            const fed = feedCreature(prev, obj.type);
            const updated = learnWord(fed, obj.type, 'food');
            setCreatureEmotion('happy');
            setTimeout(() => setCreatureEmotion('neutral'), 3000);
            triggerSpeech(obj.type);
            return updated;
          });
        } else {
          onStateChange(prev => {
            const updated = learnWord(prev, obj.type, 'object');
            setCreatureEmotion('curious');
            setTimeout(() => setCreatureEmotion('neutral'), 2000);
            return updated;
          });
        }
      }
    }
    setDraggingObj(null);
  };

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
      style={{ touchAction: draggingObj ? 'none' : 'pan-y' }}
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

      {/* Objects */}
      {state.roomObjects.map(obj => (
        <div
          key={obj.id}
          className={`absolute select-none transition-transform ${draggingObj === obj.id ? 'scale-125 z-50' : 'hover:scale-110'}`}
          style={{
            left: draggingObj === obj.id ? `${dragPos.x}px` : `${obj.x}%`,
            top: draggingObj === obj.id ? `${dragPos.y}px` : `${obj.y}%`,
            transform: draggingObj === obj.id ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
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

      {/* Creature-initiated chat prompt — subtle, near the creature */}
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
        <button onClick={() => setShowObjectMenu(!showObjectMenu)} className="w-12 h-12 rounded-full bg-room-mid/80 backdrop-blur-sm border border-warm-200/10 flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform">
          📦
        </button>
      </div>

      {/* Object menu */}
      {showObjectMenu && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-room-mid/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-40 animate-fade-in">
          <p className="text-warm-200/60 text-xs mb-2 text-center font-serif">Drag objects to the creature</p>
          <div className="flex gap-3 flex-wrap justify-center max-w-[200px]">
            {state.roomObjects.map(obj => (
              <div key={obj.id} className="text-2xl opacity-60">{objectEmojis[obj.type]}</div>
            ))}
          </div>
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
