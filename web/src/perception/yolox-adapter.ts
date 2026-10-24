import { CONFIG } from '../config.js';
import { COCO_KEYS, type BoxDetection } from '../vision/yolox.js';
import {
  LocalFrameDiscardedError,
  type LocalFrame,
  type LocalPerceptionAdapter,
  type LocalResult,
} from './frame.js';
import { YoloxPreparer } from './yolox-preparation.js';

const SOURCE = Object.freeze({
  id: 'yolox',
  revision: 'nano-tiny-s-consensus-v1',
  simulated: false,
});
const MODEL = 'YOLOX Nano/Tiny/S';
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = (value: Record<string, unknown>, names: string[]): boolean =>
  Object.keys(value).length === names.length && names.every((key) => Object.hasOwn(value, key));
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const provider = (value: unknown): value is 'webgpu' | 'wasm' =>
  value === 'webgpu' || value === 'wasm';
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= CONFIG.vision.statusMaxChars;

export function validYoloxDetections(value: unknown): value is BoxDetection[] {
  return (
    Array.isArray(value) &&
    value.length <= CONFIG.vision.maxDetections &&
    value.every((item: unknown) => {
      if (!record(item) || !fields(item, ['cls', 'score', 'box', 'bearing'])) return false;
      const box = item.box;
      return (
        typeof item.cls === 'string' &&
        COCO_KEYS.includes(item.cls) &&
        finite(item.score) &&
        item.score >= 0 &&
        item.score <= 1 &&
        finite(item.bearing) &&
        Array.isArray(box) &&
        box.length === 4 &&
        box.every((n: unknown) => finite(n) && n >= 0 && n <= 1) &&
        box[2] > box[0] &&
        box[3] > box[1]
      );
    })
  );
}

/** Owns a separate worker; no model-specific decoding or temporal memory here. */
export class YoloxAdapter implements LocalPerceptionAdapter {
  private preparer = new YoloxPreparer();
  readonly managesInferenceTimeout = true;
  readonly source = SOURCE;
  readonly input = {
    width: CONFIG.vision.verificationSize,
    height: CONFIG.vision.verificationSize,
    preserveAspectRatio: true,
  };
  private worker: Worker | null = null;
  private disposed = false;
  private recovering = false;
  private recovered = false;
  private failure: Error | null = null;
  private activeProvider: 'webgpu' | 'wasm' = 'wasm';
  private cancelPending: ((error: Error) => void) | null = null;
  private cancelInitialization: ((error: Error) => void) | null = null;
  private initializationMs: number[] = [];
  private inferenceMs: number[] = [];
  private inferenceByProvider: Record<'webgpu' | 'wasm', number[]> = { webgpu: [], wasm: [] };
  private initializationByProvider: Record<'webgpu' | 'wasm', number[]> = { webgpu: [], wasm: [] };
  private preparationMs: number[] = [];
  private runtimeErrors = 0;
  private constructor(private onStatus?: (status: string) => void) {}

