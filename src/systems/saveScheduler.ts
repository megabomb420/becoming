type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * A wall-clock save debounce that cannot be postponed forever.
 *
 * Ordinary interaction keeps debounce semantics: a save fires `debounceMs`
 * after the last update, coalescing a burst of updates into one write. But a
 * continuous update stream must not reset that debounce indefinitely. The
 * 1440× dev harness drives several existing cadences at one real second, so
 * without a cap the pending save would be re-armed on every tick and never
 * flush. `maxWaitMs` bounds the pending window from its first update, and the
 * spacing guard in `save` keeps actual writes at least `maxWaitMs` apart
 * whichever order the browser delivers same-instant timers in.
 *
 * Scheduling is wall-clock only. Simulated time remains authoritative for
 * gameplay; this class only paces real IndexedDB writes.
 */
export class SaveScheduler {
  private timer: TimerHandle | null = null;
  private pendingSince = 0;
  private lastSaveAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly debounceMs: number,
    private readonly maxWaitMs: number,
    private readonly onSave: () => void,
    private readonly now: () => number = Date.now,
    private readonly setTimer: (fn: () => void, ms: number) => TimerHandle = (fn, ms) => setTimeout(fn, ms),
    private readonly clearTimer: (handle: TimerHandle) => void = handle => clearTimeout(handle),
  ) {}

  /** A new state update arrived; schedule (or immediately perform) the save. */
  update(): void {
    const now = this.now();
    if (this.timer !== null) {
      const fireTime = Math.min(now + this.debounceMs, this.pendingSince + this.maxWaitMs);
      this.clearTimer(this.timer);
      if (fireTime <= now) {
        this.timer = null;
        this.save(now);
      } else {
        this.timer = this.setTimer(() => this.fire(), fireTime - now);
      }
      return;
    }
    this.pendingSince = now;
    this.timer = this.setTimer(() => this.fire(), this.debounceMs);
  }

  /** Discard any pending save; callers that flush directly take over. */
  cancel(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.pendingSince = 0;
  }

  private fire(): void {
    this.timer = null;
    this.save(this.now());
  }

  private save(now: number): void {
    if (now - this.lastSaveAt >= this.maxWaitMs) {
      this.lastSaveAt = now;
      this.onSave();
      return;
    }
    this.timer = this.setTimer(() => this.fire(), this.lastSaveAt + this.maxWaitMs - now);
  }
}

/** Idle delay after the last update before an ordinary save. Unchanged from production. */
export const SAVE_DEBOUNCE_MS = 1_000;

/**
 * Hard cap on how long a pending save can be postponed by an update stream.
 * Sporadic production interactions never reach it; the accelerated harness's
 * one-second cadences flush every few real seconds instead of starving.
 */
export const SAVE_MAX_WAIT_MS = 5_000;
