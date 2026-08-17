import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState } from './types';
import { loadGameState, saveGameState } from './systems/persistence';
import { createNewCreature, createHatchedCreature } from './systems/creatureFactory';
import { simulateOfflineTime } from './systems/offlineSimulation';
import { updateNeeds } from './systems/needsSystem';
import EggHatching from './components/EggHatching';
import Room from './components/Room';

const APP_VERSION = '0.1.0';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEgg, setShowEgg] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const needsTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Load saved state
  useEffect(() => {
    loadGameState().then(saved => {
      if (saved) {
        // CRITICAL: If the creature has already hatched, never show the egg again.
        // The hatched flag is a permanent lifecycle transition.
        if (saved.development.hatched) {
          // Simulate offline time
          const awayMs = Date.now() - saved.lastSaved;
          if (awayMs > 60000) {
            const { state: updated, activities } = simulateOfflineTime(saved, awayMs);
            setGameState(updated);
          } else {
            setGameState(saved);
          }
          setShowEgg(false);
        } else {
          // Not yet hatched — show the egg
          setShowEgg(true);
        }
      } else {
        // No saved state — new game, show egg
        setShowEgg(true);
      }
      setLoading(false);
    });
  }, []);

  // Auto-save
  const queueSave = useCallback((state: GameState) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveGameState(state);
    }, 1000);
  }, []);

  // Needs decay
  useEffect(() => {
    if (!gameState || showEgg) return;
    needsTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev) return prev;
        const updated = { ...prev, needs: updateNeeds(prev, 1) };
        queueSave(updated);
        return updated;
      });
    }, 60000);
    return () => clearInterval(needsTimerRef.current);
  }, [gameState, showEgg, queueSave]);

  const handleStateChange = useCallback((newState: GameState | ((prev: GameState) => GameState)) => {
    setGameState(prev => {
      if (!prev) return prev;
      const updated = typeof newState === 'function' ? newState(prev) : newState;
      queueSave(updated);
      return updated;
    });
  }, [queueSave]);

  const handleHatch = useCallback(() => {
    setShowEgg(false);
  }, []);

  const handleNameChosen = useCallback((name: string) => {
    const creature = createNewCreature(name);
    const hatched = createHatchedCreature(creature);
    setGameState(hatched);
    saveGameState(hatched);
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('Start over with a new creature?')) {
      saveGameState(createNewCreature()).then(() => {
        window.location.reload();
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-room-dark flex items-center justify-center">
        <div className="text-warm-200/40 text-sm font-serif animate-pulse">Loading...</div>
      </div>
    );
  }

  if (showEgg) {
    return (
      <div className="h-screen w-screen">
        <EggHatching onHatch={handleHatch} onNameChosen={handleNameChosen} />
      </div>
    );
  }

  if (!gameState) return null;

  // Defensive: if gameState exists but somehow hatched is false, force it true
  // This prevents any edge case where a saved state slips through
  const safeState = gameState.development.hatched
    ? gameState
    : { ...gameState, development: { ...gameState.development, hatched: true, stage: 'newborn' as const, cognitiveLevel: Math.max(5, gameState.development.cognitiveLevel) } };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <Room state={safeState} onStateChange={handleStateChange} version={APP_VERSION} />
      
      {/* Hidden reset */}
      <button
        onClick={handleReset}
        className="absolute top-3 right-3 z-40 text-warm-200/20 hover:text-warm-200/50 text-xs font-serif"
      >
        Reset
      </button>
    </div>
  );
}

export default App;
