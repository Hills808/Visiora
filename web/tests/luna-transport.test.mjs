import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../server/provider.mjs';
import { GatewayError, Budget, failureCode } from '../server/budget.mjs';
import { LunaClient, AnalysisError } from '../dist/vision/luna-client.js';

const stamp = {
  requestId: 'transport-test',
  sessionGeneration: 1,
  frameId: 1,
  capturedAtMs: 1000,
  width: 2,
  height: 2,
  intent: 'describe',
  term: '',
};

test('CA-L2/L3: transport failure categories are safe, persist without response bodies and keep the full reservation', async () => {
  for (const [fetcher, status, code] of [
    [
      () => {
        throw new DOMException('PRIVATE TIMEOUT', 'TimeoutError');
      },
      504,
      'provider-timeout',
    ],
    [
      () => {
        throw new TypeError('PRIVATE NETWORK');
      },
      503,
      'provider-network',
    ],
    [
      () => Response.json({ error: { message: 'PRIVATE' } }, { status: 503 }),
      503,
      'provider-unavailable',
    ],
    [
      () => Response.json({ error: { message: 'PRIVATE' } }, { status: 429 }),
      429,
      'provider-limit',
    ],
    [() => Response.json({ error: { message: 'PRIVATE' } }, { status: 401 }), 401, 'provider-auth'],
    [() => new Response('PRIVATE', { status: 400 }), 422, 'provider-request'],
  ]) {
    const provider = createProvider({ provider: 'luna', apiKey: 'TEST-ONLY' }, fetcher);
    const budget = new Budget(':memory:', { daily: 2000000, total: 2000000 });
    try {
      budget.reserve(stamp.requestId);
      let failed;
      try {
        await provider(Buffer.from('PRIVATE IMAGE'), stamp);
      } catch (error) {
        failed = error;
      }
      assert.ok(failed instanceof GatewayError);
      assert.equal(failed.status, status);
      assert.equal(failureCode(failed), code);
      budget.uncertain(stamp.requestId, failureCode(failed));
      const row = budget.db.prepare('SELECT code FROM request_failures').get();
      assert.equal(row.code, code);
      assert.equal(budget.db.prepare('SELECT charge FROM requests').get().charge, 300000);
      assert.doesNotMatch(JSON.stringify(row), /PRIVATE|TEST-ONLY/);
    } finally {
      budget.close();
    }
  }
  assert.equal(failureCode(new GatewayError(503, 'PRIVATE MESSAGE')), 'internal');
});

test('CA-L3/D4: client permits bounded recovery only for known temporary failures; cancel rejects late responses', async () => {
  const original = globalThis.fetch;
  const client = new LunaClient(),
    status = { ready: true, provider: 'fake', csrfToken: 'a'.repeat(64), message: '' };
  try {
    for (const [http, error, transient] of [
      [503, 'provider-network', true],
      [503, 'provider-unavailable', true],
      [504, 'provider-timeout', true],
      [503, 'not-configured', false],
      [503, 'model-audit', false],
      [503, 'pricing', false],
      [429, 'budget', false],
      [401, 'provider-auth', false],
      [502, 'model-unconfirmed', false],
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return Response.json({ error }, { status: http });
      };
      await assert.rejects(
        client.analyze(new Blob(['test']), stamp, status, true),
        (value) => value instanceof AnalysisError && value.transient === transient,
      );
      assert.equal(calls, 1); // Client never retries on its own.
    }
    globalThis.fetch = async () => {
      throw new TypeError('PRIVATE NETWORK');
    };
    await assert.rejects(
      client.analyze(new Blob(['test']), stamp, status, true),
      (value) => value.code === 'client-network' && value.transient,
    );
    let finish;
    globalThis.fetch = () => new Promise((resolve) => (finish = resolve));
    const pending = client.analyze(new Blob(['test']), stamp, status, true);
    client.cancel();
    finish(Response.json({ error: 'provider-unavailable' }, { status: 503 }));
    assert.equal(await pending, null);
    assert.equal(client.busy, false);
  } finally {
    globalThis.fetch = original;
  }
});
