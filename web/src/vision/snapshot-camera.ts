import { CONFIG } from '../config.js';
import type { FrameAccess } from '../perception/frame.js';
import { CaptureHub } from './capture-hub.js';

/** Motion/settling policy, separate from capture ownership and local inference. */
export class SnapshotCamera {
  readonly hub: CaptureHub;
  private epoch = 0;
  private fingerprint: number[] = [];
  private stableAt = Infinity;
  private lastSampleAt = -Infinity;
  private moving = false;
  private stableReported = false;
  motionRevision = 0;
  constructor(
    video: HTMLVideoElement,
    private onMotion: () => void,
    onEnd: () => void,
    private onStable: () => void = () => undefined,
  ) {
    this.hub = new CaptureHub(video, onEnd);
    this.hub.subscribe((frame) => this.sample(frame));
  }
  get signature(): readonly number[] {
    return this.fingerprint;
  }
  get stable(): boolean {
    return (
      this.hub.fresh && !this.moving && performance.now() - this.stableAt >= CONFIG.motion.settleMs
    );
  }
  get ready(): boolean {
    return this.hub.fresh && this.fingerprint.length > 0;
  }
  async start(generation = 0): Promise<void> {
    this.stop();
    await this.hub.start(generation);
  }
  private sample(frame: FrameAccess): void {
    const { motionWidth: width, motionHeight: height } = CONFIG.online;
    const pixels = new Uint8ClampedArray(frame.pixels(width, height).rgba);
    const now = frame.stamp.capturedAtMs;
    if (now - this.lastSampleAt > CONFIG.capture.maxFrameAgeMs) {
      this.stableAt = now;
      this.stableReported = false;
    }
    this.lastSampleAt = now;
    const next = Array.from(
      { length: (pixels.length / 4) * 3 },
      (_, i) => pixels[Math.floor(i / 3) * 4 + (i % 3)] / 255,
    );
    const delta = this.fingerprint.length
      ? next.reduce((sum, n, i) => sum + Math.abs(n - this.fingerprint[i]), 0) / next.length
      : 0;
    const moving = delta > CONFIG.capture.motionDelta;
    if (moving) {
      this.stableReported = false;
      this.stableAt = Infinity;
      this.motionRevision++;
      if (!this.moving) this.onMotion();
    } else if (this.moving) this.stableAt = now;
    this.moving = moving;
    this.fingerprint = next;
    if (this.stable && !this.stableReported) {
      this.stableReported = true;
      this.onStable();
    }
  }
  async capture(): Promise<{
    image: Blob;
    frameId: number;
    capturedAtMs: number;
    width: number;
    height: number;
  }> {
    if (!this.ready) throw new Error('Aguardando o primeiro quadro recente da câmera.');
    const epoch = this.epoch;
    const { image, stamp } = await this.hub.jpeg();
    if (epoch !== this.epoch || !this.ready)
      throw new Error('A captura foi cancelada ou a câmera deixou de fornecer quadros recentes.');
    return {
      image,
      frameId: stamp.frameId,
      capturedAtMs: stamp.capturedAtMs,
      width: stamp.width,
      height: stamp.height,
    };
  }
  stop(): void {
    this.epoch++;
    this.motionRevision++;
    this.hub.stop();
    this.fingerprint = [];
    this.moving = false;
    this.stableAt = Infinity;
    this.lastSampleAt = -Infinity;
    this.stableReported = false;
  }
}
