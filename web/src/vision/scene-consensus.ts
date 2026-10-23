import { CONFIG } from '../config.js';
import { rankScenes, type SceneAnalysis, type SceneEmbeddings } from './scene.js';

// Names for the same broad scene type across two learned catalogs. These never inspect object detections.
const FAMILIES: Record<string, string[]> = {
  bedroom: ['bedroom', 'bedchamber', 'childs_room', 'dorm_room', 'hotel_room', 'nursery'],
  classroom: ['classroom', 'kindergarden_classroom', 'lecture_room'],
  office: ['office', 'home_office', 'office_cubicles'],
  kitchen: ['kitchen', 'restaurant_kitchen', 'galley'],
  restaurant: ['restaurant', 'restaurant_patio', 'fastfood_restaurant'],
};
export function sceneFamily(raw: string): string {
  const normalized =
    (
      { children_room: 'childs_room', kindergarten: 'kindergarden_classroom' } as Record<
        string,
        string
      >
    )[raw] ?? raw.replaceAll('/', '_').replaceAll('-', '_');
  return (
    Object.entries(FAMILIES).find(([, members]) => members.includes(normalized))?.[0] ?? normalized
  );
}
export function parsePlacesLabels(text: string): string[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length !== CONFIG.classification.consensus.placesClasses)
    throw new Error('Catálogo Places incompatível.');
  return lines.map((line, index) => {
    const [name, ordinal] = line.trim().split(/\s+/);
    if (!/^\/[a-z]\//.test(name) || Number(ordinal) !== index)
      throw new Error('Ordem do catálogo Places inválida.');
    return name.slice(3);
  });
}
export function packPlacesRgb(rgba: Uint8ClampedArray): Float32Array {
  const area = CONFIG.classification.size ** 2;
  if (rgba.length !== area * 4) throw new Error('Imagem Places com tamanho inválido.');
  const { mean, std } = CONFIG.classification.consensus;
  const data = new Float32Array(area * 3);
  for (let i = 0; i < area; i++)
    for (let c = 0; c < 3; c++) data[c * area + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c];
  return data;
}
/** Frozen decision policy measured in scene-consensus/confirmation.json. No fallback to Sig alone. */
export function classifyConsensus(
  feature: Float32Array,
  embeddings: SceneEmbeddings,
  logits: Float32Array,
  labels: string[],
  frameId: number,
  capturedAtMs: number,
): SceneAnalysis {
  if (
    logits.length !== CONFIG.classification.consensus.placesClasses ||
    labels.length !== logits.length ||
    !logits.every(Number.isFinite)
  )
    throw new Error('Saída Places incompatível.');
  const ranked = rankScenes(feature, embeddings);
  const max = Math.max(...logits);
  const exp = Array.from(logits, (value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  const places = exp
    .map((value, index) => ({ family: sceneFamily(labels[index]), probability: value / total }))
    .sort((a, b) => b.probability - a.probability);
  const proposal = places[0];
  const margin =
    proposal.probability - (places.find((p) => p.family !== proposal.family)?.probability ?? 0);
  const support = ranked
    .slice(0, CONFIG.classification.consensus.topCandidates)
    .find(
      (p) =>
        !p.candidate.reject &&
        sceneFamily(p.candidate.id) === proposal.family &&
        p.similarity >= CONFIG.classification.minSimilarity &&
        ranked[0].similarity - p.similarity <= CONFIG.classification.consensus.maxSimilarityGap,
    );
  const reason = ranked[0].candidate.reject
    ? 'unsupported'
    : proposal.probability < CONFIG.classification.consensus.minProbability
      ? 'weak'
      : margin < CONFIG.classification.consensus.minFamilyMargin
        ? 'ambiguous'
        : !support
          ? 'disagreement'
          : 'accepted';
  return {
    frameId,
    capturedAtMs,
    source: 'image-model',
    accepted: reason === 'accepted',
    category: reason === 'accepted' ? proposal.family : null,
    reason,
    similarity: support?.similarity ?? ranked[0].similarity,
    margin,
    top: ranked.slice(0, 3).map((p) => ({ category: p.candidate.id, similarity: p.similarity })),
    latencyMs: 0,
  };
}
