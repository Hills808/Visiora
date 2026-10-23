import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeDetections, verifiedPeople } from '../dist/vision/person-consensus.js';
import {
  classifyConsensus,
  packPlacesRgb,
  parsePlacesLabels,
  sceneFamily,
} from '../dist/vision/scene-consensus.js';
import { decodeYolox, packBgr } from '../dist/vision/yolox.js';
import { CONFIG } from '../dist/config.js';
const detection = (cls, score = 0.8, box = [0.1, 0.1, 0.3, 0.5]) => ({
  cls,
  score,
  box,
  bearing: 0,
});

test('one detector cannot verify a person, even with duplicate boxes', () => {
  assert.equal(
    verifiedPeople({ nano: [detection('person'), detection('person', 0.9)], tiny: [], s: [] })
      .length,
    0,
  );
  assert.equal(
    verifiedPeople({
      nano: [detection('person')],
      tiny: [detection('person', 0.9, [0.7, 0.1, 0.9, 0.5])],
      s: [],
    }).length,
    0,
  );
});
test('two detectors may recover a person Nano missed; other objects retain Nano evidence', () => {
  const chair = detection('chair'),
    bed = detection('bed', 0.7);
  const result = composeDetections({
    nano: [chair, bed],
    tiny: [detection('person', 0.9), detection('chair', 0.99)],
    s: [detection('person', 0.8)],
  });
  assert.deepEqual(
    result.map((d) => d.cls),
    ['person', 'chair', 'bed'],
  );
  assert.equal(result[1], chair);
  assert.equal(result[2], bed);
  assert.ok(Math.abs(result[0].score - 0.85) < 1e-9);
});
test('complete-link clusters do not merge a chain of incompatible person boxes', () => {
  const result = verifiedPeople({
    nano: [detection('person', 0.9, [0, 0, 1, 1])],
    tiny: [detection('person', 0.8, [0.3, 0, 1.3, 1])],
    s: [detection('person', 0.7, [0.6, 0, 1.6, 1])],
  });
  assert.equal(result.length, 1);
  assert.ok(Math.abs(result[0].score - 0.85) < 1e-9); // Third box overlaps the second, but not the first sufficiently.
  assert.ok(Math.abs(result[0].box[0] - 0.15) < 1e-9);
});
test('global cap is applied after verification, with all mapped Nano objects available', () => {
  const persons = Array.from({ length: 31 }, (_, i) =>
    detection('person', 0.95, [i / 40, 0, (i + 0.5) / 40, 0.1]),
  );
  const result = composeDetections({
    nano: [...persons, detection('chair', 0.6)],
    tiny: persons,
    s: [],
  });
  assert.equal(result.length, 30);
  assert.ok(result.every((d) => d.cls === 'person'));
});
test('product person composition reproduces the 30 frozen independent confirmation outputs', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('fixtures/person-consensus.json', import.meta.url)),
  );
  assert.equal(fixture.rows.length, 30);
  for (const row of fixture.rows) {
    const actual = composeDetections(row.heads);
    assert.equal(actual.length, row.expected.length, `image ${row.id}`);
    actual.forEach((item, index) => {
      const expected = row.expected[index];
      assert.equal(item.cls, expected.cls);
      assert.ok(Math.abs(item.score - expected.score) < 1e-9);
      item.box.forEach((coordinate, i) => assert.ok(Math.abs(coordinate - expected.box[i]) < 1e-9));
    });
  }
});
test('S decoder uses its own 640px grid and raw BGR input contract', () => {
  const size = CONFIG.vision.verificationSize,
    area = size ** 2;
  assert.equal(packBgr(new Uint8ClampedArray(area * 4), size).length, area * 3);
  const rows = CONFIG.vision.strides.reduce((sum, stride) => sum + (size / stride) ** 2, 0);
  const raw = new Float32Array(rows * CONFIG.vision.fields),
    offset = (rows - 1) * CONFIG.vision.fields;
  raw[offset] = 0;
  raw[offset + 1] = 0;
  raw[offset + 2] = 0;
  raw[offset + 3] = 0;
  raw[offset + 4] = 1;
  raw[offset + 5] = 0.9;
  assert.equal(
    decodeYolox(raw, { width: size, height: size, ratio: 1 }, size, Infinity)[0].cls,
    'person',
  );
});

