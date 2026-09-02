import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { GameState, OfflineActivity } from './types';
import { closeDatabaseConnections, closeDatabaseForReload, isHatchableBoot, loadGameStateForBoot, resetForNewLife, saveGameState } from './systems/persistence';
import { createNewCreature, createHatchedCreature } from './systems/creatureFactory';
import { simulateOfflineTime } from './systems/offlineSimulation';
import { advanceNeeds, applyCircadianSleep } from './systems/needsSystem';
import { advanceHealth, isDead } from './systems/healthSystem';
import { ensureDailyMoment } from './systems/lifePathSystem';
import EggHatching from './components/EggHatching';
import Room from './components/Room';
import { registerReturn } from './systems/presenceSystem';
import { detectUiLanguage } from './systems/uiLanguage';
import { uiLanguage } from './systems/uiLanguage';
import PwaUpdateNotice from './components/PwaUpdateNotice';
import { observeDevelopmentSignals } from './systems/developmentSystem';
import { fetchWeather } from './systems/weatherService';
import {
  beginWeatherRefresh,
  failWeatherRefresh,
  receiveWeatherSnapshot,
  shouldRefreshWeather,
  weatherLocationKey,
} from './systems/environmentSystem';
import { authoritativeNow, cadenceDelay, isDevTimeSimulationActive } from './systems/authoritativeTime';
import { SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS, SaveScheduler } from './systems/saveScheduler';

