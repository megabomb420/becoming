import { GameState, Memory, OfflineActivity } from '../types';
import { generateDreamAfterSleep } from './innerLifeSystem';

export function simulateOfflineTime(state: GameState, awayMs: number): { state: GameState; activities: OfflineActivity[] } {
  const activities: OfflineActivity[] = [];
  let currentState = { ...state };
  const awayMinutes = awayMs / 60000;

  if (awayMinutes < 2) {
    return { state: currentState, activities };
  }

  const now = Date.now();
  const leftAt = now - awayMs;

  // If creature was sleeping when user left, model continued sleep
  const wasSleeping = state.sleepState === 'sleeping';
  const sleepStart = state.sleepStartTimestamp ?? leftAt;
  const sleepDuration = wasSleeping ? Math.min(awayMs, now - sleepStart) : 0;

  if (wasSleeping && sleepDuration > 0) {
    // Creature slept for part or all of the absence
    const sleptMinutes = sleepDuration / 60000;
    const wakeThreshold = 480; // 8 hours of sleep is plenty
    if (sleptMinutes >= wakeThreshold) {
      currentState = {
        ...currentState,
        sleepState: 'awake',
        currentActivity: null,
        sleepStartTimestamp: undefined,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + 60),
        },
      };
      currentState = generateDreamAfterSleep(currentState, sleepDuration, now);
      activities.push({ type: 'slept', duration: sleptMinutes, timestamp: now - sleepDuration / 2 });
    } else {
      // Still sleeping or just woke up
      currentState = {
        ...currentState,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + sleptMinutes * 0.5),
        },
      };
      if (awayMinutes > wakeThreshold) {
        currentState.sleepState = 'awake';
        currentState.currentActivity = null;
        currentState.sleepStartTimestamp = undefined;
      }
      activities.push({ type: 'slept', duration: sleptMinutes, timestamp: now - sleepDuration / 2 });
    }
  }

  // Check if absence spanned night hours (22:00 - 06:00) and creature wasn't already sleeping
  if (!wasSleeping && awayMinutes > 60) {
    const leftHour = new Date(leftAt).getHours();
    const returnHour = new Date(now).getHours();
    const spannedNight = (leftHour >= 22 || leftHour <= 6) || (returnHour >= 22 || returnHour <= 6) || awayMinutes > 480;

    if (spannedNight) {
      currentState = {
        ...currentState,
        sleepState: 'awake',
        currentActivity: null,
        sleepStartTimestamp: undefined,
        needs: {
          ...currentState.needs,
          energy: Math.min(100, currentState.needs.energy + 40),
        },
      };
      currentState = generateDreamAfterSleep(currentState, awayMs * 0.6, now);
      activities.push({ type: 'slept', duration: awayMinutes * 0.6, timestamp: now - awayMs / 2 });
    }
  }

  // Independent exploration based on personality (only if awake)
  if (currentState.sleepState === 'awake') {
    const exploreChance = currentState.personality.curiosity / 100;
    const independence = currentState.personality.independence / 100;

    if (awayMinutes > 30 && Math.random() < exploreChance * independence) {
      const discoveries = ['looked at objects', 'moved something', 'sat quietly', 'explored room'];
      activities.push({
        type: discoveries[Math.floor(Math.random() * discoveries.length)],
        duration: awayMinutes * 0.3,
        timestamp: now - awayMs * 0.3,
      });

      currentState = {
        ...currentState,
        needs: {
          ...currentState.needs,
          stimulation: Math.min(100, currentState.needs.stimulation + 10),
          hunger: Math.max(0, currentState.needs.hunger - awayMinutes * 0.5),
        },
      };
    }
  }

  // Emotional response to absence
  if (awayMinutes > 120) {
    const attachment = currentState.personality.affection / 100;
    const valence = attachment > 0.5 ? 0.2 : -0.1;
    const memory: Memory = {
      id: `mem-absence-${now}`,
      timestamp: now,
      content: `user was gone for ${Math.floor(awayMinutes / 60)} hours`,
      importance: 4 + Math.floor(awayMinutes / 60),
      emotionalValence: valence,
      tags: ['absence', 'user'],
      mentioned: false,
      understood: currentState.development.cognitiveLevel > 30,
      compressed: false,
    };
    currentState.memories = [...currentState.memories, memory].slice(-200);
  }

  // Decay needs from offline time (less aggressive than active)
  currentState = {
    ...currentState,
    needs: {
      hunger: Math.max(0, currentState.needs.hunger - awayMinutes * 0.4),
      energy: Math.max(0, currentState.needs.energy - awayMinutes * 0.15),
      comfort: Math.max(0, currentState.needs.comfort - awayMinutes * 0.1),
      stimulation: Math.max(0, currentState.needs.stimulation - awayMinutes * 0.2),
      social: Math.max(0, currentState.needs.social - awayMinutes * 0.15),
    },
  };

  // Age progresses
  currentState = {
    ...currentState,
    development: {
      ...currentState.development,
      chronologicalAge: currentState.development.chronologicalAge + awayMs,
    },
    lastSaved: now,
  };

  return { state: currentState, activities };
}
