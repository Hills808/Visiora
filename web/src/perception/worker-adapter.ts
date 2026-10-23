import type { LocalFrame, LocalPerceptionAdapter, LocalResult, LocalSource } from './frame.js';

/** Transport for stateless local workers. H1 supplies a fake only from the test harness. */
export class WorkerLocalAdapter implements LocalPerceptionAdapter {
  private disposed = false;
  private rejectPending: ((error: Error) => void) | null = null;
  constructor(
    private worker: Worker,
    readonly source: LocalSource,
    readonly input: { width: number; height: number },
  ) {}
  analyze(frame: LocalFrame, signal: AbortSignal): Promise<LocalResult> {
    if (this.disposed || signal.aborted) return Promise.reject(new Error('Local worker stopped'));
    if (this.rejectPending) return Promise.reject(new Error('Local worker busy'));
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        signal.removeEventListener('abort', abort);
        this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
        this.rejectPending = null;
      };
      const fail = (error: Error): void => {
        cleanup();
        reject(error);
      };
      const abort = (): void => {
        this.dispose();
      };
      this.rejectPending = fail;
      this.worker.onmessage = (event: MessageEvent<LocalResult>): void => {
        cleanup();
        resolve(event.data);
      };
      this.worker.onerror = this.worker.onmessageerror = (): void =>
        fail(new Error('Local worker failed'));
      signal.addEventListener('abort', abort, { once: true });
      try {
        this.worker.postMessage(frame, [frame.rgba]);
      } catch {
        fail(new Error('Local frame transfer failed'));
      }
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    this.rejectPending?.(new Error('Local worker stopped'));
  }
}
