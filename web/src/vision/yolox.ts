import { CONFIG } from '../config.js';
import { bearingFromX } from '../brain/geometry.js';
import type { Detection } from '../brain/types.js';
// Official COCO class order of the versioned YOLOX export. Unmapped classes are omitted, never renamed as doors/hazards.
export const COCO_KEYS: (string | null)[] = [
  'person',
  'bicycle',
  'car',
  'motorcycle',
  null,
  'bus',
  'train',
  'truck',
  null,
  null,
  null,
  null,
  null,
  'bench',
  'bird',
  'cat',
  'dog',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  'backpack',
  'umbrella',
  'handbag',
  null,
  'suitcase',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  'bottle',
  null,
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  null,
  'orange',
  null,
  null,
  'pizza',
  null,
  null,
  null,
  'chair',
  'couch',
  'pottedPlant',
  'bed',
  'table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'phone',
  'microwave',
  'oven',
  null,
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddyBear',
  'hairDryer',
  'toothbrush',
];
export interface BoxDetection extends Detection {
  box: [number, number, number, number];
}
export interface ImageBounds {
  width: number;
  height: number;
  ratio: number;
}
export function packBgr(rgba: Uint8ClampedArray, size: number = CONFIG.vision.size): Float32Array {
  const area = size ** 2;
  if (rgba.length !== area * 4) throw new Error('Dimensões de entrada incompatíveis com o modelo.');
  const output = new Float32Array(area * 3);
  // The released Nano checkpoint uses the updated YOLOX BGR [0,255] preprocessing, not old tag ImageNet normalization.
  for (let pixel = 0; pixel < area; pixel++)
    for (let channel = 0; channel < 3; channel++)
      output[channel * area + pixel] = rgba[pixel * 4 + (2 - channel)];
  return output;
}
export function iou(a: number[], b: number[]): number {
  const intersection =
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection;
  return union > 0 ? intersection / union : 0;
}
export function decodeYolox(
  data: Float32Array,
  bounds: ImageBounds,
  size: number = CONFIG.vision.size,
  limit: number = CONFIG.vision.maxDetections,
): BoxDetection[] {
  const anchors = CONFIG.vision.strides.reduce((sum, stride) => sum + (size / stride) ** 2, 0);
  if (
    data.length !== anchors * CONFIG.vision.fields ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.ratio <= 0
  )
    throw new Error('Saída de percepção incompatível.');
  const results: BoxDetection[] = [];
  let row = 0;
  for (const stride of CONFIG.vision.strides) {
    const grid = size / stride;
    for (let gy = 0; gy < grid; gy++)
      for (let gx = 0; gx < grid; gx++, row++) {
        const offset = row * CONFIG.vision.fields;
        const objectness = data[offset + 4];
        if (objectness < CONFIG.vision.minScore) continue;
        let cls = 0;
        let probability = 0;
        for (let candidate = 0; candidate < CONFIG.vision.classes; candidate++)
          if (data[offset + 5 + candidate] > probability) {
            cls = candidate;
            probability = data[offset + 5 + candidate];
          }
        const key = COCO_KEYS[cls];
        const score = objectness * probability;
        if (!key || score < CONFIG.vision.minScore || !Number.isFinite(score)) continue;
        const cx = (data[offset] + gx) * stride;
        const cy = (data[offset + 1] + gy) * stride;
        const width = Math.exp(data[offset + 2]) * stride;
        const height = Math.exp(data[offset + 3]) * stride;
        const clip = (n: number): number => Math.max(0, Math.min(1, n));
        const box: BoxDetection['box'] = [
          clip((cx - width / 2) / bounds.ratio / bounds.width),
          clip((cy - height / 2) / bounds.ratio / bounds.height),
          clip((cx + width / 2) / bounds.ratio / bounds.width),
          clip((cy + height / 2) / bounds.ratio / bounds.height),
        ];
        if (!box.every(Number.isFinite) || box[2] <= box[0] || box[3] <= box[1]) continue;
        results.push({ cls: key, score, box, bearing: bearingFromX((box[0] + box[2]) / 2) });
      }
  }
  results.sort((a, b) => b.score - a.score);
  const kept: BoxDetection[] = [];
  for (const candidate of results)
    if (
      !kept.some(
        (prior) => prior.cls === candidate.cls && iou(prior.box, candidate.box) > CONFIG.vision.nms,
      )
    )
      kept.push(candidate);
  return kept.slice(0, limit);
}
