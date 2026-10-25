import { CONFIG } from '../config.js';
import { CaptureError } from './capture-error.js';
import type { FrameAccess, FrameStamp, LocalFrame } from '../perception/frame.js';

/** Sole owner of the Luna camera. Consumers copy the same latest frame, never queue images. */
export class CaptureHub {
  private stream: MediaStream | null = null;
  private epoch = 0;
  private frameId = 0;
  private latest: FrameStamp | null = null;
  private canvas = document.createElement('canvas');
  private derivatives = new Map<string, HTMLCanvasElement>();
  private subscribers = new Set<(frame: FrameAccess) => void>();
  private callbackId: number | null = null;
  private backend: 'video-frame' | 'animation-frame' = 'animation-frame';
  private lastMediaTime = -Infinity;
  private lastDecoded = -1;
  private frameBasis: 'waiting' | 'presented-frames' | 'decoded-frames' | 'media-time' = 'waiting';
  private lastCopyAt = -Infinity;
  private copies = 0;
  private cancelJpeg: (() => void) | null = null;
  private jpegCounts = {
    requested: 0,
    completed: 0,
    canceled: 0,
    timeouts: 0,
    stale: 0,
    failed: 0,
  };

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
        performance.now() >= this.latest.capturedAtMs &&
        performance.now() - this.latest.capturedAtMs <= CONFIG.capture.maxFrameAgeMs,
    );
  }
  diagnostics(): object {
    return {
      backend: this.backend,
      frameBasis: this.frameBasis,
      frames: this.copies,
      fresh: this.fresh,
      pendingFrames: 0,
      jpeg: { ...this.jpegCounts, inFlight: Number(this.cancelJpeg !== null) },
    };
  }
  async start(sessionGeneration: number): Promise<void> {
    this.stop();
    const epoch = this.epoch;
    this.copies = 0;
    this.jpegCounts = { requested: 0, completed: 0, canceled: 0, timeouts: 0, stale: 0, failed: 0 };
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
    // Some browsers expose a quality API with a permanent zero counter. It is not frame evidence.
    const counter =
      decoded !== null && Number.isSafeInteger(decoded) && decoded > 0 ? decoded : null;
    if (
      !this.stream ||
      this.video.paused ||
      this.video.readyState < 2 ||
      now - this.lastCopyAt < CONFIG.ui.tickMs ||
      (counter !== null ? counter <= this.lastDecoded : mediaTime <= this.lastMediaTime)
    )
      return;
    const width = this.video.videoWidth,
      height = this.video.videoHeight;
    if (!width || !height) return;
    const ratio = Math.min(1, CONFIG.online.imageMaxSide / Math.max(width, height));
    const targetWidth = Math.round(width * ratio),
      targetHeight = Math.round(height * ratio);
    if (this.canvas.width !== targetWidth) this.canvas.width = targetWidth;
    if (this.canvas.height !== targetHeight) this.canvas.height = targetHeight;
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
      this.lastDecoded = counter ?? this.lastDecoded;
      this.frameBasis =
        counter === null
          ? 'media-time'
          : this.backend === 'video-frame'
            ? 'presented-frames'
            : 'decoded-frames';
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
    const key = `${width}x${height}`;
    let derivative = this.derivatives.get(key);
    if (!derivative) {
      if (this.derivatives.size >= CONFIG.continuous.derivativeCanvases) {
        const first = this.derivatives.keys().next().value!;
        const expired = this.derivatives.get(first)!;
        expired.width = expired.height = 0;
        this.derivatives.delete(first);
      }
      derivative = document.createElement('canvas');
      derivative.width = width;
      derivative.height = height;
      this.derivatives.set(key, derivative);
    }
    const context = derivative.getContext('2d', { willReadFrequently: true });
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
    const counts = this.jpegCounts;
    if (!stamp || !this.fresh) {
      counts.stale++;
      throw new CaptureError('capture-stale');
    }
    if (this.cancelJpeg) throw new CaptureError('capture-busy');
    counts.requested++;
    try {
      // toBlob snapshots pixels at invocation; new video frames never relabel this image.
      const image = await new Promise<Blob>((resolve, reject) => {
        let settled = false;
        const finish = (value: Blob | null, error?: CaptureError): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.cancelJpeg = null;
          if (error) reject(error);
          else if (!value) reject(new CaptureError('capture-empty'));
          else if (value.size > CONFIG.online.maxImageBytes)
            reject(new CaptureError('capture-size'));
          else resolve(value);
        };
        const timer = setTimeout(
          () => finish(null, new CaptureError('capture-timeout')),
          CONFIG.capture.jpegTimeoutMs,
        );
        this.cancelJpeg = () => finish(null, new CaptureError('capture-canceled'));
        try {
          this.canvas.toBlob((value) => finish(value), 'image/jpeg', CONFIG.online.jpegQuality);
        } catch {
          finish(null, new CaptureError('capture-unavailable'));
        }
      });
      if (epoch !== this.epoch || !this.stream) throw new CaptureError('capture-canceled');
      const age = performance.now() - stamp.capturedAtMs;
      if (age < 0 || age > CONFIG.capture.maxFrameAgeMs) throw new CaptureError('capture-stale');
      counts.completed++;
      return { stamp, image };
    } catch (error) {
      if (error instanceof CaptureError) {
        if (error.code === 'capture-canceled') counts.canceled++;
        else if (error.code === 'capture-timeout') counts.timeouts++;
        else if (error.code === 'capture-stale') counts.stale++;
        else counts.failed++;
      }
      throw error;
    }
  }
  stop(): void {
    this.epoch++;
    this.cancelJpeg?.();
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
    this.frameBasis = 'waiting';
    for (const canvas of [this.canvas, ...this.derivatives.values()]) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.derivatives.clear();
  }
}
