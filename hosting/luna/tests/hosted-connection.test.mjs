import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection, transportDiagnostic } from '../lib/luna-connection.ts';

test('connection probe sends only a metadata GET, never inference/image/body', async () => {
  const result = await checkConnection('test-key', async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/models/gpt-6-luna');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return new Response('{}');
  });
  assert.deepEqual(result, { ok: true, code: 'connected', httpStatus: 200 });
});

test('probe preserves safe HTTP errors and rejects malformed secrets before fetch', async () => {
  assert.deepEqual(await checkConnection('test-key', async () => new Response('private', { status: 401 })),
    { ok: false, code: 'provider-http-401', httpStatus: 401 });
  const forbidden = () => { throw new Error('must not call fetch'); };
  assert.equal((await checkConnection(undefined, forbidden)).code, 'missing-key');
  assert.equal((await checkConnection('test-key\n', forbidden)).code, 'invalid-key-format');
});

test('redirects are returned as failures without following Location or exposing its content', async () => {
  let calls = 0;
  const result = await checkConnection('test-key', async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response('private', { status: 302, headers: { Location: 'https://other.invalid' } });
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, code: 'provider-http-302', httpStatus: 302 });
});

test('transport diagnostic redacts credentials even in malformed-header errors', async () => {
  const key = 'private-test-secret';
  const error = new TypeError(`Invalid header: ${key}; Bearer sk-test-secret`);
  const diagnostic = transportDiagnostic(error, key);
  assert.equal(diagnostic.name, 'TypeError');
  assert.equal(diagnostic.detail.includes(key), false);
  assert.equal(diagnostic.detail.includes('sk-test-secret'), false);
  const result = await checkConnection(key, async () => { throw error; });
  assert.equal(result.code, 'provider-network');
  assert.deepEqual(result.transport, diagnostic);
});