  static async create(
    signal: AbortSignal,
    onStatus?: (status: string) => void,
  ): Promise<YoloxAdapter> {
    const adapter = new YoloxAdapter(onStatus);
    const abort = (): void => adapter.dispose();
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (signal.aborted) throw new Error('Local initialization canceled');
      await adapter.initialize(false);
      return adapter;
    } catch (error) {
      adapter.dispose();
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  diagnostics(): object {
    return {
      source: this.source,
      model: MODEL,
      provider: this.activeProvider,
      recovering: this.recovering,
      recoveries: Number(this.recovered),
      runtimeErrors: this.runtimeErrors,
      initializationMs: this.initializationMs.slice(),
      inferenceMs: this.inferenceMs.slice(),
      inferenceBasis:
        'aggregate-across-providers; use inferenceByProvider for backend measurements',
      inferenceByProvider: {
        webgpu: this.inferenceByProvider.webgpu.slice(),
        wasm: this.inferenceByProvider.wasm.slice(),
      },
      initializationByProvider: {
        webgpu: this.initializationByProvider.webgpu.slice(),
        wasm: this.initializationByProvider.wasm.slice(),
      },
      preparationMs: this.preparationMs.slice(),
    };
  }
  private sample(values: number[], value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    values.push(value);
    if (values.length > CONFIG.ui.diagnosticSamples) values.shift();
  }
  private async initialize(forceCpu: boolean): Promise<void> {
    if (this.disposed) throw new Error('Local worker stopped');
    const started = performance.now();
    const worker = new Worker(new URL('../vision/worker.js', import.meta.url), { type: 'module' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error): void => {
        clearTimeout(timer);
        this.cancelInitialization = null;
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(
        () => finish(new Error('Local initialization timed out')),
        CONFIG.vision.workerTimeoutMs,
      );
      this.cancelInitialization = (error) => finish(error);
      worker.onerror = worker.onmessageerror = () =>
        finish(new Error('Local initialization failed'));
      worker.onmessage = (event: MessageEvent<unknown>): void => {
        const data = event.data;
        if (!record(data)) return finish(new Error('Invalid local initialization protocol'));
        if (data.type === 'status' && fields(data, ['type', 'message']) && text(data.message)) {
          this.onStatus?.(data.message);
          return;
        }
        if (
          data.type === 'ready' &&
          fields(data, ['type', 'model', 'provider']) &&
          text(data.model) &&
          provider(data.provider) &&
          (!forceCpu || data.provider === 'wasm')
        ) {
          this.activeProvider = data.provider;
          finish();
          return;
        }
        finish(
          new Error(
            data.type === 'error'
              ? 'Local initialization failed'
              : 'Invalid local initialization protocol',
          ),
        );
      };
      try {
        worker.postMessage({ type: 'init', forceCpu });
      } catch {
        finish(new Error('Local initialization transfer failed'));
      }
    });
    const elapsed = performance.now() - started;
    this.sample(this.initializationMs, elapsed);
    this.sample(this.initializationByProvider[this.activeProvider], elapsed);
  }
  private recover(): void {
    this.recovered = true;
    this.recovering = true;
    this.worker?.terminate();
    this.worker = null;
    this.onStatus?.('A GPU parou. Preparando a visão local na CPU; o quadro foi descartado.');
    void this.initialize(true).then(
      () => {
        this.recovering = false;
      },
      () => {
        this.recovering = false;
        this.failure = new Error('Local CPU recovery failed');
        this.worker?.terminate();
        this.worker = null;
        this.onStatus?.('A percepção local não conseguiu continuar na CPU.');
      },
    );
  }
  analyze(frame: LocalFrame, signal: AbortSignal): Promise<LocalResult> {
    if (this.disposed || signal.aborted) return Promise.reject(new Error('Local worker stopped'));
    if (this.failure) return Promise.reject(this.failure);
    if (this.recovering)
      return Promise.reject(new LocalFrameDiscardedError('Local CPU initializing'));
    if (!this.worker || this.cancelPending) return Promise.reject(new Error('Local worker busy'));
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, result?: LocalResult): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        this.cancelPending = null;
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        if (error) reject(error);
        else if (result) resolve(result);
      };
      const runtimeFailure = (): void => {
        this.runtimeErrors++;
        if (this.activeProvider === 'webgpu' && !this.recovered) {
          finish(new LocalFrameDiscardedError('GPU frame discarded'));
          this.recover();
        } else {
          finish(new Error('Local inference failed'));
        }
      };
      const abort = (): void => this.dispose();
      const timer = setTimeout(runtimeFailure, CONFIG.vision.inferenceTimeoutMs);
      this.cancelPending = (error) => finish(error);
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = worker.onmessageerror = runtimeFailure;
      worker.onmessage = (event: MessageEvent<unknown>): void => {
        const data = event.data;
        if (
          record(data) &&
          data.type === 'error' &&
          fields(data, ['type', 'message']) &&
          text(data.message)
        ) {
          runtimeFailure();
          return;
        }
        if (
          !record(data) ||
          !fields(data, [
            'type',
            'frameId',
            'capturedAtMs',
            'detections',
            'latencyMs',
            'provider',
          ]) ||
          data.type !== 'result' ||
          data.frameId !== frame.stamp.frameId ||
          data.capturedAtMs !== frame.stamp.capturedAtMs ||
          data.provider !== this.activeProvider ||
          !finite(data.latencyMs) ||
          data.latencyMs < 0 ||
          !validYoloxDetections(data.detections)
        ) {
          finish(new Error('Invalid local result protocol'));
          return;
        }
        this.sample(this.inferenceMs, data.latencyMs);
        this.sample(this.inferenceByProvider[this.activeProvider], data.latencyMs);
        finish(undefined, {
          schemaVersion: 1,
          stamp: { ...frame.stamp },
          transform: { ...frame.transform },
          source: this.source,
          observations: data.detections.map((item) => ({
            label: item.cls,
            score: item.score,
            verified: item.cls === 'person',
            box: {
              x: item.box[0],
              y: item.box[1],
              width: item.box[2] - item.box[0],
              height: item.box[3] - item.box[1],
            },
          })),
        });
      };
      try {
        const started = performance.now();
        const prepared = this.preparer.prepare(frame);
        // Pending callbacks retain provenance, never the copied input pixel buffer.
        frame = { stamp: frame.stamp, transform: frame.transform, rgba: new ArrayBuffer(0) };
        this.sample(this.preparationMs, performance.now() - started);
        worker.postMessage(
          {
            type: 'frame',
            frameId: frame.stamp.frameId,
            capturedAtMs: frame.stamp.capturedAtMs,
            ...prepared,
          },
          [prepared.rgba, prepared.verificationRgba],
        );
      } catch {
        finish(new Error('Local frame preparation or transfer failed'));
      }
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preparer.dispose();
    this.worker?.terminate();
    this.worker = null;
    this.cancelPending?.(new Error('Local worker stopped'));
    this.cancelInitialization?.(new Error('Local worker stopped'));
  }
}
