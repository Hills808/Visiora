import test from 'node:test';
import assert from 'node:assert/strict';
import { LunaClient, AnalysisError } from '../dist/vision/luna-client.js';
import { EVIDENCE_ISSUES } from '../dist/perception/evidence.js';

const stamp = {
  requestId: 'error-contract-test-0001',
  sessionGeneration: 1,
  frameId: 1,
  capturedAtMs: 100,
  width: 640,
  height: 480,
  intent: 'describe',
  term: '',
};
const status = { ready: true, provider: 'luna', csrfToken: 'a'.repeat(64), message: '' };
const image = () => new Blob(['synthetic test input'], { type: 'image/jpeg' });

test('CA-L4: known 422 contract errors retain distinct codes/messages with no retry or response text', async (t) => {
  const cases = [
    ['empty', /não enviou uma resposta/],
    ['too-large', /tamanho permitido/],
    ['incomplete', /análise incompleta/],
    ['refused', /recusou analisar/],
    ['invalid-json', /não pôde ser lida/],
    ['invalid-evidence', /formato de observações/],
    ['invalid-response', /resposta inválida/],
  ];
  const messages = new Set();
  for (const [code, explanation] of cases) {
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      requests++;
      assert.equal(options.headers['X-Visiora-Consent'], 'cloud-v3-continuity');
      assert.equal(options.headers['X-Visiora-CSRF'], status.csrfToken);
      return Response.json(
        { error: code, message: 'PRIVATE PROVIDER PROSE', reason: '<script>PRIVATE</script>' },
        { status: 422, headers: { 'X-Private': 'SECRET' } },
      );
    });
    const client = new LunaClient();
    await assert.rejects(client.analyze(image(), stamp, status, true), (error) => {
      assert.ok(error instanceof AnalysisError);
      assert.equal(error.code, code);
      assert.equal(error.transient, false);
      assert.match(error.message, explanation);
      assert.doesNotMatch(error.message, /PRIVATE|SECRET|script/);
      messages.add(error.message);
      return true;
    });
    assert.equal(requests, 1);
    assert.equal(client.busy, false);
    t.mock.restoreAll();
  }
  assert.equal(messages.size, cases.length);
});

test('CA-L4/S4: unknown 422/429 codes and arbitrary suffixes use status fallback without leaking body', async (t) => {
  for (const [http, body] of [
    [422, { error: 'PRIVATE RAW ERROR' }],
    [422, { error: 'invalid-evidence-private-label' }],
    [422, { error: 'invalid-evidence-box-bounds-private' }],
    [422, { error: 'invalid-evidence-' }],
    [422, { error: 'provider-arbitrary-private' }],
    [422, { error: { secret: 'PRIVATE' } }],
    [429, { error: 'PRIVATE RATE DETAIL' }],
    [422, null],
    [422, { error: 'toString' }],
  ]) {
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      requests++;
      return Response.json(body, { status: http });
    });
    const client = new LunaClient();
    await assert.rejects(client.analyze(image(), stamp, status, true), (error) => {
      assert.ok(error instanceof AnalysisError);
      assert.equal(error.code, `http-${http}`);
      assert.equal(error.transient, false);
      assert.doesNotMatch(error.message, /PRIVATE|private|secret|toString/);
      return true;
    });
    assert.equal(requests, 1);
    assert.equal(client.busy, false);
    t.mock.restoreAll();
  }
});

test('CA-L4/S4: all sixteen closed evidence issue codes are safe and non-transient', async (t) => {
  assert.equal(EVIDENCE_ISSUES.length, 16);
  const messages = new Set();
  for (const reason of EVIDENCE_ISSUES) {
    const code = `invalid-evidence-${reason}`;
    let requests = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      requests++;
      return Response.json(
        { error: code, reason: 'PRIVATE LABEL', message: '<html>PRIVATE</html>', box: [999, -999] },
        { status: 422 },
      );
    });
    const client = new LunaClient();
    await assert.rejects(client.analyze(image(), stamp, status, true), (error) => {
      assert.ok(error instanceof AnalysisError);
      assert.equal(error.code, code);
      assert.equal(error.transient, false);
      assert.ok(error.message.endsWith(`(código: ${code})`));
      assert.doesNotMatch(error.message, /PRIVATE|999|html/);
      messages.add(error.message.split(' (código:')[0]);
      return true;
    });
    assert.equal(requests, 1);
    assert.equal(client.busy, false);
    t.mock.restoreAll();
  }
  assert.equal(messages.size, 16);
});

test('CA-L3/L4: HTML edge body and temporary provider errors preserve existing recovery classification', async (t) => {
  for (const [http, code, transient] of [
    [503, 'provider-network', true],
    [503, 'provider-unavailable', true],
    [503, 'provider-http-520', true],
    [504, 'provider-timeout', true],
    [429, 'budget', false],
    [401, 'provider-auth', false],
    [422, 'provider-timeout', false],
    [422, 'provider-network', false],
  ]) {
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ error: code }, { status: http }),
    );
    await assert.rejects(
      new LunaClient().analyze(image(), stamp, status, true),
      (error) =>
        error instanceof AnalysisError && error.code === code && error.transient === transient,
    );
    t.mock.restoreAll();
  }
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('<html>PRIVATE EDGE</html>', {
        status: 422,
        headers: { 'content-type': 'text/html' },
      }),
  );
  await assert.rejects(
    new LunaClient().analyze(image(), stamp, status, true),
    (error) => error.code === 'http-422' && !error.transient && !error.message.includes('PRIVATE'),
  );
});

test('CA-L3: error contract changes do not bypass consent or single-flight', async (t) => {
  let requests = 0,
    finish;
  t.mock.method(globalThis, 'fetch', () => {
    requests++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const client = new LunaClient();
  await assert.rejects(client.analyze(image(), stamp, status, false), /consentimento/);
  assert.equal(requests, 0);
  const pending = client.analyze(image(), stamp, status, true);
  await assert.rejects(client.analyze(image(), stamp, status, true), /andamento/);
  assert.equal(requests, 1);
  client.cancel();
  finish(Response.json({ error: 'invalid-evidence' }, { status: 422 }));
  assert.equal(await pending, null);
  assert.equal(client.busy, false);
});
