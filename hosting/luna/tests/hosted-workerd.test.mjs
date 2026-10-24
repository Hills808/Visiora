import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { Miniflare, Response } from 'miniflare';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = { scene: null, observations: [], relations: [], limitations: [] };
const files = ['lib/luna-policy', 'lib/luna-budget', 'lib/luna-provider-errors',
  'lib/luna-provider', 'lib/luna-connection', 'web/src/perception/evidence',
  'lib/luna-http', 'lib/luna-reconcile', 'app/api/vision/reconcile/route'];

async function modules() {
  const loaded = await Promise.all(files.map(async (file) => {
    let source = await readFile(path.join(root, `${file}.ts`), 'utf8');
    if (file === 'lib/luna-provider') {
      const prompt = await readFile(path.join(root, 'web/prompts/luna-vision-v1.md'), 'utf8');
      const schema = JSON.parse(await readFile(path.join(root, 'web/schemas/visual-evidence-v1.json'), 'utf8'));
      source = source.replace(/^import prompt[^;]+;/m, `const prompt = ${JSON.stringify(prompt)};`)
        .replace(/^import schema[^;]+;/m, `const schema = ${JSON.stringify(schema)};`);
    }
    source = source.replace(/from '(\.[^']+?)(?:\.ts)?'/g, "from '$1.mjs'");
    return { type: 'ESModule', path: path.join(root, `${file}.mjs`),
      contents: ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
      } }).outputText };
  }));
  return [{ type: 'ESModule', path: path.join(root, 'test-worker.mjs'), contents: `
    import { checkConnection } from './lib/luna-connection.mjs';
    import { analyzeImage } from './lib/luna-provider.mjs';
    import { POST } from './app/api/vision/reconcile/route.mjs';
    import { reserve } from './lib/luna-budget.mjs';
    export default { async fetch(request, env) {
      if (new URL(request.url).pathname === '/api/vision/reconcile') return POST(request);
      if (new URL(request.url).pathname === '/duplicate') {
        try { await reserve(env.DB, 'old-request', 2000000, 300000, Date.now()); }
        catch (error) { return Response.json({ error: error.code }, { status: error.status }); }
      }
      if (new URL(request.url).pathname === '/connection')
        return Response.json(await checkConnection('test-key'));
      try {
        const result = await analyzeImage(new Uint8Array([255,216,255,217]),
          { intent: 'describe', term: '' }, 'test-key', async model => model === 'gpt-6-luna');
        return Response.json(result);
      } catch (error) { return Response.json({ error: error.code }, { status: error.status || 500 }); }
    } };
  ` }, ...loaded];
}

test('CA-L4: actual workerd accepts metadata and inference fetch options; redirects stay blocked', async () => {
  let redirect = false;
  const requests = [];
  const mf = new Miniflare({ modules: await modules(), compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'], cf: false,
    outboundService: async request => {
      requests.push({ method: request.method, url: request.url });
      assert.equal(request.headers.get('authorization'), 'Bearer test-key');
      if (redirect) return new Response('private', { status: 302,
        headers: { Location: 'https://other.invalid/never-follow' } });
      if (request.method === 'GET') return Response.json({ id: 'gpt-6-luna' });
      const payload = await request.json();
      assert.equal(payload.model, 'gpt-6-luna');
      assert.equal(payload.store, false);
      return Response.json({ model: 'gpt-6-luna', status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(evidence) }] }],
        usage: { input_tokens: 10, output_tokens: 10 } });
    } });
  try {
    const connection = await mf.dispatchFetch('http://localhost/connection');
    assert.equal((await connection.json()).code, 'connected');
    const result = await mf.dispatchFetch('http://localhost/analyze');
    assert.equal(result.status, 200);
    assert.deepEqual((await result.json()).evidence, evidence);
    redirect = true;
    const denied = await mf.dispatchFetch('http://localhost/analyze');
    assert.equal(denied.status, 422);
    assert.equal((await denied.json()).error, 'provider-request');
    assert.equal(requests.length, 3);
    assert.equal(requests.every(request => new URL(request.url).hostname === 'api.openai.com'), true);
  } finally { await mf.dispose(); }
});

