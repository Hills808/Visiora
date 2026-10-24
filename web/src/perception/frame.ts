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
  readonly input: { width: number; height: number; preserveAspectRatio?: boolean };
  /** Worker transport owns the inference watchdog so GPU recovery can discard, not abort. */
  readonly managesInferenceTimeout?: boolean;
  analyze(frame: LocalFrame, signal: AbortSignal): Promise<LocalResult>;
  dispose(): void;
}

/** A failed GPU frame is discarded while the independent worker initializes on CPU. */
export class LocalFrameDiscardedError extends Error {}

export function localInputSize(
  stamp: Pick<FrameStamp, 'width' | 'height'>,
  input: LocalPerceptionAdapter['input'],
): { width: number; height: number } {
  if (!input.preserveAspectRatio) return { width: input.width, height: input.height };
  const ratio = Math.min(input.width / stamp.width, input.height / stamp.height);
  return {
    width: Math.max(1, Math.floor(stamp.width * ratio)),
    height: Math.max(1, Math.floor(stamp.height * ratio)),
  };
}
