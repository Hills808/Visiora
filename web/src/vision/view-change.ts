import { CONFIG } from '../config.js';

/** Pixel evidence only; never infer a person, place, camera pose or distance from it. */
export function compareViews(
  before: readonly number[],
  after: readonly number[],
): {
  changed: boolean;
  broad: boolean;
  mean: number;
  fraction: number;
  tiles: number;
} {
  if (!before.length || before.length !== after.length)
    return { changed: false, broad: false, mean: 0, fraction: 0, tiles: 0 };
  const differences = after.map((n, i) => Math.abs(n - before[i]));
  const mean = differences.reduce((sum, n) => sum + n, 0) / differences.length;
  const fraction =
    differences.filter((n) => n >= CONFIG.online.autoPixelDelta).length / differences.length;
  const offset = [0, 0, 0],
    samples = [0, 0, 0];
  after.forEach((value, i) => {
    offset[i % 3] += value - before[i];
    samples[i % 3]++;
  });
  const structure =
    after.reduce(
      (sum, value, i) => sum + Math.abs(value - before[i] - offset[i % 3] / samples[i % 3]),
      0,
    ) / after.length;
  let tiles = 0;
  const { motionWidth: width, motionHeight: height, autoTileSide: side } = CONFIG.online;
  if (differences.length === width * height * 3) {
    for (let y = 0; y < height; y += side)
      for (let x = 0; x < width; x += side) {
        let sum = 0,
          count = 0;
        for (let dy = 0; dy < side && y + dy < height; dy++)
          for (let dx = 0; dx < side && x + dx < width; dx++)
            for (let c = 0; c < 3; c++) {
              sum += differences[((y + dy) * width + x + dx) * 3 + c];
              count++;
            }
        if (sum / count >= CONFIG.online.autoTileDelta) tiles++;
      }
  }
  return {
    mean,
    fraction,
    tiles,
    broad:
      fraction >= CONFIG.online.autoBroadFraction && structure >= CONFIG.online.autoStructureDelta,
    changed:
      mean >= CONFIG.online.autoChangeDelta ||
      fraction >= CONFIG.online.autoChangedFraction ||
      tiles >= CONFIG.online.autoChangedTiles,
  };
}
