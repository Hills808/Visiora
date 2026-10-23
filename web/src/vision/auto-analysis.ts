import { CONFIG } from '../config.js';
import { compareViews } from './view-change.js';

/** One current view, no image queue; bounded recovery needs a new, budgeted capture. */
export class AutoAnalysis {
  private baseline: readonly number[] | null = null;
  private lastAt = -Infinity;
  private paused = false;
  private needsCapture = false;
  private retryAt: number | null = null;
  private failures = 0;
  private deliveryExpirations = 0;
  reset(): void {
    this.baseline = null;
    this.lastAt = -Infinity;
    this.paused = false;
    this.needsCapture = false;
    this.retryAt = null;
    this.failures = 0;
    this.deliveryExpirations = 0;
  }
  pause(): void {
    this.paused = true;
    this.retryAt = null;
  }
  get isPaused(): boolean {
    return this.paused;
  }
  invalidate(): void {
    this.needsCapture = true;
  }
  expiredSnapshot(now: number): boolean {
    if (this.paused) return false;
    this.deliveryExpirations++;
    if (this.deliveryExpirations > CONFIG.online.maxRecoveryAttempts) {
      this.pause();
      return false;
    }
    this.retryAt = now + CONFIG.online.recoveryDelayMs;
    this.invalidate();
    return true;
  }
  delivered(): void {
    this.deliveryExpirations = 0;
  }
  get recovering(): boolean {
    return this.retryAt !== null;
  }
  succeeded(): void {
    this.failures = 0;
    this.retryAt = null;
  }
  failed(now: number, transient: boolean): boolean {
    this.failures++;
    if (!transient || this.failures > CONFIG.online.maxRecoveryAttempts) {
      this.pause();
      return false;
    }
    this.retryAt = now + CONFIG.online.recoveryDelayMs;
    this.needsCapture = true;
    return true;
  }
  due(now: number, signature: readonly number[], ready: boolean, busy: boolean): boolean {
    if (
      this.paused ||
      !ready ||
      busy ||
      !signature.length ||
      now - this.lastAt < CONFIG.online.autoIntervalMs ||
      (this.retryAt !== null && now < this.retryAt)
    )
      return false;
    if (!this.baseline || this.needsCapture) return true;
    if (signature.length !== this.baseline.length) return false;
    return compareViews(this.baseline, signature).changed;
  }
  dispatched(now: number, signature: readonly number[]): void {
    this.lastAt = now;
    this.baseline = signature.slice();
    this.needsCapture = false;
    this.retryAt = null;
  }
}
