/** Browser-local provenance. capturedAtMs is the copy time, not a sensor timestamp. */
export interface FrameStamp {
  schemaVersion: 1;
  sessionGeneration: number;
  frameId: number;
  capturedAtMs: number;
  width: number;
  height: number;
  orientation: 'browser-upright';
  mirrored: false;
}

/** Full-frame resize only in H1; coordinates map back by these scales, with no crop. */
export interface FrameTransform {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}
export interface LocalFrame {
  stamp: FrameStamp;
  transform: FrameTransform;
  rgba: ArrayBuffer;
}
export interface FrameAccess {
  readonly stamp: FrameStamp;
  pixels(width: number, height: number): LocalFrame;
}
export interface LocalSource {
  id: string;
  revision: string;
  simulated: boolean;
}
export interface LocalObservation {
  label: string;
  score: number; // Raw score, never a calibrated probability or permission to speak.
  box: { x: number; y: number; width: number; height: number };
  verified: boolean;
}
export interface LocalResult {
  schemaVersion: 1;
  stamp: FrameStamp;
  transform: FrameTransform;
  source: LocalSource;
  observations: LocalObservation[];
}
/** One stateless inference. Temporal association and speech belong to the brain. */
export interface LocalPerceptionAdapter {
  readonly source: LocalSource;
  readonly input: { width: number; height: number };
  analyze(frame: LocalFrame, signal: AbortSignal): Promise<LocalResult>;
  dispose(): void;
}
