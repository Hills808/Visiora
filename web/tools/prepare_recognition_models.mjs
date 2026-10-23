/** Repackage already obtained, hash-pinned research weights. No downloads, quantization or training. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const chunkBytes = 20_000_000; // Below the Sites per-file limit; reconstruction preserves original bytes.
const specs = [
  {
    id: 'yolox-tiny',
    file: 'artifacts/detector-upgrade/yolox_tiny.onnx',
    bytes: 20219662,
    sha256: '427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7',
    license: 'Apache-2.0',
    source:
      'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx',
    input: [1, 3, 416, 416],
  },
  {
    id: 'yolox-s',
    file: 'artifacts/detector-upgrade/yolox_s.onnx',
    bytes: 35858002,
    sha256: 'c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063',
    license: 'Apache-2.0',
    source: 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx',
    input: [1, 3, 640, 640],
  },
  {
    id: 'places365',
    file: 'artifacts/scene/places365.onnx',
    bytes: 45445545,
    sha256: '843436fd7a9c9af62382d1924948761cb0e03637f679710062e9a84f3d77a06e',
    license: 'CC BY, version unspecified by authors; code MIT',
    source: 'http://places2.csail.mit.edu/models_places365/resnet18_places365.pth.tar',
    input: [1, 3, 224, 224],
  },
];
for (const spec of specs) {
  const data = await readFile(spec.file);
  if (data.length !== spec.bytes || digest(data) !== spec.sha256)
    throw new Error('Unexpected model: ' + spec.id);
  const dir = 'public/models/' + spec.id;
  await mkdir(dir, { recursive: true });
  const chunks = [];
  for (let offset = 0; offset < data.length; offset += chunkBytes) {
    const bytes = data.subarray(offset, offset + chunkBytes);
    const name = `part-${chunks.length + 1}.bin`;
    await writeFile(dir + '/' + name, bytes);
    chunks.push({ path: name, bytes: bytes.length, sha256: digest(bytes) });
  }
  const { file, ...manifest } = spec;
  if (spec.id === 'places365') {
    const labels = await readFile('artifacts/scene/categories_places365.txt');
    const labelsHash = digest(labels);
    if (labelsHash !== '2affba635eb657e7ca95f4e6cc69bd9fac29ef4c32aeb83cafdfcd06ec6a1ea6')
      throw new Error('Unexpected Places labels');
    await writeFile(dir + '/categories.txt', labels);
    manifest.labels_sha256 = labelsHash;
    manifest.conversion = {
      format: 'ONNX F32 opset17, local export',
      checkpoint_sha256: '2f4759217d470da2b803f8f66cd4488a066406b555a5fb95ee9a4663f9f05588',
      preprocessing: 'whole RGB frame resized224, ImageNet normalization; no center crop',
    };
  } else manifest.release = '0.1.1rc0';
  await writeFile(dir + '/manifest.json', JSON.stringify({ ...manifest, chunks }, null, 2) + '\n');
  console.log(
    JSON.stringify({ id: spec.id, bytes: data.length, sha256: spec.sha256, parts: chunks.length }),
  );
}
