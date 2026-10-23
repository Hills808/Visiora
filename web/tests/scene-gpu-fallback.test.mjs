import test from 'node:test';
import assert from 'node:assert/strict';
import { ScenePerception } from '../dist/vision/scene-model.js';
import { CONFIG } from '../dist/config.js';

test('CA-H7: a failed GPU scene inference is discarded before reloading both models on CPU', async () => {
  const statuses = [];
  const perception = new ScenePerception((status) => statuses.push(status));
  const released = [];
  const failure = new Error('GPU device lost');
  perception.session = {
    run: async () => {
      throw failure;
    },
    release: async () => released.push('siglip'),
  };
  perception.places = { release: async () => released.push('places') };
  perception.embeddings = { dimensions: CONFIG.classification.dimensions, candidates: [] };
  perception.provider = 'webgpu';
  let reloadForceCpu = null;
  perception.load = async (forceCpu) => {
    reloadForceCpu = forceCpu;
  };
  const rgba = new Uint8ClampedArray(CONFIG.classification.size ** 2 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (i / 4) % 256;
    rgba[i + 1] = 255 - rgba[i];
    rgba[i + 2] = i % 127;
    rgba[i + 3] = 255;
  }
  const result = await perception.analyze(rgba, 1, performance.now());
  assert.equal(result, undefined);
  assert.deepEqual(released.sort(), ['places', 'siglip']);
  assert.equal(reloadForceCpu, true);
  assert.equal(perception.session, null);
  assert.equal(perception.places, null);
  assert.equal(statuses.at(-1).state, 'loading');
  assert.match(statuses.at(-1).message, /CPU/);
});
