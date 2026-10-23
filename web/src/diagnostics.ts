import type { Utterance } from './brain/types.js';

interface Stamp {
  frameId: number;
  capturedAtMs: number;
}
/** Numeric provenance only: no images, object names, model rankings or spoken text. */
export class RecognitionTrace {
  private objects: Stamp | null = null;
  private scene: Stamp | null = null;
  private description: {
    createdAtMs: number;
    objectFrames: number[];
    sceneFrame: number | null;
    oldestEvidenceAtMs: number | null;
  } | null = null;
  recordObjects(stamp: Stamp): void {
    this.objects = { frameId: stamp.frameId, capturedAtMs: stamp.capturedAtMs };
  }
  recordScene(stamp: Stamp): void {
    this.scene = { frameId: stamp.frameId, capturedAtMs: stamp.capturedAtMs };
  }
  recordDescription(utterance: Utterance): void {
    const times = utterance.facts.map((f) => f.observedAtMs).filter(Number.isFinite);
    if (utterance.sceneCapturedAtMs !== undefined) times.push(utterance.sceneCapturedAtMs);
    this.description = {
      createdAtMs: utterance.createdAt,
      objectFrames: [...new Set(utterance.facts.map((f) => f.frameId).filter(Number.isFinite))],
      sceneFrame: utterance.sceneFrameId ?? null,
      oldestEvidenceAtMs: times.length ? Math.min(...times) : null,
    };
  }
  label(now: number): string {
    return this.description
      ? `Última descrição · há ${Math.max(0, Math.floor((now - this.description.createdAtMs) / 1000))} s`
      : '';
  }
  snapshot(): object {
    return {
      lastAcceptedObjectFrame: this.objects,
      lastAcceptedSceneFrame: this.scene,
      lastDescription: this.description,
    };
  }
  clear(): void {
    this.objects = null;
    this.scene = null;
    this.description = null;
  }
}
