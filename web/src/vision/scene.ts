import { CONFIG } from '../config.js';
import type { SceneEvidence } from '../brain/types.js';

export interface SceneCandidate {
  id: string;
  label: string;
  reject: boolean;
  vector: number[];
}
export interface SceneEmbeddings {
  dimensions: number;
  candidates: SceneCandidate[];
}
export interface SceneAnalysis extends SceneEvidence {
  reason: 'accepted' | 'ambiguous' | 'weak' | 'unsupported' | 'poor-image' | 'disagreement';
  similarity: number;
  margin: number;
  top: { category: string; similarity: number }[];
  latencyMs: number;
}
export function packSceneRgb(rgba: Uint8ClampedArray): Float32Array {
  const area = CONFIG.classification.size ** 2;
  if (rgba.length !== area * 4) throw new Error('Imagem de ambiente com tamanho inválido.');
  const data = new Float32Array(area * 3);
  for (let i = 0; i < area; i++)
    for (let channel = 0; channel < 3; channel++)
      data[channel * area + i] = rgba[i * 4 + channel] / 127.5 - 1;
  return data;
}
export function hasVisualInformation(rgba: Uint8ClampedArray): boolean {
  let total = 0,
    squared = 0;
  const count = rgba.length / 4;
  if (!count) return false;
  for (let i = 0; i < rgba.length; i += 4) {
    const value = (rgba[i] + rgba[i + 1] + rgba[i + 2]) / (3 * 255);
    total += value;
    squared += value * value;
  }
  return (
    Math.max(0, squared / count - (total / count) ** 2) >= CONFIG.classification.minImageVariance
  );
}
export function rankScenes(feature: Float32Array, embeddings: SceneEmbeddings) {
  if (feature.length !== embeddings.dimensions || !feature.every(Number.isFinite))
    throw new Error('Saída inválida do modelo de ambientes.');
  const norm = Math.hypot(...feature);
  if (!Number.isFinite(norm) || norm === 0 || embeddings.candidates.length < 2)
    throw new Error('Modelo de ambientes sem evidência utilizável.');
  return embeddings.candidates
    .map((candidate) => {
      if (candidate.vector.length !== feature.length || !candidate.vector.every(Number.isFinite))
        throw new Error('Descrições de ambientes incompatíveis com o modelo.');
      let dot = 0;
      for (let i = 0; i < feature.length; i++) dot += (feature[i] * candidate.vector[i]) / norm;
      return { candidate, similarity: dot };
    })
    .sort((a, b) => b.similarity - a.similarity);
}
export function classifyScene(
  feature: Float32Array,
  embeddings: SceneEmbeddings,
  frameId: number,
  capturedAtMs: number,
): SceneAnalysis {
  const ranked = rankScenes(feature, embeddings);
  const first = ranked[0],
    margin = first.similarity - ranked[1].similarity;
  const reason = first.candidate.reject
    ? 'unsupported'
    : first.similarity < CONFIG.classification.minSimilarity
      ? 'weak'
      : margin < CONFIG.classification.minMargin
        ? 'ambiguous'
        : 'accepted';
  return {
    frameId,
    capturedAtMs,
    source: 'image-model',
    accepted: reason === 'accepted',
    category: reason === 'accepted' ? first.candidate.id : null,
    reason,
    similarity: first.similarity,
    margin,
    top: ranked
      .slice(0, 3)
      .map((item) => ({ category: item.candidate.id, similarity: item.similarity })),
    latencyMs: 0,
  };
}
