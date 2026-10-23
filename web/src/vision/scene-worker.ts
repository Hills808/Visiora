import * as ort from '../vendor/ort.webgpu.min.mjs';
import { ScenePerception } from './scene-model.js';
type Request =
  | { type: 'init' }
  | { type: 'frame'; frameId: number; capturedAtMs: number; rgba: ArrayBuffer };
const scope = self as unknown as {
  onmessage: (event: MessageEvent<Request>) => void;
  postMessage(message: unknown): void;
};
const scenes = new ScenePerception((status) =>
  scope.postMessage({ type: 'scene-status', ...status }),
);
let busy = false;
scope.onmessage = async (event: MessageEvent<Request>): Promise<void> => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.logLevel = 'error';
      await scenes.load();
      return;
    }
    if (busy) throw new Error('A análise de ambiente já está ocupada.');
    busy = true;
    try {
      const analysis = await scenes.analyze(
        new Uint8ClampedArray(request.rgba),
        request.frameId,
        request.capturedAtMs,
      );
      scope.postMessage({ type: 'scene-result', analysis });
    } finally {
      busy = false;
    }
  } catch (error) {
    scope.postMessage({
      type: 'scene-status',
      state: 'error',
      message: error instanceof Error ? error.message : 'A análise de ambiente falhou.',
    });
  }
};
