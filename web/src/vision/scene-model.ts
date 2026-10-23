import { CONFIG } from '../config.js';
import * as ort from '../vendor/ort.webgpu.min.mjs';
import { loadModelAsset, verifiedData } from './model-assets.js';
import {
  hasVisualInformation,
  packSceneRgb,
  type SceneAnalysis,
  type SceneEmbeddings,
} from './scene.js';
import { classifyConsensus, packPlacesRgb, parsePlacesLabels } from './scene-consensus.js';

export interface SceneStatus {
  state: 'loading' | 'ready' | 'error';
  message: string;
}
export class ScenePerception {
  private session: ort.InferenceSession | null = null;
  private places: ort.InferenceSession | null = null;
  private labels: string[] = [];
  private embeddings: SceneEmbeddings | null = null;
  private loading = false;
  private provider: 'webgpu' | 'wasm' = 'wasm';
  constructor(private status: (value: SceneStatus) => void) {}
  async load(forceCpu = false): Promise<void> {
    if (this.session || this.loading) return;
    this.loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.classification.loadTimeoutMs);
    this.status({
      state: 'loading',
      message: 'Preparando o reconhecimento de ambientes neste aparelho.',
    });
    try {
      const base = new URL('../models/siglip2/', import.meta.url);
      const { bytes, manifest } = await loadModelAsset(base, controller.signal, (done, total) =>
        this.status({
          state: 'loading',
          message: `Baixando reconhecimento de ambientes: ${Math.round((done / total) * 100)}%.`,
        }),
      );
      const encoded = await verifiedData(
        base,
        'embeddings.json',
        manifest.embeddings_sha256,
        controller.signal,
      );
      const embeddings = JSON.parse(new TextDecoder().decode(encoded)) as SceneEmbeddings;
      if (
        embeddings.dimensions !== CONFIG.classification.dimensions ||
        !Array.isArray(embeddings.candidates)
      )
        throw new Error('Modelo e descrições incompatíveis.');
      const placesBase = new URL('../models/places365/', import.meta.url);
      const places = await loadModelAsset(placesBase, controller.signal, (done, total) =>
        this.status({
          state: 'loading',
          message: `Baixando comparação de ambientes: ${Math.round((done / total) * 100)}%.`,
        }),
      );
      this.labels = parsePlacesLabels(
        new TextDecoder().decode(
          await verifiedData(
            placesBase,
            'categories.txt',
            places.manifest.labels_sha256,
            controller.signal,
          ),
        ),
      );
      const initialize = async (provider: 'webgpu' | 'wasm'): Promise<void> => {
        this.session = await ort.InferenceSession.create(bytes, {
          executionProviders: [provider],
          graphOptimizationLevel: 'all',
        });
        this.places = await ort.InferenceSession.create(places.bytes, {
          executionProviders: [provider],
          graphOptimizationLevel: 'all',
        });
        const input = new ort.Tensor(
          'float32',
          new Float32Array(3 * CONFIG.classification.size ** 2),
          [1, 3, CONFIG.classification.size, CONFIG.classification.size],
        );
        try {
          const first = await this.session.run({ pixel_values: input });
          Object.values(first).forEach((value) => value.dispose());
          const second = await this.places.run({ [this.places.inputNames[0]]: input });
          Object.values(second).forEach((value) => value.dispose());
        } finally {
          input.dispose();
        }
        this.provider = provider;
      };
      if (!forceCpu && (navigator as Navigator & { gpu?: unknown }).gpu) {
        try {
          await initialize('webgpu');
        } catch (error) {
          await this.release();
          console.warn(
            JSON.stringify({
              event: 'scene_webgpu_fallback',
              reason: error instanceof Error ? error.message : 'unknown',
            }),
          );
          this.status({
            state: 'loading',
            message: 'GPU indisponível para ambientes. Preparando CPU.',
          });
        }
      }
      if (!this.session || !this.places) await initialize('wasm');
      this.embeddings = embeddings;
      this.status({
        state: 'ready',
        message: `Dois modelos comparam a imagem inteira na ${this.provider === 'webgpu' ? 'GPU' : 'CPU'}. A análise pode admitir dúvida.`,
      });
    } catch (error) {
      await this.release();
      const message =
        error instanceof Error
          ? error.message
          : 'Não consegui preparar o reconhecimento de ambientes.';
      this.status({ state: 'error', message });
      console.error(JSON.stringify({ event: 'scene_model_unavailable', message }));
    } finally {
      clearTimeout(timeout);
      this.loading = false;
    }
  }
  async analyze(
    rgba: Uint8ClampedArray,
    frameId: number,
    capturedAtMs: number,
  ): Promise<SceneAnalysis | undefined> {
    if (!this.session || !this.places || !this.embeddings) return undefined;
    if (!hasVisualInformation(rgba))
      return {
        frameId,
        capturedAtMs,
        source: 'image-model',
        accepted: false,
        category: null,
        reason: 'poor-image',
        similarity: 0,
        margin: 0,
        top: [],
        latencyMs: 0,
      };
    const started = performance.now();
    const tensor = new ort.Tensor('float32', packSceneRgb(rgba), [
      1,
      3,
      CONFIG.classification.size,
      CONFIG.classification.size,
    ]);
    let outputs: Record<string, ort.Tensor> | undefined;
    let placeOutputs: Record<string, ort.Tensor> | undefined;
    const placeTensor = new ort.Tensor('float32', packPlacesRgb(rgba), [
      1,
      3,
      CONFIG.classification.size,
      CONFIG.classification.size,
    ]);
    try {
      outputs = await this.session.run({ pixel_values: tensor });
      placeOutputs = await this.places.run({ [this.places.inputNames[0]]: placeTensor });
      const analysis = classifyConsensus(
        outputs.pooler_output.data,
        this.embeddings,
        placeOutputs[this.places.outputNames[0]].data,
        this.labels,
        frameId,
        capturedAtMs,
      );
      analysis.latencyMs = performance.now() - started;
      return analysis;
    } catch (error) {
      const failedProvider = this.provider;
      await this.release();
      if (failedProvider === 'webgpu') {
        this.status({ state: 'loading', message: 'A GPU parou. Reiniciando ambientes na CPU.' });
        await this.load(true);
        return undefined;
      }
      const message =
        error instanceof Error ? error.message : 'A análise de ambientes foi interrompida.';
      this.status({ state: 'error', message });
      console.error(JSON.stringify({ event: 'scene_inference_failed', message }));
      return undefined;
    } finally {
      tensor.dispose();
      placeTensor.dispose();
      if (outputs) Object.values(outputs).forEach((item) => item.dispose());
      if (placeOutputs) Object.values(placeOutputs).forEach((item) => item.dispose());
    }
  }
  private async release(): Promise<void> {
    const sessions = [this.session, this.places];
    this.session = null;
    this.places = null;
    this.embeddings = null;
    this.labels = [];
    const released = await Promise.allSettled(
      sessions.filter((session) => session !== null).map((session) => session.release()),
    );
    const failures = released.filter((result) => result.status === 'rejected').length;
    if (failures) console.warn(JSON.stringify({ event: 'scene_release_failed', failures }));
  }
}