const labels = Array.from({ length: 365 }, (_, i) => 'unknown_' + i);
labels[0] = 'dorm_room';
labels[1] = 'bedroom';
labels[2] = 'office';
const logits = (pairs) => {
  const values = new Float32Array(365).fill(-20);
  for (const [i, v] of pairs) values[i] = v;
  return values;
};
const embedding = (pairs) => ({
  dimensions: 1,
  candidates: pairs.map(([id, value, reject = false]) => ({
    id,
    label: id,
    reject,
    vector: [value],
  })),
});
test('two whole-image models can agree on a broad family, including Sig third place', () => {
  const result = classifyConsensus(
    new Float32Array([1]),
    embedding([
      ['game_room', 0.13],
      ['children_room', 0.126],
      ['bedroom', 0.124],
    ]),
    logits([
      [0, 3],
      [1, 2],
      [2, 0],
    ]),
    labels,
    17,
    2000,
  );
  assert.equal(result.category, 'bedroom');
  assert.equal(result.accepted, true);
  assert.equal(result.frameId, 17);
  assert.equal(result.capturedAtMs, 2000);
});
test('scene disagreement, weak support, reject winner and small family margin all abstain', () => {
  const feature = new Float32Array([1]);
  assert.equal(
    classifyConsensus(
      feature,
      embedding([
        ['office', 0.2],
        ['bedroom', 0.13],
      ]),
      logits([
        [0, 3],
        [2, 0],
      ]),
      labels,
      1,
      0,
    ).reason,
    'disagreement',
  );
  assert.equal(
    classifyConsensus(
      feature,
      embedding([
        ['bedroom', 0.119],
        ['office', 0.1],
      ]),
      logits([
        [0, 3],
        [2, 0],
      ]),
      labels,
      1,
      0,
    ).accepted,
    false,
  );
  assert.equal(
    classifyConsensus(
      feature,
      embedding([
        ['reject_dark', 0.14, true],
        ['bedroom', 0.13],
      ]),
      logits([
        [0, 3],
        [2, 0],
      ]),
      labels,
      1,
      0,
    ).reason,
    'unsupported',
  );
  assert.equal(
    classifyConsensus(
      feature,
      embedding([
        ['bedroom', 0.2],
        ['office', 0.1],
      ]),
      logits([
        [0, 3],
        [2, 2.9],
      ]),
      labels,
      1,
      0,
    ).reason,
    'ambiguous',
  );
  assert.throws(() =>
    classifyConsensus(
      feature,
      embedding([
        ['bedroom', 0.2],
        ['office', 0.1],
      ]),
      new Float32Array(365).fill(NaN),
      labels,
      1,
      0,
    ),
  );
});
test('Places catalog preserves exact index order and does not invent namespace equivalences', async () => {
  const actual = parsePlacesLabels(
    await readFile('public/models/places365/categories.txt', 'utf8'),
  );
  assert.equal(actual.length, 365);
  assert.equal(actual[0], 'airfield');
  assert.throws(() => parsePlacesLabels('/a/airfield 1'));
  assert.equal(sceneFamily('hotel_room'), 'bedroom');
  assert.notEqual(sceneFamily('computer_room'), sceneFamily('office'));
  assert.notEqual(sceneFamily('library/indoor'), sceneFamily('library'));
});
test('Places uses RGB ImageNet normalization on the same whole-frame pixels', () => {
  const area = CONFIG.classification.size ** 2,
    rgba = new Uint8ClampedArray(area * 4);
  rgba[0] = 255;
  rgba[1] = 128;
  rgba[2] = 0;
  const packed = packPlacesRgb(rgba);
  assert.ok(Math.abs(packed[0] - (1 - 0.485) / 0.229) < 1e-6);
  assert.ok(Math.abs(packed[area] - (128 / 255 - 0.456) / 0.224) < 1e-6);
  assert.ok(Math.abs(packed[area * 2] - (0 - 0.406) / 0.225) < 1e-6);
  assert.throws(() => packPlacesRgb(new Uint8ClampedArray(4)));
});
