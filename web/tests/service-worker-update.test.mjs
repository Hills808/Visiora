import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('CA-E1: a rebuilt service worker takes control and removes the stale application cache', async () => {
  const source = await readFile('dist/sw.js', 'utf8');
  const current = source.match(/const CACHE = '(visiora-v0\.3\.0-[a-f0-9]{12})';/)?.[1];
  assert.ok(current);
  const listeners = new Map();
  const removed = [];
  let claimed = false;
  runInNewContext(source, {
    self: {
      addEventListener: (name, listener) => listeners.set(name, listener),
      clients: { claim: async () => (claimed = true) },
    },
    caches: {
      keys: async () => ['visiora-v0.3.0', current, 'another-application'],
      delete: async (key) => {
        removed.push(key);
        return true;
      },
    },
  });
  let activation;
  listeners.get('activate')({ waitUntil: (promise) => (activation = promise) });
  await activation;
  assert.deepEqual(removed, ['visiora-v0.3.0']);
  assert.equal(claimed, true);
});
