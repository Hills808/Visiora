import { CONFIG } from '../config.js';
import catalog from '../data/scene-catalog.json' with { type: 'json' };
import type { SceneEvidence } from './types.js';

export const PLACES: Record<string, string> = Object.fromEntries(
  catalog.filter((item) => !item.reject).map((item) => [item.id, item.label]),
);

/** Temporal acceptance only. Object labels never decide the type of environment. */
export class SceneEstimator {
  private candidate: string | null = null;
  private since = 0;
  private confirmed: string | null = null;
  private lastAt = -Infinity;
  private lastFrame = -1;
  private samples = 0;
  private clock = 0;
  get room(): string | null {
    return this.confirmed;
  }
  get stamp(): { frameId: number; capturedAtMs: number } | undefined {
    return this.confirmed ? { frameId: this.lastFrame, capturedAtMs: this.lastAt } : undefined;
  }
  clear(): void {
    this.candidate = null;
    this.confirmed = null;
    this.samples = 0;
  }
  update(evidence: SceneEvidence | undefined, now: number): boolean {
    this.clock = now;
    this.current(now);
    if (
      !evidence ||
      evidence.frameId <= this.lastFrame ||
      !Number.isFinite(evidence.capturedAtMs) ||
      evidence.capturedAtMs > now + CONFIG.capture.futureToleranceMs ||
      now - evidence.capturedAtMs > CONFIG.capture.maxFrameAgeMs
    )
      return false;
    const gap = evidence.capturedAtMs - this.lastAt;
    this.lastFrame = evidence.frameId;
    this.lastAt = evidence.capturedAtMs;
    if (!evidence.accepted || !evidence.category || !PLACES[evidence.category]) {
      this.clear();
      return true;
    }
    if (evidence.category !== this.candidate || gap > CONFIG.scene.maxSampleGapMs) {
      this.candidate = evidence.category;
      this.since = evidence.capturedAtMs;
      this.confirmed = null;
      this.samples = 0;
    }
    this.samples++;
    if (
      this.samples >= CONFIG.scene.minSamples &&
      evidence.capturedAtMs - this.since >= CONFIG.scene.stableMs
    )
      this.confirmed = this.candidate;
    return true;
  }
  current(now = this.clock): string | null {
    if (now - this.lastAt > CONFIG.scene.maxEvidenceAgeMs) this.clear();
    return this.confirmed;
  }
  describe(now = this.clock): string {
    const room = this.current(now);
    return room ? `Parece ${PLACES[room]}.` : 'Não tenho certeza de que lugar é este.';
  }
}
