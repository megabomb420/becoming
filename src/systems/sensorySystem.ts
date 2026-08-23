export interface SensoryPreferences {
  sound: boolean;
  haptics: boolean;
}

export type SensoryCue = 'touch' | 'comfort' | 'notice' | 'choice' | 'open' | 'sleep' | 'wake';

const STORAGE_KEY = 'becoming-sensory-v1';
const DEFAULTS: SensoryPreferences = { sound: false, haptics: true };

export function loadSensoryPreferences(): SensoryPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<SensoryPreferences> | null;
    return { sound: value?.sound === true, haptics: value?.haptics !== false };
  } catch {
    return DEFAULTS;
  }
}

export function saveSensoryPreferences(preferences: SensoryPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are a convenience; private browsing may refuse storage.
  }
}

const tones: Record<SensoryCue, [number, number, number]> = {
  touch: [330, 390, 0.035],
  comfort: [260, 440, 0.08],
  notice: [520, 650, 0.04],
  choice: [390, 520, 0.07],
  open: [300, 360, 0.045],
  sleep: [300, 190, 0.12],
  wake: [320, 560, 0.1],
};

const vibration: Record<SensoryCue, number | number[]> = {
  touch: 8,
  comfort: [10, 25, 12],
  notice: 7,
  choice: 12,
  open: 6,
  sleep: 14,
  wake: [8, 22, 8],
};

export function emitSensoryCue(cue: SensoryCue, preferences: SensoryPreferences): void {
  if (preferences.haptics && 'vibrate' in navigator) navigator.vibrate(vibration[cue]);
  if (!preferences.sound) return;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const [start, end, duration] = tones[cue];
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, context.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.01);
    oscillator.addEventListener('ended', () => void context.close());
  } catch {
    // Some browsers reject audio outside direct gestures; haptics still work.
  }
}
