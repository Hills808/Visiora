import { CONFIG } from '../config.js';
import { decodeYolox, packBgr, type ImageBounds } from './yolox.js';
import * as ort from '../vendor/ort.webgpu.min.mjs';
import { loadModelAsset, verifiedData, type ModelManifest } from './model-assets.js';
import { composeDetections, type DetectorHead, type HeadDetections } from './person-consensus.js';
import { loadRuntimeWasm } from './runtime-wasm.js';
type Request =
  | { type: 'init'; forceCpu?: boolean }
  | {
      type: 'frame';
      frameId: number;
      capturedAtMs: number;
      rgba: ArrayBuffer;
      verificationRgba: ArrayBuffer;
      bounds: ImageBounds;
    };
const heads: { id: DetectorHead; size: number; session: ort.InferenceSession }[] = [];
let provider: 'webgpu' | 'wasm' = 'wasm';
let busy = false;
const scope = self as unknown as {
  onmessage: (event: MessageEvent<Request>) => void;
  postMessage(message: unknown): void;
};
scope.onmessage = async (event: MessageEvent<Request>): Promise<void> => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
      ort.env.wasm.wasmBinary = await loadRuntimeWasm();
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.logLevel = 'error';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.vision.workerTimeoutMs);
      try {
        const assets: { id: DetectorHead; size: number; bytes: Uint8Array<ArrayBuffer> }[] = [];
        for (const id of ['nano', 'tiny', 's'] as const) {
          const size = id === 's' ? CONFIG.vision.verificationSize : CONFIG.vision.size;
          scope.postMessage({
            type: 'status',
            message: `Preparando visão local: ${id === 'nano' ? 'objetos' : 'verificação de pessoas'}.`,
          });
          let bytes: Uint8Array<ArrayBuffer>;
          if (id === 'nano') {
            const base = new URL('../models/', import.meta.url);
            const response = await fetch(new URL('manifest.json', base), {
              signal: controller.signal,
            });
            if (!response.ok) throw new Error('O modelo de objetos não está disponível.');
            const manifest = (await response.json()) as ModelManifest;
            bytes = await verifiedData(base, 'yolox-nano.onnx', manifest.sha256, controller.signal);
            if (bytes.length !== manifest.bytes) throw new Error('Modelo de objetos incompleto.');
          } else {
            const asset = await loadModelAsset(
              new URL(`../models/yolox-${id}/`, import.meta.url),
              controller.signal,
              (done, total) =>
                scope.postMessage({
                  type: 'status',
                  message: `Baixando verificação de pessoas: ${Math.round((done / total) * 100)}%.`,
                }),
            );
            bytes = asset.bytes;
          }
          assets.push({ id, size, bytes });
        }
        const initialize = async (next: 'webgpu' | 'wasm'): Promise<void> => {
          for (const { id, size, bytes } of assets) {
            const session = await ort.InferenceSession.create(bytes, {
              executionProviders: [next],
              graphOptimizationLevel: 'all',
            });
            heads.push({ id, size, session });
            const warmup = new ort.Tensor(
              'float32',
              new Float32Array(size * size * 3).fill(CONFIG.vision.pad),
              [1, 3, size, size],
            );
            try {
              const result = await session.run({ [session.inputNames[0]]: warmup });
              Object.values(result).forEach((value) => value.dispose());
            } finally {
              warmup.dispose();
            }
          }
          provider = next;
        };
        if (!message.forceCpu && (navigator as Navigator & { gpu?: unknown }).gpu) {
          try {
            await initialize('webgpu');
          } catch (error) {
            const released = await Promise.allSettled(heads.map((head) => head.session.release()));
            heads.length = 0;
            console.warn(
              JSON.stringify({
                component: 'local-vision',
                event: 'webgpu-fallback',
                reason: error instanceof Error ? error.message : 'unknown',
                releaseFailures: released.filter((result) => result.status === 'rejected').length,
              }),
            );
            scope.postMessage({
              type: 'status',
              message: 'GPU indisponível para a visão local. Usando CPU.',
            });
          }
        }
        if (heads.length === 0) await initialize('wasm');
      } finally {
        clearTimeout(timeout);
      }
      scope.postMessage({
        type: 'status',
        message: `Visão local pronta em ${provider === 'webgpu' ? 'GPU' : 'CPU'}: YOLOX Nano/Tiny/S.`,
      });
      scope.postMessage({
        type: 'ready',
        model: 'YOLOX Nano/Tiny/S · pessoas por consenso',
        provider,
      });
      return;
    }
    if (heads.length !== 3 || busy) throw new Error('Percepção indisponível ou ocupada.');
    busy = true;
    const started = performance.now();
    try {
      const small = packBgr(new Uint8ClampedArray(message.rgba));
      const large = packBgr(
        new Uint8ClampedArray(message.verificationRgba),
        CONFIG.vision.verificationSize,
      );
      const byHead: HeadDetections = { nano: [], tiny: [], s: [] };
      for (const { id, size, session } of heads) {
        const tensor = new ort.Tensor('float32', id === 's' ? large : small, [1, 3, size, size]);
        let outputs: Record<string, ort.Tensor> | undefined;
        try {
          outputs = await session.run({ [session.inputNames[0]]: tensor });
          byHead[id] = decodeYolox(
            outputs[session.outputNames[0]].data,
            {
              ...message.bounds,
              ratio: Math.min(size / message.bounds.width, size / message.bounds.height),
            },
            size,
            Infinity,
          );
        } finally {
          tensor.dispose();
          if (outputs) Object.values(outputs).forEach((value) => value.dispose());
        }
      }
      const detections = composeDetections(byHead);
      scope.postMessage({
        type: 'result',
        frameId: message.frameId,
        capturedAtMs: message.capturedAtMs,
        detections,
        latencyMs: performance.now() - started,
        provider,
      });
    } finally {
      busy = false;
    }
  } catch (error) {
    busy = false;
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Falha de percepção local.',
    });
  }
};