const APP_VERSION = '0.14.12';
export type PwaUpdateStatus = 'up_to_date' | 'update_available' | 'checking' | 'offline' | 'unknown';
export type LocalSaveStatus = 'saved' | 'saving' | 'unavailable' | 'unknown';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEgg, setShowEgg] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [pwaUpdateStatus, setPwaUpdateStatus] = useState<PwaUpdateStatus>(navigator.onLine ? 'unknown' : 'offline');
  const [localSaveStatus, setLocalSaveStatus] = useState<LocalSaveStatus>('unknown');
  const gameStateRef = useRef<GameState | null>(null);
  const saveSchedulerRef = useRef<SaveScheduler | null>(null);
  const pendingSaveRef = useRef<GameState | null>(null);
  const needsTimerRef = useRef<ReturnType<typeof setInterval>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const resettingRef = useRef(false);
  const updatingRef = useRef(false);
  const bootRunRef = useRef(0);
  const recoveringRef = useRef(false);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration>();
  const updateAvailableRef = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_swUrl, registration) => {
      serviceWorkerRegistrationRef.current = registration;
      if (navigator.onLine && !updateAvailableRef.current) setPwaUpdateStatus('up_to_date');
    },
    onRegisterError: error => {
      console.warn('PWA update check failed.', error);
      setPwaUpdateStatus(navigator.onLine ? 'unknown' : 'offline');
    },
  });
  const hasGameState = gameState !== null;
  const weatherMode = gameState?.world.settings.mode;
  const selectedWeatherLocationKey = gameState?.world.settings.location
    ? weatherLocationKey(gameState.world.settings.location)
    : null;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (needRefresh) {
      updateAvailableRef.current = true;
      setPwaUpdateStatus('update_available');
    }
  }, [needRefresh]);

  useEffect(() => {
    const handleOffline = () => setPwaUpdateStatus('offline');
    const handleOnline = () => setPwaUpdateStatus(updateAvailableRef.current ? 'update_available' : 'unknown');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const checkForPwaUpdate = useCallback(async () => {
    if (!navigator.onLine) {
      setPwaUpdateStatus('offline');
      return;
    }
    if (updateAvailableRef.current) {
      setPwaUpdateStatus('update_available');
      return;
    }
    const registration = serviceWorkerRegistrationRef.current;
    if (!registration) {
      setPwaUpdateStatus('unknown');
      return;
    }
    setPwaUpdateStatus('checking');
    try {
      await registration.update();
      setPwaUpdateStatus(updateAvailableRef.current ? 'update_available' : 'up_to_date');
    } catch {
      setPwaUpdateStatus(navigator.onLine ? 'unknown' : 'offline');
    }
  }, []);

  const runBoot = useCallback(async () => {
    const run = ++bootRunRef.current;
    clearTimeout(retryTimerRef.current);
    // Do not close or re-open IndexedDB here. Chrome queues a second open
    // behind a still-pending first request and never delivers either.
    setShowEgg(false);
    if (!recoveringRef.current) {
      setBootError(false);
      setLoading(true);
    }
    const offerRetry = setTimeout(() => {
      if (bootRunRef.current !== run) return;
      recoveringRef.current = true;
      setBootError(true);
    }, 2_000);
    try {
      const saved = await loadGameStateForBoot(undefined, 2_000, 4);
      if (bootRunRef.current !== run) return;
      recoveringRef.current = false;
      setBootError(false);
      if (saved && !isHatchableBoot(saved)) {
        // CRITICAL: If the creature has already hatched, never show the egg again.
        // The hatched flag is a permanent lifecycle transition.
        const now = authoritativeNow();
        const awayMs = now - saved.lastSaved;
        let returningState = saved;
        let offlineActivities: OfflineActivity[] = [];
        if (awayMs > 60000) {
          const { state: updated, activities } = simulateOfflineTime(saved, awayMs, now);
          returningState = updated;
          offlineActivities = activities;
        }
        // A completed life holds the quiet room: no circadian sleep, no return
        // greeting, no welcome-back ritual. Reload must never resurrect it.
        const ready = isDead(returningState)
          ? returningState
          : applyCircadianSleep(registerReturn(returningState, awayMs, now, offlineActivities), now);
        gameStateRef.current = ready;
        setGameState(ready);
        setLocalSaveStatus('saved');
        setShowEgg(false);
      } else {
        // Confirmed empty: missing DB or an unhatched record. Never invent a life.
        gameStateRef.current = null;
        setShowEgg(true);
        setLocalSaveStatus('unknown');
      }
      setLoading(false);
    } catch (error) {
      if (bootRunRef.current !== run) return;
      console.warn('Becoming could not read local state during boot.', error);
      setLocalSaveStatus('unavailable');
      recoveringRef.current = true;
      setBootError(true);
      setLoading(false);
      retryTimerRef.current = setTimeout(() => {
        if (bootRunRef.current === run) void runBoot();
      }, 300);
    } finally {
      clearTimeout(offerRetry);
    }
  }, []);

  // Load saved state. Every run performs fresh finite open attempts; the
  // recovery action below calls this same path without reloading the page.
  useEffect(() => {
    void runBoot();
    return () => {
      bootRunRef.current += 1;
      clearTimeout(retryTimerRef.current);
    };
  }, [runBoot]);

  // Auto-save. The scheduler keeps the production one-second idle debounce but
  // caps the pending window, so a continuous update stream (the 1440× harness
  // drives several cadences at one real second) flushes every few seconds
  // instead of re-arming the debounce forever and never persisting.
  const queueSave = useCallback((state: GameState) => {
    if (!saveSchedulerRef.current) {
      saveSchedulerRef.current = new SaveScheduler(SAVE_DEBOUNCE_MS, SAVE_MAX_WAIT_MS, () => {
        const snapshot = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (!snapshot) return;
        void saveGameState(snapshot)
          .then(() => setLocalSaveStatus('saved'))
          .catch(() => setLocalSaveStatus('unavailable'));
      });
    }
    pendingSaveRef.current = state;
    setLocalSaveStatus('saving');
    saveSchedulerRef.current.update();
  }, []);

  const prepareForUpdate = useCallback(async () => {
    updatingRef.current = true;
    saveSchedulerRef.current?.cancel();
    pendingSaveRef.current = null;
    const latest = gameStateRef.current;
    try {
      if (!resettingRef.current && latest?.development.hatched) {
        setLocalSaveStatus('saving');
        await saveGameState(latest);
        setLocalSaveStatus('saved');
      }
      // Chrome hangs if the next document opens becoming-db while this
      // connection is still closing. Wait for close, then reload.
      await closeDatabaseForReload();
    } catch (error) {
      setLocalSaveStatus('unavailable');
      updatingRef.current = false;
      throw error;
    }
  }, []);

  const handleUpdateFailed = useCallback(() => {
    updatingRef.current = false;
  }, []);

  // Open-Meteo is a source, never a gameplay controller. This lifecycle only
  // refreshes the central WorldEnvironment cache. Needs, behaviour and memory
  // interpret that shared state in their own systems.
  const refreshWorldWeather = useCallback(async (force = false) => {
    // An accelerated future cannot have truthful live observations. Let any
    // existing snapshot age out through the normal cache/fallback rules.
    if (isDevTimeSimulationActive()) return;
    const currentState = gameStateRef.current;
    const world = currentState?.world;
    const location = world?.settings.location;
    if (!currentState || !world || !location || (world.settings.mode !== 'device' && world.settings.mode !== 'city')) return;
    const now = authoritativeNow();
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
        const updated = { ...previous, world: failWeatherRefresh(previous.world, 'weather_unavailable', authoritativeNow()) };
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
      if (resettingRef.current || updatingRef.current) return;
      const latest = gameStateRef.current;
      if (latest?.development.hatched) void saveGameState(latest);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveLatest();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const handlePageHide = () => {
      if (resettingRef.current || updatingRef.current) return;
      const latest = gameStateRef.current;
      if (latest?.development.hatched) {
        void saveGameState(latest).finally(closeDatabaseConnections);
      } else {
        closeDatabaseConnections();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Advance from timestamps, not interval counts. Background throttling and
  // device sleep therefore cannot pause or double-count the creature's body.
  // Health rides the same single physiology heartbeat — it owns no timer.
  useEffect(() => {
    if (!hasGameState || showEgg) return;
    const advance = () => {
      setGameState(prev => {
        if (!prev) return prev;
        // Physiology, rest and daily moments stop with the life. The save
        // stays, the room stays, only the body no longer changes.
        if (isDead(prev)) return prev;
        const now = authoritativeNow();
        const advanced = advanceHealth(advanceNeeds(prev, now), now);
        const updated = ensureDailyMoment(applyCircadianSleep(advanced, now), now);
        queueSave(updated);
        return updated;
      });
    };
    advance();
    needsTimerRef.current = setInterval(advance, cadenceDelay(30_000));
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
      const candidate = typeof newState === 'function' ? newState(prev) : newState;
      const updated = observeDevelopmentSignals(prev, candidate);
      gameStateRef.current = updated;
      queueSave(updated);
      return updated;
    });
  }, [queueSave]);

  const handleHatch = useCallback(() => {
    setShowEgg(false);
  }, []);

  const handleNameChosen = useCallback(async (name: string) => {
    const creature = createNewCreature(name);
    const hatched = createHatchedCreature({
      ...creature,
      conversation: { ...creature.conversation, language: detectUiLanguage() },
    });
    // The first room is proof of a durable life, not optimistic UI. If the
    // write cannot complete, EggHatching stays mounted and offers a retry.
    await saveGameState(hatched);
    setLocalSaveStatus('saved');
    gameStateRef.current = hatched;
    setGameState(hatched);
  }, []);

  const handleReset = useCallback(async () => {
    const previous = gameStateRef.current;
    resettingRef.current = true;
    saveSchedulerRef.current?.cancel();
    pendingSaveRef.current = null;
    // Prevent pagehide from recreating the just-deleted creature during the
    // reload that follows a successful reset.
    gameStateRef.current = null;
    try {
      await resetForNewLife();
      window.location.reload();
    } catch (error) {
      resettingRef.current = false;
      gameStateRef.current = previous;
      console.warn('Becoming could not complete Start over.', error);
      window.alert(detectUiLanguage() === 'pl'
        ? 'Nie udało się zacząć od nowa. Obecny stworek nie został usunięty.'
        : 'Could not start over. The current creature was not removed.');
    }
  }, []);

  if (loading || bootError) {
    const polish = detectUiLanguage() === 'pl';
    return (
      <>
        <div className="h-screen w-screen bg-room-dark flex items-center justify-center px-6">
          <div className="max-w-sm text-center font-serif">
            <p className={`text-warm-100/80 text-base ${bootError ? '' : 'animate-pulse'}`}>
              {polish ? 'Otwieram lokalny zapis…' : 'Opening the local save…'}
            </p>
            {bootError && (
              <>
                <p className="text-warm-200/50 text-xs mt-2">
                  {polish
                    ? 'Czekam na ten sam zapis — bez drugiego otwarcia.'
                    : 'Waiting on the same save — not a second open.'}
                </p>
                <button type="button" onClick={() => void runBoot()} className="mt-5 min-h-11 rounded-xl border border-warm-300/25 bg-warm-300/15 px-5 py-2 text-warm-100 text-xs">
                  {polish ? 'Spróbuj ponownie' : 'Try again'}
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (showEgg) {
    return (
      <>
        <div className="h-screen w-screen">
          <EggHatching onHatch={handleHatch} onNameChosen={handleNameChosen} />
        </div>
        <PwaUpdateNotice language={detectUiLanguage()} needRefresh={needRefresh} setNeedRefresh={setNeedRefresh} updateServiceWorker={updateServiceWorker} onBeforeUpdate={prepareForUpdate} onUpdateFailed={handleUpdateFailed} />
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
        <Room state={safeState} onStateChange={handleStateChange} onReset={handleReset} version={APP_VERSION} buildId={__BUILD_ID__} pwaUpdateStatus={pwaUpdateStatus} localSaveStatus={localSaveStatus} onCheckForUpdate={checkForPwaUpdate} />
      </div>
      {import.meta.env.DEV && import.meta.env.MODE === 'simulation' ? (
        <div className="fixed left-2 top-2 z-[100] rounded-md border border-amber-300/60 bg-black/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-200 pointer-events-none">
          Dev simulation · 1 creature day / 1 real minute
        </div>
      ) : null}
      <PwaUpdateNotice language={uiLanguage(safeState.conversation.language)} needRefresh={needRefresh} setNeedRefresh={setNeedRefresh} updateServiceWorker={updateServiceWorker} onBeforeUpdate={prepareForUpdate} onUpdateFailed={handleUpdateFailed} />
    </>
  );
}

export default App;