test('CA-L1/L4: workerd normalizes representation only and preserves precise semantic refusals', async () => {
  const generated = {
    scene: { label: ' escrito\u0301rio ', support: ['Object_1'] },
    observations: [{ id: 'Object_1', kind: 'object', article: 'uma', label: ' cadeira ',
      uncertain: false, box: { x: 0.1, y: 0.2, width: 0.2, height: 0.5 } }],
    relations: [], limitations: ['Pouca luz.'],
  };
  let value = structuredClone(generated);
  const mf = new Miniflare({ modules: await modules(), compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'], cf: false,
    outboundService: async request => {
      const payload = await request.json();
      const contract = payload.text.format.schema.properties;
      assert.equal(contract.observations.items.properties.box.anyOf[0].properties.width.exclusiveMinimum, 0);
      assert.equal(contract.scene.anyOf[0].properties.support.minItems, 1);
      return Response.json({ model: 'gpt-6-luna', status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
        usage: { input_tokens: 10, output_tokens: 10 } });
    } });
  try {
    const accepted = await mf.dispatchFetch('http://localhost/analyze');
    assert.equal(accepted.status, 200);
    const result = await accepted.json();
    assert.equal(result.evidence.scene.label, 'escritório');
    assert.deepEqual(result.evidence.scene.support, ['o1']);
    assert.deepEqual(result.evidence.observations[0].box, generated.observations[0].box);
    assert.deepEqual(result.evidence.limitations, ['Pouca luz']);
    for (const [mutate, reason] of [
      [v => v.observations[0].box.x = 0.9, 'box-bounds'],
      [v => v.observations[0].box.width = 0, 'box-empty'],
      [v => v.scene.support = ['o1'], 'scene-support-reference'],
      [v => v.observations[0].kind = ['person'], 'enum-type'],
    ]) {
      value = structuredClone(generated); mutate(value);
      const rejected = await mf.dispatchFetch('http://localhost/analyze');
      assert.equal(rejected.status, 422);
      assert.deepEqual(await rejected.json(), { error: `invalid-evidence-${reason}` });
    }
  } finally { await mf.dispose(); }
});

test('explicit reconciliation checks auth/origin/CSRF/age and preserves the entire hold and duplicate ID', async () => {
  const mf = new Miniflare({ modules: await modules(), compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'], cf: false, d1Databases: ['DB'],
    outboundService: () => { assert.fail('reconciliation must not call an external API'); } });
  try {
    const db = await mf.getD1Database('DB');
    const migration = await readFile(path.join(root, 'drizzle/0000_daily_unus.sql'), 'utf8');
    for (const sql of migration.split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql).run();
    const now = Date.now();
    const token = 'a'.repeat(64);
    await db.prepare('INSERT INTO csrf_tokens VALUES(?,?,?)').bind(token, 'owner', now + 60_000).run();
    for (const [id, at, state] of [['old-request', now - 600_000, 'pending'],
      ['new-request', now, 'pending'], ['completed-request', now - 600_000, 'complete']]) {
      await db.prepare('INSERT INTO requests(id,at,day,charge,state) VALUES(?,?,?,?,?)')
        .bind(id, at, '2026-10-24', 300_000, state).run();
    }
    const base = 'https://example.test';
    const headers = { 'oai-authenticated-user-id': 'owner', Origin: base, 'x-visiora-csrf': token,
      'x-visiora-reconcile-request': 'old-request', 'x-visiora-acknowledge-uncertain': '1' };
    const call = custom => mf.dispatchFetch(`${base}/api/vision/reconcile`, { method: 'POST', headers: custom });
    assert.equal((await call({})).status, 403);
    assert.equal((await call({ ...headers, Origin: 'https://other.invalid' })).status, 403);
    assert.equal((await call({ ...headers, 'x-visiora-csrf': '' })).status, 403);
    assert.equal((await call({ ...headers, 'x-visiora-acknowledge-uncertain': '0' })).status, 400);
    assert.equal((await call({ ...headers, 'x-visiora-reconcile-request': 'new-request' })).status, 409);
    assert.equal((await call({ ...headers, 'x-visiora-reconcile-request': 'completed-request' })).status, 409);
    assert.equal((await call(headers)).status, 200);
    assert.equal((await call(headers)).status, 200);
    const row = await db.prepare('SELECT * FROM requests WHERE id=?').bind('old-request').first();
    assert.equal(row.state, 'uncertain');
    assert.equal(row.charge, 300_000);
    assert.equal(row.at, now - 600_000);
    assert.equal(row.error_code, 'operator-reconciled');
    assert.equal(row.input, null);
    const duplicate = await mf.dispatchFetch(`${base}/duplicate`);
    assert.equal((await duplicate.json()).error, 'duplicate');
  } finally { await mf.dispose(); }
});
