import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { decodeYolox } from '../dist/vision/yolox.js';
const meta = JSON.parse(await readFile('artifacts/vision/smoke.json', 'utf8'));
const bytes = await readFile('artifacts/vision/output.bin');
const raw = new Float32Array(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const detections = decodeYolox(raw, {
  width: meta.image_size[0],
  height: meta.image_size[1],
  ratio: meta.ratio,
});
assert.ok(
  detections.some((d) => d.cls === 'dog'),
  'Public reference dog is detected',
);
assert.ok(
  detections.some((d) => d.cls === 'bicycle'),
  'Public reference bicycle is detected',
);
assert.ok(
  detections.every((d) => d.depth === undefined),
  'Monocular detector must not fabricate metric depth',
);
await writeFile(
  'artifacts/vision/decoded.json',
  JSON.stringify({ input: 'official YOLOX public demo image', detections }, null, 2),
);
console.log(
  JSON.stringify({
    realModelDecoded: true,
    classes: detections.map((d) => d.cls),
    count: detections.length,
  }),
);
