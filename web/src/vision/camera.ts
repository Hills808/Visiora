import { CONFIG } from '../config.js';
import type { BoxDetection } from './yolox.js';
import type { SceneAnalysis } from './scene.js';
import type { SceneStatus } from './scene-model.js';
export interface VisionResult {
  frameId: number;
  capturedAtMs: number;
  detections: BoxDetection[];
  latencyMs: number;
  provider?: 'webgpu' | 'wasm';
  moving?: boolean;
}
export class Camera {
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private inFlight = false;
  private id = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private canvas = document.createElement('canvas');
  private sourceCanvas = document.createElement('canvas');
  private verificationCanvas = document.createElement('canvas');
  private sceneCanvas = document.createElement('canvas');
  private sceneReady = false;
  private lastSceneCapture = -Infinity;
  private sceneWorker: Worker | null = null;
  private sceneInFlight = false;
  private sceneWatchdog: ReturnType<typeof setTimeout> | null = null;
  economy = false;
  private generation = 0;
  private fingerprint: number[] = [];
  private moving = false;
  constructor(
    private video: HTMLVideoElement,
    private onResult: (result: VisionResult) => void,
    private onError: (message: string) => void,
    private onSceneStatus: (value: SceneStatus) => void = () => undefined,
    private onSceneResult: (value: SceneAnalysis) => void = () => undefined,
  ) {}
  async start(status: (message: string) => void): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('A câmera precisa de HTTPS ou de localhost e de um navegador compatível.');
    status('Aguardando permissão para a câmera…');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: CONFIG.capture.width },
        height: { ideal: CONFIG.capture.height },
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
    status('Preparando a visão local. O primeiro acesso baixa o modelo…');
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('O modelo demorou a iniciar. Tente novamente ou abra a demonstração.'));
      }, CONFIG.vision.workerTimeoutMs);
      worker.onerror = (event): void => {
        clearTimeout(timeout);
        reject(new Error(event.message || 'Não foi possível iniciar a visão local.'));
      };
      worker.onmessage = (event: MessageEvent<{ type: string; message?: string }>): void => {
        if (event.data.type === 'status' && event.data.message) status(event.data.message);
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          resolve();
        }
        if (event.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(event.data.message));
        }
      };
      worker.postMessage({ type: 'init' });
    });
    if (generation !== this.generation) return;
    worker.onerror = (event): void => {
      this.stop();
      this.onError(event.message || 'A visão local parou.');
    };
    worker.onmessage = (
      event: MessageEvent<VisionResult & { type: string; message?: string }>,
    ): void => {
      if (generation !== this.generation) return;
      this.inFlight = false;
      if (this.watchdog) clearTimeout(this.watchdog);
      if (event.data.type === 'error') {
        this.stop();
        this.onError(event.data.message || 'Falha na percepção.');
        return;
      }
      if (event.data.type === 'result') this.onResult({ ...event.data, moving: this.moving });
      this.schedule();
    };
    this.canvas.width = CONFIG.vision.size;
    this.canvas.height = CONFIG.vision.size;
    this.verificationCanvas.width = CONFIG.vision.verificationSize;
    this.verificationCanvas.height = CONFIG.vision.verificationSize;
    this.sceneCanvas.width = CONFIG.classification.size;
    this.sceneCanvas.height = CONFIG.classification.size;
    this.startScenes(generation);
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (generation === this.generation) {
        this.stop();
        this.onError('A câmera foi desconectada.');
      }
    });
    this.capture();
  }
  private schedule(): void {
    this.timer = setTimeout(
      () => this.capture(),
      1000 / (this.economy ? CONFIG.capture.economyFps : CONFIG.capture.fps),
    );
  }
  private capture(): void {
    if (!this.worker || this.inFlight || !this.stream) return;
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) {
      this.schedule();
      return;
    }
    const capturedAtMs = performance.now();
    this.sourceCanvas.width = width;
    this.sourceCanvas.height = height;
    const source = this.sourceCanvas.getContext('2d');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    const verification = this.verificationCanvas.getContext('2d', { willReadFrequently: true });
    if (!context || !source || !verification) {
      this.onError('Seu navegador não disponibilizou o processamento de imagem.');
      this.stop();
      return;
    }
    const size = CONFIG.vision.size;
    const ratio = Math.min(size / width, size / height);
    source.drawImage(this.video, 0, 0, width, height);
    context.fillStyle = `rgb(${CONFIG.vision.pad},${CONFIG.vision.pad},${CONFIG.vision.pad})`;
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.drawImage(
      this.sourceCanvas,
      0,
      0,
      Math.floor(width * ratio),
      Math.floor(height * ratio),
    );
    const pixels = context.getImageData(0, 0, size, size);
    const verificationSize = CONFIG.vision.verificationSize;
    const verificationRatio = Math.min(verificationSize / width, verificationSize / height);
    verification.fillStyle = context.fillStyle;
    verification.fillRect(0, 0, verificationSize, verificationSize);
    verification.imageSmoothingEnabled = true;
    verification.drawImage(
      this.sourceCanvas,
      0,
      0,
      Math.floor(width * verificationRatio),
      Math.floor(height * verificationRatio),
    );
    const verificationPixels = verification.getImageData(0, 0, verificationSize, verificationSize);
    const fingerprint: number[] = [];
    for (let i = 0; i < pixels.data.length; i += CONFIG.capture.motionSampleStride)
      fingerprint.push(pixels.data[i] / 255);
    const delta =
      this.fingerprint.length === fingerprint.length
        ? fingerprint.reduce((sum, value, i) => sum + Math.abs(value - this.fingerprint[i]), 0) /
          fingerprint.length
        : 0;
    this.moving = delta > CONFIG.capture.motionDelta;
    this.fingerprint = fingerprint;
    this.inFlight = true;
    const frameId = ++this.id;
    let sceneRgba: ArrayBuffer | undefined;
    if (
      this.sceneReady &&
      !this.sceneInFlight &&
      !this.moving &&
      capturedAtMs - this.lastSceneCapture >= CONFIG.classification.sampleMs
    ) {
      const sceneContext = this.sceneCanvas.getContext('2d', { willReadFrequently: true });
      if (!sceneContext) {
        this.onError('Não consegui preparar a imagem do ambiente.');
        this.stop();
        return;
      }
      sceneContext.imageSmoothingEnabled = true;
      sceneContext.imageSmoothingQuality = 'high';
      sceneContext.drawImage(
        this.sourceCanvas,
        0,
        0,
        CONFIG.classification.size,
        CONFIG.classification.size,
      );
      sceneRgba = sceneContext.getImageData(
        0,
        0,
        CONFIG.classification.size,
        CONFIG.classification.size,
      ).data.buffer as ArrayBuffer;
      this.lastSceneCapture = capturedAtMs;
    }
    this.worker.postMessage(
      {
        type: 'frame',
        frameId,
        capturedAtMs,
        rgba: pixels.data.buffer,
        verificationRgba: verificationPixels.data.buffer,
        bounds: { width, height, ratio },
      },
      [pixels.data.buffer, verificationPixels.data.buffer],
    );
    if (sceneRgba && this.sceneWorker) {
      this.sceneInFlight = true;
      this.sceneWorker.postMessage({ type: 'frame', frameId, capturedAtMs, rgba: sceneRgba }, [
        sceneRgba,
      ]);
      this.sceneWatchdog = setTimeout(() => {
        this.sceneWorker?.terminate();
        this.sceneWorker = null;
        this.sceneReady = false;
        this.sceneInFlight = false;
        this.onSceneStatus({
          state: 'error',
          message: 'A análise de ambiente demorou demais. A câmera continua identificando objetos.',
        });
      }, CONFIG.classification.inferenceTimeoutMs);
    }
    this.watchdog = setTimeout(() => {
      this.stop();
      this.onError('A percepção não respondeu a tempo. A câmera foi parada.');
    }, CONFIG.vision.inferenceTimeoutMs);
  }
  stop(): void {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    this.sceneWorker?.terminate();
    this.sceneWorker = null;
    this.sceneInFlight = false;
    if (this.sceneWatchdog) clearTimeout(this.sceneWatchdog);
    this.sceneWatchdog = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.inFlight = false;
    this.fingerprint = [];
    this.moving = false;
    this.sceneReady = false;
    this.lastSceneCapture = -Infinity;
    for (const canvas of [
      this.sourceCanvas,
      this.canvas,
      this.verificationCanvas,
      this.sceneCanvas,
    ]) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (this.timer) clearTimeout(this.timer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.timer = null;
    this.watchdog = null;
  }
  retryScenes(): void {
    if (this.stream) this.startScenes(this.generation);
  }
  private startScenes(generation: number): void {
    this.sceneWorker?.terminate();
    if (this.sceneWatchdog) clearTimeout(this.sceneWatchdog);
    this.sceneReady = false;
    this.sceneInFlight = false;
    this.lastSceneCapture = -Infinity;
    const worker = new Worker(new URL('./scene-worker.js', import.meta.url), { type: 'module' });
    this.sceneWorker = worker;
    worker.onerror = (event) => {
      if (generation !== this.generation || this.sceneWorker !== worker) return;
      this.sceneReady = false;
      this.sceneInFlight = false;
      if (this.sceneWatchdog) clearTimeout(this.sceneWatchdog);
      this.onSceneStatus({
        state: 'error',
        message:
          event.message || 'O reconhecimento de ambientes não iniciou. A câmera continua ativa.',
      });
    };
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        state?: SceneStatus['state'];
        message?: string;
        analysis?: SceneAnalysis;
      }>,
    ): void => {
      if (generation !== this.generation || this.sceneWorker !== worker) return;
      if (event.data.type === 'scene-status' && event.data.state) {
        this.sceneReady = event.data.state === 'ready';
        if (event.data.state === 'error') {
          this.sceneInFlight = false;
          if (this.sceneWatchdog) clearTimeout(this.sceneWatchdog);
        }
        this.onSceneStatus({ state: event.data.state, message: event.data.message ?? '' });
      } else if (event.data.type === 'scene-result') {
        this.sceneInFlight = false;
        if (this.sceneWatchdog) clearTimeout(this.sceneWatchdog);
        if (event.data.analysis) this.onSceneResult(event.data.analysis);
      }
    };
    worker.postMessage({ type: 'init' });
  }
}
