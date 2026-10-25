import test from 'node:test';
import assert from 'node:assert/strict';
import { retainAnalysis } from '../lib/luna-lifecycle.ts';

test('a disconnect retains the same analysis task until settlement, without dispatching another call', async () => {
  const tasks = [];
  let settle;
  const result = new Promise(resolve => { settle = resolve; });
  const abort = new AbortController();
  const request = new Request('https://example.test/api/vision/analyze', { method: 'POST', signal: abort.signal });
  assert.equal(retainAnalysis(request, result, { waitUntil: task => tasks.push(task) }), result);
  assert.equal(tasks.length, 1);
  abort.abort();
  const response = new Response('settled');
  settle(response);
  await tasks[0];
  assert.equal(await result, response);
  assert.equal(tasks.length, 1);
});

test('ordinary requests do not extend background work', async () => {
  const result = Promise.resolve(new Response('ok'));
  for (const request of [new Request('https://example.test/api/vision/status'),
    new Request('https://example.test/other', { method: 'POST' })]) {
    assert.equal(retainAnalysis(request, result, { waitUntil() { assert.fail('unexpected task'); } }), result);
  }
});
