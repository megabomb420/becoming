import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, OfflineActivity } from './types';
import { loadGameState, saveGameState } from './systems/persistence';
import { createNewCreature, createHatchedCreature } from './systems/creatureFactory';
import { simulateOfflineTime } from './systems/offlineSimulation';
import { advanceNeeds } from './systems/needsSystem';
import EggHatching from './components/EggHatching';
import Room from './components/Room';
import { registerReturn } from './systems/presenceSystem';
import { detectUiLanguage } from './systems/uiLanguage';
import { uiLanguage } from './systems/uiLanguage';
import PwaUpdateNotice from './components/PwaUpdateNotice';
import { getTimeOfDay, shouldBeDrowsy } from './systems/timeSystem';
import { fetchWeather } from './systems/weatherService';
import {
  beginWeatherRefresh,
  failWeatherRefresh,
  receiveWeatherSnapshot,
  shouldRefreshWeather,
  weatherLocationKey,
} from './systems/environmentSystem';

const APP_VERSION = '0.11.0';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEgg, setShowEgg] = useState(false);
  const gameStateRef = useRef<GameState | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const needsTimerRef = useRef<ReturnType<typeof setInterval>>();
  const hasGameState = gameState !== null;
  const weatherMode = gameState?.world.settings.mode;
  const selectedWeatherLocationKey = gameState?.world.settings.location
    ? weatherLocationKey(gameState.world.settings.location)
    : null;

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
          const now = Date.now();
          const awayMs = now - saved.lastSaved;
          let returningState = saved;
          let offlineActivities: OfflineActivity[] = [];
          if (awayMs > 60000) {
            const { state: updated, activities } = simulateOfflineTime(saved, awayMs, now);
            returningState = updated;
            offlineActivities = activities;
          }
          setGameState(registerReturn(returningState, awayMs, now, offlineActivities));
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

  // Open-Meteo is a source, never a gameplay controller. This lifecycle only
  // refreshes the central WorldEnvironment cache. Needs, behaviour and memory
  // interpret that shared state in their own systems.
  const refreshWorldWeather = useCallback(async (force = false) => {
    const currentState = gameStateRef.current;
    const world = currentState?.world;
    const location = world?.settings.location;
    if (!currentState || !world || !location || (world.settings.mode !== 'device' && world.settings.mode !== 'city')) return;
    const now = Date.now();
    if (!navigator.onLine) {
      const due = !world.current || now >= world.nextRefreshAt;
      if (due && world.lastError !== 'offline') {
        setGameState(previous => {
          if (!previous) return previous;
          const updated = { ...previous, world: failWeatherRefresh(previous.world, 'offline', now) };
          gameStateRef.current = updated;
          queueSave(updated);
          return updated;
        });
      }
      return;
    }
    if (!force && !shouldRefreshWeather(world, now, true)) return;
    const requestedLocationKey = weatherLocationKey(location);

    setGameState(previous => {
      const selected = previous?.world.settings.location;
      const selectedMode = previous?.world.settings.mode;
      if (!previous || !selected || (selectedMode !== 'device' && selectedMode !== 'city')) return previous;
      if (weatherLocationKey(selected) !== requestedLocationKey) return previous;
      const updated = { ...previous, world: beginWeatherRefresh(previous.world, now) };
      gameStateRef.current = updated;
      return updated;
    });
    try {
      const snapshot = await fetchWeather(location, fetch, now);
      setGameState(previous => {
        const selected = previous?.world.settings.location;
        const selectedMode = previous?.world.settings.mode;
        if (!previous || !selected || (selectedMode !== 'device' && selectedMode !== 'city')) return previous;
        if (weatherLocationKey(selected) !== requestedLocationKey || snapshot.locationKey !== requestedLocationKey) return previous;
        const updated = { ...previous, world: receiveWeatherSnapshot(previous.world, snapshot) };
        gameStateRef.current = updated;
        queueSave(updated);
        return updated;
      });
    } catch {
      setGameState(previous => {
        const selected = previous?.world.settings.location;
        const selectedMode = previous?.world.settings.mode;
        if (!previous || !selected || (selectedMode !== 'device' && selectedMode !== 'city')) return previous;
        if (weatherLocationKey(selected) !== requestedLocationKey) return previous;
        const updated = { ...previous, world: failWeatherRefresh(previous.world, 'weather_unavailable', Date.now()) };
        gameStateRef.current = updated;
        queueSave(updated);
        return updated;
      });
    }
  }, [queueSave]);

  // The five-minute check normally performs no request: the persisted cache
  // has a 45-minute refresh deadline. Visibility and reconnect events only
  // fetch when that deadline has passed or the selected place changed.
  useEffect(() => {
    if (!hasGameState || showEgg || (weatherMode !== 'device' && weatherMode !== 'city') || !selectedWeatherLocationKey) return;
    const check = () => void refreshWorldWeather();
    check();
    const interval = setInterval(check, 5 * 60_000);
    const handleOnline = () => check();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hasGameState, refreshWorldWeather, selectedWeatherLocationKey, showEgg, weatherMode]);

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

  // Advance from timestamps, not interval counts. Background throttling and
  // device sleep therefore cannot pause or double-count the creature's body.
  useEffect(() => {
    if (!hasGameState || showEgg) return;
    const advance = () => {
      setGameState(prev => {
        if (!prev) return prev;
        const now = Date.now();
        const advanced = advanceNeeds(prev, now);
        const time = getTimeOfDay(now, advanced.world);
        const updated = prev.sleepState === 'sleeping'
          ? advanced
          : { ...advanced, sleepState: shouldBeDrowsy(time, advanced.needs.energy) ? 'drowsy' as const : 'awake' as const };
        queueSave(updated);
        return updated;
      });
    };
    advance();
    needsTimerRef.current = setInterval(advance, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') advance();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(needsTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
