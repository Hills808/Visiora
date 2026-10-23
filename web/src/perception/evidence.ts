/** Provider-neutral image evidence. A valid shape is not proof of visual accuracy. */
export interface VisualItem {
  id: string;
  kind: 'person' | 'object' | 'text';
  label: string;
  article: 'um' | 'uma';
  uncertain: boolean;
  box: { x: number; y: number; width: number; height: number } | null;
}
export interface VisualEvidence {
  scene: { label: string; support: string[] } | null;
  observations: VisualItem[];
  relations: { subject: string; object: string; description: string }[];
  limitations: string[];
}
export interface CaptureStamp {
  requestId: string;
  sessionGeneration: number;
  frameId: number;
  capturedAtMs: number;
  width: number;
  height: number;
  intent: 'describe' | 'where' | 'ahead' | 'find';
  term: string;
}
export interface AnalysisResult {
  schemaVersion: 1;
  source: 'luna' | 'fake';
  stamp: CaptureStamp;
  evidence: VisualEvidence;
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]): boolean =>
  Object.keys(v).length === names.length && names.every((name) => Object.hasOwn(v, name));
// Plain labels only; never interpret markup, instructions or arbitrary generated prose as speech.
export const plainLabel = (v: unknown, max = 60): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= max &&
  v.trim() === v &&
  /^[\p{L}\p{N}][\p{L}\p{N} ,()'’\/-]*$/u.test(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validStamp(v: unknown): v is CaptureStamp {
  if (
    !record(v) ||
    !keys(v, [
      'requestId',
      'sessionGeneration',
      'frameId',
      'capturedAtMs',
      'width',
      'height',
      'intent',
      'term',
    ])
  )
    return false;
  return (
    typeof v.requestId === 'string' &&
    /^[a-zA-Z0-9-]{16,64}$/.test(v.requestId) &&
    Number.isSafeInteger(v.sessionGeneration) &&
    Number(v.sessionGeneration) >= 0 &&
    Number.isSafeInteger(v.frameId) &&
    Number(v.frameId) > 0 &&
    finite(v.capturedAtMs) &&
    v.capturedAtMs >= 0 &&
    [v.width, v.height].every((n) => Number.isInteger(n) && Number(n) > 0 && Number(n) <= 1280) &&
    ['describe', 'where', 'ahead', 'find'].includes(String(v.intent)) &&
    typeof v.term === 'string' &&
    (v.term === '' || plainLabel(v.term))
  );
}

export function validEvidence(v: unknown): v is VisualEvidence {
  if (
    !record(v) ||
    !keys(v, ['scene', 'observations', 'relations', 'limitations']) ||
    !Array.isArray(v.observations) ||
    v.observations.length > 12 ||
    !Array.isArray(v.relations) ||
    v.relations.length > 12 ||
    !Array.isArray(v.limitations) ||
    v.limitations.length > 6 ||
    !v.limitations.every((x) => plainLabel(x, 160))
  )
    return false;
  const ids = new Set<string>();
  for (const item of v.observations) {
    if (
      !record(item) ||
      !keys(item, ['id', 'kind', 'label', 'article', 'uncertain', 'box']) ||
      !['um', 'uma'].includes(String(item.article)) ||
      typeof item.id !== 'string' ||
      !/^[a-z0-9-]{1,24}$/.test(item.id) ||
      ids.has(item.id) ||
      !['person', 'object', 'text'].includes(String(item.kind)) ||
      !plainLabel(item.label) ||
      typeof item.uncertain !== 'boolean'
    )
      return false;
    ids.add(item.id);
    if (item.box !== null) {
      const b = item.box;
      if (
        !record(b) ||
        !keys(b, ['x', 'y', 'width', 'height']) ||
        ![b.x, b.y, b.width, b.height].every((n) => finite(n) && n >= 0 && n <= 1) ||
        Number(b.width) <= 0 ||
        Number(b.height) <= 0 ||
        Number(b.x) + Number(b.width) > 1.000001 ||
        Number(b.y) + Number(b.height) > 1.000001
      )
        return false;
    }
  }
  if (
    v.scene !== null &&
    (!record(v.scene) ||
      !keys(v.scene, ['label', 'support']) ||
      !plainLabel(v.scene.label) ||
      !Array.isArray(v.scene.support) ||
      !v.scene.support.length ||
      v.scene.support.length > 12 ||
      !v.scene.support.every((id) => ids.has(id)))
  )
    return false;
  return v.relations.every(
    (r) =>
      record(r) &&
      keys(r, ['subject', 'object', 'description']) &&
      typeof r.subject === 'string' &&
      typeof r.object === 'string' &&
      ids.has(r.subject) &&
      ids.has(r.object) &&
      r.subject !== r.object &&
      plainLabel(r.description, 100),
  );
}

export function parseResult(v: unknown, expected: CaptureStamp): AnalysisResult {
  if (
    !record(v) ||
    !keys(v, ['schemaVersion', 'source', 'stamp', 'evidence']) ||
    v.schemaVersion !== 1 ||
    !['luna', 'fake'].includes(String(v.source)) ||
    !validStamp(v.stamp) ||
    !validEvidence(v.evidence) ||
    Object.keys(expected).some(
      (k) =>
        v.stamp &&
        (v.stamp as unknown as Record<string, unknown>)[k] !==
          (expected as unknown as Record<string, unknown>)[k],
    )
  )
    throw new Error('A análise retornou dados inválidos. Tente uma nova consulta.');
  return v as unknown as AnalysisResult;
}
