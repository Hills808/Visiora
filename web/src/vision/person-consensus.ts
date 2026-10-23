import { CONFIG } from '../config.js';
import { bearingFromX } from '../brain/geometry.js';
import { iou, type BoxDetection } from './yolox.js';

export type DetectorHead = 'nano' | 'tiny' | 's';
export type HeadDetections = Record<DetectorHead, BoxDetection[]>;

function suppress(detections: BoxDetection[]): BoxDetection[] {
  const kept: BoxDetection[] = [];
  for (const candidate of [...detections].sort((a, b) => b.score - a.score)) {
    if (
      kept.some(
        (prior) => prior.cls === candidate.cls && iou(prior.box, candidate.box) > CONFIG.vision.nms,
      )
    )
      continue;
    kept.push(candidate);
    if (kept.length === CONFIG.vision.maxDetections) break;
  }
  return kept;
}

/** Complete-link agreement: one vote per model, every pair overlaps. No frame history or room rules. */
export function verifiedPeople(heads: HeadDetections): BoxDetection[] {
  const candidates = (['nano', 'tiny', 's'] as const).flatMap((head) =>
    heads[head]
      .filter((d) => d.cls === 'person' && d.score >= CONFIG.vision.minScore)
      .map((d, index) => ({ ...d, head, index })),
  );
  candidates.sort(
    (a, b) =>
      b.score - a.score || (a.head < b.head ? -1 : a.head > b.head ? 1 : 0) || a.index - b.index,
  );
  const assigned = new Set<number>();
  const results: BoxDetection[] = [];
  for (let seed = 0; seed < candidates.length; seed++) {
    if (assigned.has(seed)) continue;
    const members = [candidates[seed]],
      indices = [seed];
    const voted = new Set<DetectorHead>([candidates[seed].head]);
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      if (index === seed || assigned.has(index) || voted.has(candidate.head)) continue;
      if (
        members.every(
          (member) => iou(member.box, candidate.box) >= CONFIG.vision.personConsensus.minIou,
        )
      ) {
        members.push(candidate);
        indices.push(index);
        voted.add(candidate.head);
      }
    }
    if (voted.size < CONFIG.vision.personConsensus.minHeads) continue;
    indices.forEach((index) => assigned.add(index));
    const box = [0, 1, 2, 3].map(
      (coordinate) =>
        members.reduce((sum, member) => sum + member.box[coordinate], 0) / members.length,
    ) as BoxDetection['box'];
    results.push({
      cls: 'person',
      box,
      score: members.reduce((sum, member) => sum + member.score, 0) / members.length,
      bearing: bearingFromX((box[0] + box[2]) / 2),
    });
  }
  return suppress(results).filter((d) => d.score >= CONFIG.world.minScore);
}

export function composeDetections(heads: HeadDetections): BoxDetection[] {
  return suppress([
    ...heads.nano.filter((d) => d.cls !== 'person' && d.score >= CONFIG.world.minScore),
    ...verifiedPeople(heads),
  ]);
}
