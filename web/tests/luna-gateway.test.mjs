import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Budget } from '../server/budget.mjs';
import { loadConfig } from '../server/config.mjs';
import { createGateway } from '../server/gateway.mjs';

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
const evidence = { scene: null, observations: [], relations: [], limitations: [] };
// Structural JPEG header only: tests validation/transport, never the provider's vision quality.
const jpeg = Buffer.from([255, 216, 255, 192, 0, 8, 8, 0, 2, 0, 2, 0, 255, 217]);
async function setup(config = {}, provider = async () => ({ evidence, usage: null })) {
  const cfg = { ...loadConfig({ VISIORA_PROVIDER: 'fake' }), ...config };
  const budget = new Budget(':memory:', cfg);
  const server = createGateway(cfg, { budget, provider });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(base + '/api/vision/status')).json();
  const post = (options = {}) => {
    const form = new FormData();
    form.set('metadata', JSON.stringify({ ...stamp, ...options.stamp }));
    form.set('image', new Blob([options.image ?? jpeg], { type: 'image/jpeg' }), 'frame.jpg');
    return fetch(base + '/api/vision/analyze', {
      method: 'POST',
      body: form,
      headers: { Origin: base, 'X-Visiora-CSRF': status.csrfToken, ...options.headers },
    });
  };
  return {
    base,
    server,
    post,
    budget,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeIdleConnections();
      }),
  };
}
test('CA-L2: real HTTP, same origin and CSRF enforced; no images stored or secret returned', async () => {
  let calls = 0;
  const g = await setup({}, async () => {
    calls++;
    return { evidence, usage: null };
  });
  try {
    assert.equal((await fetch(g.base + '/')).status, 200);
    assert.equal((await g.post({ headers: { Origin: 'https://attacker.invalid' } })).status, 403);
    assert.equal((await g.post({ headers: { 'X-Visiora-CSRF': 'wrong' } })).status, 403);
    assert.equal(calls, 0);
    const response = await g.post();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const value = await response.json();
    assert.deepEqual(value.stamp, stamp);
    assert.equal(value.source, 'fake');
    assert.equal(calls, 1);
    assert.equal((await g.post()).status, 409);
    assert.equal(calls, 1);
    const hostileHost = await new Promise((resolve, reject) => {
      http
        .get(g.base + '/api/vision/status', { headers: { Host: 'malicious.invalid' } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on('error', reject);
    });
    assert.equal(hostileHost, 403);
    assert.equal((await fetch(g.base + '/server/config.mjs')).status, 404);
  } finally {
    await g.close();
  }
});
test('CA-L2/L3: disabled configuration, missing consent and insufficient quota never dispatch', async () => {
  let calls = 0;
  for (const config of [
    { provider: 'luna', ready: false },
    { provider: 'luna', ready: true },
  ]) {
    const g = await setup(config, async () => {
      calls++;
      return { evidence, usage: null };
    });
    try {
      assert.equal((await g.post()).status, config.ready ? 403 : 503);
      if (config.ready)
        assert.equal((await g.post({ headers: { 'X-Visiora-Consent': 'cloud-v1' } })).status, 403);
      if (config.ready)
        assert.equal(
          (await g.post({ headers: { 'X-Visiora-Consent': 'cloud-v2-auto' } })).status,
          403,
        );
      if (config.ready)
        assert.equal(
          (await g.post({ headers: { 'X-Visiora-Consent': 'cloud-v3-continuity' } })).status,
          429,
        );
    } finally {
      await g.close();
    }
  }
  assert.equal(calls, 0);
});
test('CA-L1/L2: oversized body, invalid JPEG, dimensions and injected fields rejected before provider', async () => {
  let calls = 0;
  const g = await setup({}, async () => {
    calls++;
    return { evidence, usage: null };
  });
  try {
    assert.equal((await g.post({ image: Buffer.from('not jpeg') })).status, 400);
    assert.equal((await g.post({ stamp: { width: 3 } })).status, 400);
    assert.equal((await g.post({ stamp: { model: 'another' } })).status, 400);
    assert.equal((await g.post({ stamp: { term: '<script>' } })).status, 400);
    const tooBig = await fetch(g.base + '/api/vision/analyze', {
      method: 'POST',
      body: Buffer.alloc(1050001),
      headers: {
        Origin: g.base,
        'X-Visiora-CSRF': (await (await fetch(g.base + '/api/vision/status')).json()).csrfToken,
      },
    });
    assert.equal(tooBig.status, 413);
    assert.equal(calls, 0);
  } finally {
    await g.close();
  }
});
test('CA-L3: simultaneous requests dispatch once; uncertain failure keeps reservation and no retry', async () => {
  let finish,
    calls = 0;
  const g = await setup({}, () => {
    calls++;
    return new Promise((resolve) => (finish = resolve));
  });
  try {
    const pending = g.post();
    // Poll a deterministic server-side condition; no fixed sleep to resolve a race.
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 3000;
      function check() {
        if (calls) resolve();
        else if (Date.now() > deadline) reject(new Error('dispatch timeout'));
        else setImmediate(check);
      }
      check();
    });
    assert.equal(
      (await g.post({ stamp: { requestId: stamp.requestId.replace(/1$/, '2') } })).status,
      409,
    );
    finish({ evidence, usage: null });
    assert.equal((await pending).status, 200);
    assert.equal(calls, 1);
  } finally {
    await g.close();
  }
  const bad = await setup(
    { provider: 'luna', ready: true, daily: 1000000, total: 1000000 },
    async () => {
      throw new Error('SECRET UPSTREAM IMAGE');
    },
  );
  try {
    const response = await bad.post({ headers: { 'X-Visiora-Consent': 'cloud-v3-continuity' } });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /SECRET|IMAGE/);
    const record = bad.budget.db.prepare('SELECT state,charge FROM requests').get();
    assert.equal(record.state, 'uncertain');
    assert.equal(record.charge, 300000);
  } finally {
    await bad.close();
  }
});
test('CA-L2: service worker uses explicit asset allow-list, never API responses', async () => {
  const sw = await readFile('public/sw.js', 'utf8');
  assert.match(sw, /ASSETS.includes\(asset\)/);
  assert.match(sw, /method !== 'GET'/);
});


test('CA-L2: public HTTPS origin is opt-in, exact, and still requires CSRF and consent', async () => {
  assert.throws(() => loadConfig({ VISIORA_PROVIDER: 'fake', VISIORA_PUBLIC_ORIGIN: 'http://app.example' }), /HTTPS/);
  assert.throws(() => loadConfig({ VISIORA_PROVIDER: 'fake', VISIORA_PUBLIC_ORIGIN: 'https://app.example/' }), /HTTPS/);
  assert.throws(() => loadConfig({ VISIORA_PROVIDER: 'fake', VISIORA_PUBLIC_ORIGIN: 'https://*.example' }), /inválida|HTTPS/);
  const config = loadConfig({
    VISIORA_PROVIDER: 'fake',
    VISIORA_PUBLIC_ORIGIN: 'https://visiora.example',
  });
  assert.equal(config.publicOrigin, 'https://visiora.example');
  const g = await setup({ publicOrigin: config.publicOrigin });
  try {
    assert.equal((await g.post()).status, 403);
    assert.equal((await g.post({ headers: { Origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await g.post({ headers: { Origin: 'https://visiora.example', 'X-Visiora-CSRF': 'bad' } })).status, 403);
    const response = await g.post({ headers: { Origin: 'https://visiora.example' } });
    assert.equal(response.status, 200);
  } finally {
    await g.close();
  }
});
