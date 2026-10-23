import { CONFIG } from '../config.js';
import type { FrameAccess, FrameStamp, LocalFrame } from '../perception/frame.js';

/** Sole owner of the Luna camera. Consumers copy the same latest frame, never queue images. */
export class CaptureHub {
  private stream: MediaStream | null = null;
  private epoch = 0;
  private frameId = 0;
  private latest: FrameStamp | null = null;
  private canvas = document.createElement('canvas');
  private derivative = document.createElement('canvas');
  private subscribers = new Set<(frame: FrameAccess) => void>();
  private callbackId: number | null = null;
  private backend: 'video-frame' | 'animation-frame' = 'animation-frame';
  private lastMediaTime = -Infinity;
  private lastDecoded = -1;
  private lastCopyAt = -Infinity;
  private copies = 0;

  constructor(
    private video: HTMLVideoElement,
    private onEnd: () => void,
  ) {}
  subscribe(consume: (frame: FrameAccess) => void): () => void {
    this.subscribers.add(consume);
    return () => this.subscribers.delete(consume);
  }
  get current(): FrameStamp | null {
    return this.latest;
  }
  get fresh(): boolean {
    return Boolean(
      this.stream &&
        this.latest &&
        performance.now() - this.latest.capturedAtMs <= CONFIG.capture.maxFrameAgeMs,
    );
  }
  diagnostics(): object {
    return { backend: this.backend, frames: this.copies, fresh: this.fresh, pendingFrames: 0 };
  }
  async start(sessionGeneration: number): Promise<void> {
    this.stop();
    const epoch = this.epoch;
    this.copies = 0;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('A câmera precisa de localhost ou HTTPS.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: CONFIG.online.imageMaxSide },
        height: { ideal: CONFIG.online.preferredHeight },
      },
    });
    if (epoch !== this.epoch) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    const ended = (): void => {
      if (epoch !== this.epoch) return;
      this.stop();
      this.onEnd();
    };
    stream
      .getVideoTracks()
      .forEach((track) => track.addEventListener('ended', ended, { once: true }));
    try {
      await this.video.play();
      if (epoch !== this.epoch) return;
      this.backend =
        typeof this.video.requestVideoFrameCallback === 'function'
          ? 'video-frame'
          : 'animation-frame';
      const next = (): void => {
        if (epoch !== this.epoch) return;
        if (this.backend === 'video-frame') {
          this.callbackId = this.video.requestVideoFrameCallback((_now, metadata) => {
            if (epoch !== this.epoch) return;
            this.copy(sessionGeneration, metadata.mediaTime, metadata.presentedFrames, ended);
            next();
          });
        } else {
          this.callbackId = requestAnimationFrame(() => {
            if (epoch !== this.epoch) return;
            this.copy(
              sessionGeneration,
              this.video.currentTime,
              this.video.getVideoPlaybackQuality?.().totalVideoFrames ?? null,
              ended,
            );
            next();
          });
        }
      };
      next();
    } catch (error) {
      if (epoch === this.epoch) this.stop();
      throw error;
    }
  }
  private copy(
    generation: number,
    mediaTime: number,
    decoded: number | null,
    ended: () => void,
  ): void {
    const now = performance.now();
    if (
      !this.stream ||
      this.video.paused ||
      this.video.readyState < 2 ||
      now - this.lastCopyAt < CONFIG.ui.tickMs ||
      (decoded !== null ? decoded <= this.lastDecoded : mediaTime <= this.lastMediaTime)
    )
      return;
    const width = this.video.videoWidth,
      height = this.video.videoHeight;
    if (!width || !height) return;
    const ratio = Math.min(1, CONFIG.online.imageMaxSide / Math.max(width, height));
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    const context = this.canvas.getContext('2d');
    if (!context) {
      ended();
      return;
    }
    try {
      context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const stamp: FrameStamp = Object.freeze({
        schemaVersion: 1,
        sessionGeneration: generation,
        frameId: ++this.frameId,
        capturedAtMs: now,
        width: this.canvas.width,
        height: this.canvas.height,
        orientation: 'browser-upright',
        mirrored: false,
      });
      this.latest = stamp;
      this.lastCopyAt = now;
      this.lastDecoded = decoded ?? this.lastDecoded;
      this.lastMediaTime = mediaTime;
      this.copies++;
      const frame: FrameAccess = { stamp, pixels: (w, h) => this.pixels(stamp, w, h) };
      for (const consume of this.subscribers) {
        if (this.latest !== stamp) break;
        consume(frame);
      }
    } catch {
      ended();
    }
  }
  private pixels(stamp: FrameStamp, width: number, height: number): LocalFrame {
    if (this.latest !== stamp || !this.fresh) throw new Error('Quadro indisponível ou expirado.');
    if (
      ![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= CONFIG.online.imageMaxSide)
    )
      throw new Error('Dimensões de percepção não suportadas.');
    this.derivative.width = width;
    this.derivative.height = height;
    const context = this.derivative.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Processamento de imagem indisponível.');
    context.drawImage(this.canvas, 0, 0, width, height);
    return {
      stamp,
      transform: { width, height, scaleX: width / stamp.width, scaleY: height / stamp.height },
      rgba: context.getImageData(0, 0, width, height).data.buffer as ArrayBuffer,
    };
  }
  async jpeg(): Promise<{ stamp: FrameStamp; image: Blob }> {
    const stamp = this.latest,
      epoch = this.epoch;
    if (!stamp || !this.fresh)
      throw new Error('A câmera ainda não disponibilizou uma imagem recente.');
    // toBlob snapshots the canvas at invocation; later frames do not relabel this image.
    const image = await new Promise<Blob | null>((resolve) =>
      this.canvas.toBlob(resolve, 'image/jpeg', CONFIG.online.jpegQuality),
    );
    if (epoch !== this.epoch || !this.stream) throw new Error('A captura foi cancelada.');
    if (!image || image.size > CONFIG.online.maxImageBytes)
      throw new Error('A imagem ficou grande demais. Faça uma nova consulta.');
    return { stamp, image };
  }
  stop(): void {
    this.epoch++;
    if (this.callbackId !== null) {
      if (this.backend === 'video-frame') this.video.cancelVideoFrameCallback(this.callbackId);
      else cancelAnimationFrame(this.callbackId);
    }
    this.callbackId = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.latest = null;
    this.lastMediaTime = this.lastCopyAt = -Infinity;
    this.lastDecoded = -1;
    for (const canvas of [this.canvas, this.derivative]) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
