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
    typeof v.intent === 'string' &&
    ['describe', 'where', 'ahead', 'find'].includes(v.intent) &&
    typeof v.term === 'string' &&
    (v.term === '' || plainLabel(v.term))
  );
}

export const EVIDENCE_ISSUES = [
  'structure',
  'limitations-format',
  'observation-format',
  'enum-type',
  'label-format',
  'id-format',
  'duplicate-id',
  'box-format',
  'box-empty',
  'box-bounds',
  'scene-format',
  'scene-support-empty',
  'scene-support-reference',
  'relation-format',
  'relation-reference',
  'relation-self',
] as const;
export type EvidenceIssue = (typeof EVIDENCE_ISSUES)[number];

/** Closed diagnostic vocabulary only: never return generated labels, IDs, paths or values. */
export function evidenceIssue(v: unknown): EvidenceIssue | null {
  if (
    !record(v) ||
    !keys(v, ['scene', 'observations', 'relations', 'limitations']) ||
    !Array.isArray(v.observations) ||
    v.observations.length > 12 ||
    !Array.isArray(v.relations) ||
    v.relations.length > 12 ||
    !Array.isArray(v.limitations) ||
    v.limitations.length > 6
  )
    return 'structure';
  if (!v.limitations.every((x) => plainLabel(x, 160))) return 'limitations-format';
  const ids = new Set<string>();
  for (const item of v.observations) {
    if (
      !record(item) ||
      !keys(item, ['id', 'kind', 'label', 'article', 'uncertain', 'box']) ||
      typeof item.uncertain !== 'boolean'
    )
      return 'observation-format';
    if (
      typeof item.kind !== 'string' ||
      !['person', 'object', 'text'].includes(item.kind) ||
      typeof item.article !== 'string' ||
      !['um', 'uma'].includes(item.article)
    )
      return 'enum-type';
    if (!plainLabel(item.label)) return 'label-format';
    if (typeof item.id !== 'string' || !/^[a-z0-9-]{1,24}$/.test(item.id)) return 'id-format';
    if (ids.has(item.id)) return 'duplicate-id';
    ids.add(item.id);
    if (item.box !== null) {
      const box = item.box;
      if (
        !record(box) ||
        !keys(box, ['x', 'y', 'width', 'height']) ||
        ![box.x, box.y, box.width, box.height].every(finite)
      )
        return 'box-format';
      if (Number(box.width) <= 0 || Number(box.height) <= 0) return 'box-empty';
      if (
        ![box.x, box.y, box.width, box.height].every((n) => Number(n) >= 0 && Number(n) <= 1) ||
        Number(box.x) + Number(box.width) > 1.000001 ||
        Number(box.y) + Number(box.height) > 1.000001
      )
        return 'box-bounds';
    }
  }
  if (v.scene !== null) {
    if (
      !record(v.scene) ||
      !keys(v.scene, ['label', 'support']) ||
      !plainLabel(v.scene.label) ||
      !Array.isArray(v.scene.support) ||
      v.scene.support.length > 12
    )
      return 'scene-format';
    if (!v.scene.support.length) return 'scene-support-empty';
    if (!v.scene.support.every((id) => typeof id === 'string' && ids.has(id)))
      return 'scene-support-reference';
  }
  for (const relation of v.relations) {
    if (
      !record(relation) ||
      !keys(relation, ['subject', 'object', 'description']) ||
      !plainLabel(relation.description, 100)
    )
      return 'relation-format';
    if (
      typeof relation.subject !== 'string' ||
      typeof relation.object !== 'string' ||
      !ids.has(relation.subject) ||
      !ids.has(relation.object)
    )
      return 'relation-reference';
    if (relation.subject === relation.object) return 'relation-self';
  }
  return null;
}
export function validEvidence(v: unknown): v is VisualEvidence {
  return evidenceIssue(v) === null;
}

/** Only representation changes: no clipping, dropping observations or guessing references. */
export function prepareEvidence(
  value: unknown,
):
  | { ok: true; evidence: VisualEvidence; adjustments: string[] }
  | { ok: false; reason: EvidenceIssue } {
  const candidate: unknown = structuredClone(value);
  const adjustments = new Set<string>();
  const words = (input: unknown, auxiliary = false): unknown => {
    if (typeof input !== 'string') return input;
    let text = input.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (text !== input) adjustments.add('unicode-space');
    if (auxiliary) {
      const nominal = text.endsWith('.') && !text.endsWith('..') ? text.slice(0, -1).trim() : text;
      if (nominal !== text) adjustments.add('auxiliary-punctuation');
      text = nominal;
    }
    return text;
  };
  if (record(candidate)) {
    if (record(candidate.scene)) candidate.scene.label = words(candidate.scene.label);
    if (Array.isArray(candidate.limitations))
      candidate.limitations = candidate.limitations.map((v) => words(v, true));
    if (Array.isArray(candidate.relations))
      for (const relation of candidate.relations)
        if (record(relation)) relation.description = words(relation.description, true);
    if (Array.isArray(candidate.observations)) {
      for (const item of candidate.observations)
        if (record(item) && (item.kind === 'person' || item.kind === 'object'))
          item.label = words(item.label);
      const rows = candidate.observations;
      const ids = rows.map((item) => (record(item) ? item.id : undefined));
      if (
        ids.every(
          (id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(id),
        ) &&
        new Set(ids).size === ids.length &&
        ids.some((id) => !/^[a-z0-9-]{1,24}$/.test(id))
      ) {
        const originals = new Set(ids);
        // A dangling original reference must never accidentally match a generated canonical ID.
        if (
          record(candidate.scene) &&
          Array.isArray(candidate.scene.support) &&
          !candidate.scene.support.every((id) => typeof id === 'string' && originals.has(id))
        )
          return { ok: false, reason: 'scene-support-reference' };
        if (
          Array.isArray(candidate.relations) &&
          candidate.relations.some(
            (relation) =>
              record(relation) &&
              (typeof relation.subject !== 'string' ||
                !originals.has(relation.subject) ||
                typeof relation.object !== 'string' ||
                !originals.has(relation.object)),
          )
        )
          return { ok: false, reason: 'relation-reference' };
        const remap = new Map(ids.map((id, index) => [id, `o${index + 1}`]));
        const mapped = (id: unknown): unknown =>
          typeof id === 'string' ? (remap.get(id) ?? id) : id;
        for (const item of rows) if (record(item)) item.id = mapped(item.id);
        if (record(candidate.scene) && Array.isArray(candidate.scene.support))
          candidate.scene.support = candidate.scene.support.map(mapped);
        if (Array.isArray(candidate.relations))
          for (const relation of candidate.relations)
            if (record(relation)) {
              relation.subject = mapped(relation.subject);
              relation.object = mapped(relation.object);
            }
        adjustments.add('identifiers');
      }
    }
  }
  const reason = evidenceIssue(candidate);
  return reason === null
    ? { ok: true, evidence: candidate as VisualEvidence, adjustments: [...adjustments] }
    : { ok: false, reason };
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
