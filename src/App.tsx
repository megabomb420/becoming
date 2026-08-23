import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, OfflineActivity } from './types';
import { loadGameState, saveGameState } from './systems/persistence';
import { createNewCreature, createHatchedCreature } from './systems/creatureFactory';
import { simulateOfflineTime } from './systems/offlineSimulation';
import { updateNeeds } from './systems/needsSystem';
import EggHatching from './components/EggHatching';
import Room from './components/Room';
import { registerReturn } from './systems/presenceSystem';
import { detectUiLanguage } from './systems/uiLanguage';
import { uiLanguage } from './systems/uiLanguage';
import PwaUpdateNotice from './components/PwaUpdateNotice';

const APP_VERSION = '0.9.20';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEgg, setShowEgg] = useState(false);
  const gameStateRef = useRef<GameState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const needsTimerRef = useRef<ReturnType<typeof setInterval>>();
  const hasGameState = gameState !== null;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load saved state
  useEffect(() => {
    loadGameState().then(saved => {
      if (saved) {
        // CRITICAL: If the creature has already hatched, never show the egg again.
        // The hatched flag is a permanent lifecycle transition.
        if (saved.development.hatched) {
          // Simulate offline time
          const awayMs = Date.now() - saved.lastSaved;
          let returningState = saved;
          let offlineActivities: OfflineActivity[] = [];
          if (awayMs > 60000) {
            const { state: updated, activities } = simulateOfflineTime(saved, awayMs);
            returningState = updated;
            offlineActivities = activities;
          }
          setGameState(registerReturn(returningState, awayMs, Date.now(), offlineActivities));
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

  // Flush the latest state when the PWA is backgrounded or closed. The regular
  // one-second debounce keeps interaction writes cheap, while this closes the
  // window where a quick app switch could otherwise lose the last action.
  useEffect(() => {
    const saveLatest = () => {
      const latest = gameStateRef.current;
      if (latest?.development.hatched) void saveGameState(latest);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveLatest();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', saveLatest);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', saveLatest);
    };
  }, []);

  // Needs decay
  useEffect(() => {
    if (!hasGameState || showEgg) return;
    needsTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev) return prev;
        const updated = { ...prev, needs: updateNeeds(prev, 1) };
        queueSave(updated);
        return updated;
      });
    }, 60000);
    return () => clearInterval(needsTimerRef.current);
  }, [hasGameState, showEgg, queueSave]);

  const handleStateChange = useCallback((newState: GameState | ((prev: GameState) => GameState)) => {
    setGameState(prev => {
      if (!prev) return prev;
      const updated = typeof newState === 'function' ? newState(prev) : newState;
      gameStateRef.current = updated;
      queueSave(updated);
      return updated;
    });
  }, [queueSave]);

  const handleHatch = useCallback(() => {
    setShowEgg(false);
  }, []);

  const handleNameChosen = useCallback((name: string) => {
    const creature = createNewCreature(name);
    const hatched = createHatchedCreature({
      ...creature,
      conversation: { ...creature.conversation, language: detectUiLanguage() },
    });
    gameStateRef.current = hatched;
    setGameState(hatched);
    saveGameState(hatched);
  }, []);

  const handleReset = useCallback(() => {
    const polish = (gameStateRef.current?.conversation.language ?? detectUiLanguage()) === 'pl';
    if (confirm(polish ? 'Zacząć od nowa z innym stworkiem?' : 'Start over with a new creature?')) {
      saveGameState(createNewCreature()).then(() => {
        window.location.reload();
      });
    }
  }, []);

  if (loading) {
    return (
      <>
        <div className="h-screen w-screen bg-room-dark flex items-center justify-center">
          <div className="text-warm-200/40 text-sm font-serif animate-pulse">{detectUiLanguage() === 'pl' ? 'Ładowanie...' : 'Loading...'}</div>
        </div>
        <PwaUpdateNotice language={detectUiLanguage()} />
      </>
    );
  }

  if (showEgg) {
    return (
      <>
        <div className="h-screen w-screen">
          <EggHatching onHatch={handleHatch} onNameChosen={handleNameChosen} />
        </div>
        <PwaUpdateNotice language={detectUiLanguage()} />
      </>
    );
  }

  if (!gameState) return null;

  // Defensive: if gameState exists but somehow hatched is false, force it true
  // This prevents any edge case where a saved state slips through
  const safeState = gameState.development.hatched
    ? gameState
    : { ...gameState, development: { ...gameState.development, hatched: true, stage: 'newborn' as const, cognitiveLevel: Math.max(5, gameState.development.cognitiveLevel) } };

  return (
    <>
      <div className="h-screen w-screen overflow-hidden relative">
        <Room state={safeState} onStateChange={handleStateChange} onReset={handleReset} version={APP_VERSION} />
      </div>
      <PwaUpdateNotice language={uiLanguage(safeState.conversation.language)} />
    </>
  );
}

export default App;
