import { CONFIG } from '../config.js';
import { plainLabel } from './evidence.js';
import type { FrameAccess, LocalFrame, LocalPerceptionAdapter, LocalResult } from './frame.js';
import { LocalFrameDiscardedError, localInputSize } from './frame.js';

const sameFields = (actual: object, expected: object): boolean =>
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(
    ([key, value]) => (actual as Record<string, unknown>)[key] === value,
  );

/** Cancel the logical wait even when the backend does not cooperate with abort. */
function abortableAnalysis(
  adapter: LocalPerceptionAdapter,
  frame: LocalFrame,
  signal: AbortSignal,
): Promise<LocalResult> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => signal.removeEventListener('abort', abort);
    const abort = (): void => {
      cleanup();
      reject(new Error('Local inference canceled'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    try {
      // Both handlers stay attached after cancellation: late rejection is consumed,
      // and late success cannot settle the already canceled logical operation.
      adapter.analyze(frame, signal).then(
        (result) => {
          cleanup();
          resolve(result);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        },
      );
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function validLocalResult(
  value: LocalResult,
  frame: LocalFrame,
  adapter: LocalPerceptionAdapter,
): boolean {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !value.stamp ||
    !value.transform ||
    !value.source ||
    !sameFields(value.stamp, frame.stamp) ||
    !sameFields(value.transform, frame.transform) ||
    !sameFields(value.source, adapter.source) ||
    !Array.isArray(value.observations) ||
    value.observations.length > CONFIG.vision.maxDetections
  )
    return false;
  return value.observations.every((item) => {
    const box = item?.box;
    return (
      item &&
      plainLabel(item.label) &&
      Number.isFinite(item.score) &&
      item.score >= 0 &&
      item.score <= 1 &&
      typeof item.verified === 'boolean' &&
      box &&
      [box.x, box.y, box.width, box.height].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
      box.width > 0 &&
      box.height > 0 &&
      box.x + box.width <= 1 &&
      box.y + box.height <= 1
    );
  });
}

/** No frame queue: reserve the slot before copying pixels, release on every terminal path. */
export class LocalPipeline {
  private active = true;
  private pending: AbortController | null = null;
  private lastOfferedId = 0;
  private lastAcceptedId = 0;
  private counts = {
    dispatched: 0,
    accepted: 0,
    busySkipped: 0,
    unavailableSkipped: 0,
    stale: 0,
    invalid: 0,
    errors: 0,
  };
  private latencyMs: number[] = [];
  private failed = false;
  private discarded = 0;
  private errorReason: 'none' | 'timeout' | 'contract' | 'processing' = 'none';
  get busy(): boolean {
    return this.pending !== null;
  }
  constructor(
    private generation: number,
    private adapter: LocalPerceptionAdapter,
    private onResult: (result: LocalResult) => void,
    private onFailure: () => void,
    private now: () => number = () => performance.now(),
  ) {}
  diagnostics(): object {
    return {
      ...this.counts,
      discarded: this.discarded,
      errorReason: this.errorReason,
      state: this.failed
        ? 'error'
        : !this.active
          ? 'stopped'
          : this.adapter.source.simulated
            ? 'simulated'
            : 'active',
      inFlight: Number(this.pending !== null),
      pendingFrames: 0,
      lastAcceptedFrameId: this.lastAcceptedId,
      latencyMs: this.latencyMs.slice(),
    };
  }
  offer(frame: FrameAccess): void {
    const age = this.now() - frame.stamp.capturedAtMs;
    if (!this.active) return;
    if (
      frame.stamp.sessionGeneration !== this.generation ||
      frame.stamp.frameId <= this.lastOfferedId ||
      age < 0 ||
      age > CONFIG.capture.maxFrameAgeMs
    ) {
      this.counts.stale++;
      return;
    }
    this.lastOfferedId = frame.stamp.frameId;
    if (this.pending) {
      this.counts.busySkipped++;
      return;
    }
    if (this.adapter.acceptsFrames === false) {
      this.counts.unavailableSkipped++;
      return;
    }
    const controller = new AbortController();
    this.pending = controller;
    void this.process(frame, controller);
  }
  private async process(access: FrameAccess, controller: AbortController): Promise<void> {
    const timer = this.adapter.managesInferenceTimeout
      ? null
      : setTimeout(() => controller.abort(), CONFIG.vision.inferenceTimeoutMs);
    try {
      const size = localInputSize(access.stamp, this.adapter.input);
      const frame = access.pixels(size.width, size.height);
      this.counts.dispatched++;
      const result = await abortableAnalysis(this.adapter, frame, controller.signal);
      if (!this.active || this.pending !== controller) return;
      if (controller.signal.aborted) throw new Error('Local inference timed out');
      if (!validLocalResult(result, frame, this.adapter)) {
        this.counts.invalid++;
        this.errorReason = 'contract';
        throw new Error('Invalid local result');
      }
      const age = this.now() - frame.stamp.capturedAtMs;
      if (age < 0 || age > CONFIG.capture.maxFrameAgeMs) {
        this.counts.stale++;
        return;
      }
      this.lastAcceptedId = frame.stamp.frameId;
      this.counts.accepted++;
      this.latencyMs.push(age);
      if (this.latencyMs.length > CONFIG.ui.diagnosticSamples) this.latencyMs.shift();
      this.onResult(result);
    } catch (error) {
      if (error instanceof LocalFrameDiscardedError && !controller.signal.aborted) {
        this.discarded++;
        return;
      }
      if (this.active && this.pending === controller) {
        if (controller.signal.aborted) this.errorReason = 'timeout';
        else if (this.errorReason === 'none') this.errorReason = 'processing';
        this.counts.errors++;
        this.failed = true;
        this.stop();
        this.onFailure();
      }
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (this.pending === controller) this.pending = null;
    }
  }
  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.pending?.abort();
    this.pending = null;
    this.adapter.dispose();
  }
}
