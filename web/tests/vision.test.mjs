import test from 'node:test';
import assert from 'node:assert/strict';
import { COCO_KEYS, packBgr, decodeYolox, iou } from '../dist/vision/yolox.js';
import { CONFIG } from '../dist/config.js';
const size = CONFIG.vision.size;
const rows = CONFIG.vision.strides.reduce((sum, stride) => sum + (size / stride) ** 2, 0);
test('model contract: 80 COCO labels, unsupported door is never fabricated', () => {
  assert.equal(COCO_KEYS.length, 80);
  assert.equal(COCO_KEYS[56], 'chair');
  assert.equal(COCO_KEYS[60], 'table');
  assert.ok(!COCO_KEYS.includes('door'));
});
test('released checkpoint uses raw BGR, not obsolete ImageNet normalization', () => {
  const pixels = new Uint8ClampedArray(size * size * 4);
  pixels[0] = 10;
  pixels[1] = 20;
  pixels[2] = 30;
  pixels[3] = 255;
  const packed = packBgr(pixels);
  assert.equal(packed.length, size * size * 3);
  assert.equal(packed[0], 30);
  assert.equal(packed[size * size], 20);
  assert.equal(packed[size * size * 2], 10);
  assert.throws(() => packBgr(new Uint8ClampedArray(4)));
});
test('decode handles grid/stride, confidence, clipping and per-class suppression', () => {
  const raw = new Float32Array(rows * 85);
  function set(row, cls, score) {
    const o = row * 85;
    raw[o] = 10 - row;
    raw[o + 1] = 10;
    raw[o + 2] = Math.log(8);
    raw[o + 3] = Math.log(8);
    raw[o + 4] = 1;
    raw[o + 5 + cls] = score;
  }
  set(0, 56, 0.9);
  set(1, 56, 0.8);
  set(2, 0, 0.9);
  const results = decodeYolox(raw, { width: 416, height: 416, ratio: 1 });
  assert.equal(results.length, 2);
  assert.deepEqual(new Set(results.map((r) => r.cls)), new Set(['chair', 'person']));
  assert.ok(results.every((r) => r.depth === undefined));
  assert.equal(
    decodeYolox(new Float32Array(rows * 85), { width: 416, height: 416, ratio: 1 }).length,
    0,
  );
  assert.throws(() => decodeYolox(new Float32Array(10), { width: 1, height: 1, ratio: 1 }));
});
test('intersection-over-union is invariant for identical and disjoint boxes', () => {
  assert.equal(iou([0, 0, 1, 1], [0, 0, 1, 1]), 1);
  assert.equal(iou([0, 0, 1, 1], [2, 2, 3, 3]), 0);
  assert.equal(iou([0, 0, 0, 0], [0, 0, 0, 0]), 0);
});
