export type Sector =
  | 'front'
  | 'frontRight'
  | 'right'
  | 'backRight'
  | 'back'
  | 'backLeft'
  | 'left'
  | 'frontLeft';
export interface Pose {
  x: number;
  y: number;
  yaw: number;
}
export interface MetricDepth {
  meters: number;
  sigma: number;
  source: 'metric' | 'simulation';
  frameId: number;
}
export interface Detection {
  cls: string;
  score: number;
  bearing: number;
  depth?: MetricDepth;
}
export interface Observation {
  frameId: number;
  capturedAtMs: number;
  detections: Detection[];
  pose: Pose;
  yawRate: number;
  moving?: boolean;
  scene?: SceneEvidence;
}
export interface SceneEvidence {
  category: string | null;
  accepted: boolean;
  source: 'image-model' | 'simulation';
  frameId: number;
  capturedAtMs: number;
}
export interface Entity {
  id: string;
  cls: string;
  score: number;
  bearing: number;
  x?: number;
  y?: number;
  lastSeen: number;
  lastFrameId: number;
  firstSeen: number;
  hits: number;
  misses: number;
  visible: boolean;
}
export interface Fact {
  id: string;
  cls: string;
  score: number;
  sector: Sector;
  bearing: number;
  range?: number;
  age: number;
  confirmed: boolean;
  visible: boolean;
  approaching: boolean;
  frameId: number;
  observedAtMs: number;
}
export type SpeechKind = 'briefing' | 'novelty' | 'answer' | 'alert';
export interface Utterance {
  id: string;
  text: string;
  facts: Fact[];
  kind: SpeechKind;
  priority: number;
  createdAt: number;
  expiresAt: number;
  sceneCategory?: string;
  sceneFrameId?: number;
  sceneCapturedAtMs?: number;
}
export type Question = 'ahead' | 'describe' | 'where' | 'find' | 'repeat';
export type Verbosity = 'essential' | 'balanced' | 'detailed';
export interface BrainOptions {
  stepLength: number;
  verbosity: Verbosity;
  alerts: boolean;
  auto: boolean;
}
