import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Budget } from '../server/budget.mjs';
import { loadConfig } from '../server/config.mjs';
import { createGateway } from '../server/gateway.mjs';
import { createProvider } from '../server/provider.mjs';
import { inspectResponseModel } from '../server/response-model.mjs';

const evidence = { scene: null, observations: [], relations: [], limitations: [] };
const stamp = {
  requestId: '00000000-0000-4000-a000-000000000001',
  sessionGeneration: 1,
  frameId: 1,
  capturedAtMs: 1000,
  width: 2,
  height: 2,
  intent: 'describe',
  term: '',
};
const payload = (model) => ({
  model,
  status: 'completed',
  usage: { input_tokens: 100, output_tokens: 50 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(evidence) }] }],
});

test('CA-L1/L2: verify provider model exactly; missing/invalid IDs are not copied from the requested model', () => {
  for (const [raw, expected] of [
    ['gpt-6-luna', 'verified'],
    ['gpt-6-astra', 'mismatch'],
    ['gpt-6-luna-unknown', 'mismatch'],
    [undefined, 'missing'],
    [null, 'missing'],
    ['', 'invalid'],
    [42, 'invalid'],
    [{ model: 'gpt-6-luna' }, 'invalid'],
    ['gpt-6-luna\ninjected log', 'invalid'],
    ['gpt-6-luna\n', 'invalid'],
    ['sk-PRIVATE', 'invalid'],
    ['g'.repeat(129), 'invalid'],
  ]) {
    const audit = inspectResponseModel(raw);
    assert.equal(audit.verification, expected);
    assert.equal(audit.requestedModel, 'gpt-6-luna');
    assert.equal(audit.returnedModel, ['invalid', 'missing'].includes(expected) ? null : raw);
  }
});

test('CA-L1/L3: real HTTP gateway records each returned model before accepting or rejecting evidence', async () => {
  for (const [model, expected, httpStatus] of [
    ['gpt-6-luna', 'verified', 200],
    ['gpt-6-astra', 'mismatch', 502],
    [undefined, 'missing', 502],
    ['sk-PRIVATE', 'invalid', 502],
  ]) {
    const cfg = loadConfig({
      OPENAI_API_KEY: 'TEST-ONLY',
      VISIORA_LUNA_ENABLED: '1',
      VISIORA_DAILY_USD: '2',
      VISIORA_TOTAL_USD: '2',
      VISIORA_PRICING_CONFIRMED: '2026-10-18',
    });
    const budget = new Budget(':memory:', cfg);
    const logs = [];
    let calls = 0;
    const server = createGateway(cfg, {
      budget,
      logModel: (value) => logs.push(value),
      fetcher: async () => {
        calls++;
        return Response.json(payload(model));
      },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const status = await (await fetch(base + '/api/vision/status')).json();
      const form = new FormData();
      form.set('metadata', JSON.stringify(stamp));
      form.set(
        'image',
        new Blob([Buffer.from([255, 216, 255, 192, 0, 8, 8, 0, 2, 0, 2, 0, 255, 217])], {
          type: 'image/jpeg',
        }),
        'frame.jpg',
      );
      const response = await fetch(base + '/api/vision/analyze', {
        method: 'POST',
        body: form,
        headers: {
          Origin: base,
          'X-Visiora-CSRF': status.csrfToken,
          'X-Visiora-Consent': 'cloud-v3-continuity',
        },
      });
      assert.equal(response.status, httpStatus);
      const body = await response.json();
      if (httpStatus === 200) assert.deepEqual(body.evidence, evidence);
      else assert.equal(body.evidence, undefined);
      assert.equal(calls, 1); // No paid retry after an unverifiable response.
      const row = budget.db.prepare('SELECT * FROM model_responses').get();
      assert.equal(row.request_id, stamp.requestId);
      assert.equal(row.requested_model, 'gpt-6-luna');
      assert.equal(row.verification, expected);
      assert.equal(row.returned_model, ['missing', 'invalid'].includes(expected) ? null : model);
      const models = logs.filter((row) => row.event === 'visiora_model_response');
      assert.equal(models.length, 1);
      assert.equal(models[0].verification, expected);
      assert.doesNotMatch(JSON.stringify({ logs, row, body }), /TEST-ONLY|sk-PRIVATE|base64/);
      const charge = budget.db.prepare('SELECT state,charge FROM requests').get();
      assert.equal(charge.state, httpStatus === 200 ? 'complete' : 'uncertain');
      if (httpStatus !== 200) assert.equal(charge.charge, 300000);
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  }
});

test('CA-L1/L2: refused/incomplete/error/malformed responses also record only model metadata', async () => {
  for (const response of [
    () => Response.json({ ...payload('gpt-6-luna'), status: 'incomplete' }),
    () =>
      Response.json({
        ...payload('gpt-6-luna'),
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'PRIVATE' }] }],
      }),
    () => Response.json({ error: { message: 'PRIVATE' } }, { status: 429 }),
    () => new Response('PRIVATE INVALID JSON'),
  ]) {
    const recorded = [];
    const provider = createProvider(
      { provider: 'luna', apiKey: 'TEST-ONLY' },
      async () => response(),
      (id, audit) => recorded.push({ id, ...audit }),
    );
    await assert.rejects(provider(Buffer.from('PRIVATE IMAGE'), stamp));
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].id, stamp.requestId);
    assert.doesNotMatch(JSON.stringify(recorded), /PRIVATE|TEST-ONLY/);
  }
});

