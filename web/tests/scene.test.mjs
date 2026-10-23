import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyScene, packSceneRgb, hasVisualInformation } from '../dist/vision/scene.js';
import { downloadModel, sha256 } from '../dist/vision/model-assets.js';
import { CONFIG } from '../dist/config.js';
const embeddings = {
  dimensions: 2,
  candidates: [
    { id: 'bedroom', label: 'um quarto', reject: false, vector: [1, 0] },
    { id: 'office', label: 'um escritório', reject: false, vector: [0, 1] },
    { id: 'reject_dark', label: '', reject: true, vector: [-1, 0] },
  ],
};
test('whole-image RGB preprocessing has exact channel order, range and size', () => {
  const area = CONFIG.classification.size ** 2;
  const pixels = new Uint8ClampedArray(area * 4);
  pixels[0] = 255;
  pixels[1] = 128;
  pixels[2] = 0;
  const result = packSceneRgb(pixels);
  assert.equal(result[0], 1);
  assert.ok(Math.abs(result[area] - (128 / 127.5 - 1)) < 1e-7);
  assert.equal(result[area * 2], -1);
  assert.throws(() => packSceneRgb(new Uint8ClampedArray(4)));
});
test('uniform obscured frames are rejected without inventing a place', () => {
  const pixels = new Uint8ClampedArray(CONFIG.classification.size ** 2 * 4);
  assert.equal(hasVisualInformation(pixels), false);
  pixels.fill(255);
  assert.equal(hasVisualInformation(pixels), false);
  for (let i = 0; i < pixels.length / 2; i++) pixels[i] = 0;
  assert.equal(hasVisualInformation(pixels), true);
});
test('whole-image classifier accepts a supported embedding and preserves frame provenance', () => {
  const result = classifyScene(new Float32Array([4, 0]), embeddings, 9, 1000);
  assert.equal(result.category, 'bedroom');
  assert.equal(result.accepted, true);
  assert.equal(result.frameId, 9);
  assert.equal(result.capturedAtMs, 1000);
});
test('ambiguous image embeddings and explicit reject candidates abstain', () => {
  const tied = classifyScene(new Float32Array([1, 1]), embeddings, 1, 0);
  assert.equal(tied.category, null);
  assert.equal(tied.reason, 'ambiguous');
  assert.equal(classifyScene(new Float32Array([-1, 0]), embeddings, 2, 0).reason, 'unsupported');
});
test('invalid model output cannot become a spoken place', () => {
  assert.throws(() => classifyScene(new Float32Array([0, 0]), embeddings, 1, 0));
  assert.throws(() => classifyScene(new Float32Array([NaN, 1]), embeddings, 1, 0));
  assert.throws(() => classifyScene(new Float32Array([1]), embeddings, 1, 0));
});
test('model parts reconstruct exact bytes, with checksums and progress', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const a = new Uint8Array([1, 2]),
    b = new Uint8Array([3, 4]);
  const all = new Uint8Array([1, 2, 3, 4]);
  const manifest = {
    bytes: 4,
    sha256: await sha256(all),
    embeddings_sha256: '',
    chunks: [
      { path: 'a.bin', bytes: 2, sha256: await sha256(a) },
      { path: 'b.bin', bytes: 2, sha256: await sha256(b) },
    ],
  };
  globalThis.fetch = async (url) => new Response(String(url).endsWith('a.bin') ? a : b);
  const progress = [];
  assert.deepEqual(
    await downloadModel(
      new URL('https://local.invalid/models/'),
      manifest,
      new AbortController().signal,
      (n, total) => progress.push([n, total]),
    ),
    all,
  );
  assert.deepEqual(progress, [
    [2, 4],
    [4, 4],
  ]);
});
test('tampered parts, unsafe paths, failed requests and invalid sizes fail explicitly', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const data = new Uint8Array([1]);
  const expected = await sha256(data);
  const manifest = {
    bytes: 1,
    sha256: expected,
    embeddings_sha256: '',
    chunks: [{ path: 'one.bin', bytes: 1, sha256: expected }],
  };
  const run = (m) =>
    downloadModel(
      new URL('https://local.invalid/models/'),
      m,
      new AbortController().signal,
      () => {},
    );
  globalThis.fetch = async () => new Response(new Uint8Array([2]));
  await assert.rejects(run(manifest), /incompleto|alterado/);
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(run(manifest), /baixar/);
  await assert.rejects(
    run({ ...manifest, chunks: [{ ...manifest.chunks[0], path: '../one.bin' }] }),
    /inválida/,
  );
  await assert.rejects(
    run({ ...manifest, bytes: CONFIG.classification.maxModelBytes + 1 }),
    /inválido/,
  );
});