test('CA-L2/L3: failed durable model audit blocks delivery; fake and transport failures cannot claim a model', async () => {
  const failing = createProvider(
    { provider: 'luna', apiKey: 'TEST-ONLY' },
    async () => Response.json(payload('gpt-6-luna')),
    () => {
      throw new Error('audit failed');
    },
  );
  await assert.rejects(failing(Buffer.from([]), stamp), /audit failed/);
  let records = 0;
  const record = () => records++;
  const fake = createProvider(
    { provider: 'fake' },
    () => {
      throw new Error('must not dispatch');
    },
    record,
  );
  await fake(Buffer.from([]), stamp);
  const offline = createProvider(
    { provider: 'luna', apiKey: 'TEST-ONLY' },
    () => {
      throw new Error('offline');
    },
    record,
  );
  await assert.rejects(offline(Buffer.from([]), stamp), /provider-network/);
  assert.equal(records, 0);
});

test('CA-L3: opening an existing ledger preserves spending, pending records and historical lack of model evidence', () => {
  mkdirSync('artifacts', { recursive: true });
  const dir = mkdtempSync(path.resolve('artifacts/model-migration-'));
  mkdirSync(path.join(dir, '.runtime'));
  const file = path.join(dir, '.runtime', 'luna-budget.sqlite');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE requests (id TEXT PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL,
    charge INTEGER NOT NULL, state TEXT NOT NULL, input INTEGER, output INTEGER);
    INSERT INTO requests VALUES ('old',100000,'1970-01-01',300000,'pending',NULL,NULL);`);
  old.close();
  const viewer = path.resolve('tools/luna-models.mjs');
  const before = spawnSync(process.execPath, [viewer], { cwd: dir, encoding: 'utf8' });
  assert.equal(before.status, 0);
  assert.match(before.stdout, /ainda não tem a conferência/);
  let budget;
  try {
    budget = new Budget(file, { daily: 2000000, total: 2000000 }, () => 120000);
    assert.equal(
      budget.db.prepare('SELECT charge FROM requests WHERE id=?').get('old').charge,
      300000,
    );
    assert.equal(budget.db.prepare('SELECT COUNT(*) n FROM model_responses').get().n, 0);
    assert.throws(() => budget.reserve('new'), /busy/);
    budget.recordModel('old', inspectResponseModel('gpt-6-luna'));
    budget.uncertain('old');
    budget.close();
    budget = new Budget(file, { daily: 2000000, total: 2000000 });
    assert.equal(
      budget.db.prepare('SELECT verification FROM model_responses').get().verification,
      'verified',
    );
    assert.equal(budget.db.prepare('SELECT charge FROM requests').get().charge, 300000);
    const shown = spawnSync(process.execPath, [viewer], { cwd: dir, encoding: 'utf8' });
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /gpt-6-luna/);
    assert.match(shown.stdout, /verified/);
    assert.match(shown.stdout, /uncertain/);
    assert.throws(
      () => budget.recordModel('missing', inspectResponseModel('gpt-6-luna')),
      /model-audit/,
    );
  } finally {
    budget?.close();
    assert.ok(dir.startsWith(path.resolve('artifacts') + path.sep));
    rmSync(dir, { recursive: true, force: true });
  }
});
