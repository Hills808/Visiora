import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:8790';
const identity = { 'oai-authenticated-user-id': 'local-test',
  'oai-authenticated-user-email': 'local@example.test' };
const anon = await fetch(`${base}/api/vision/status`);
assert.equal(anon.status, 403);
const status = await fetch(`${base}/api/vision/status`, { headers: identity });
assert.equal(status.status, 200);
const config = await status.json();
assert.equal(config.provider, 'fake');
assert.equal(config.ready, true);
assert.match(config.csrfToken, /^[a-f0-9]{64}$/);

const stamp = { requestId: `hostedfake${Date.now()}`, sessionGeneration: 1,
  frameId: 1, capturedAtMs: Date.now(), width: 16, height: 16,
  intent: 'describe', term: '' };
const image = await readFile(new URL('./fixtures/white.jpg', import.meta.url));
const form = new FormData();
form.set('metadata', JSON.stringify(stamp));
form.set('image', new Blob([image], { type: 'image/jpeg' }), 'frame.jpg');
const headers = { ...identity, Origin: base, 'X-Visiora-CSRF': config.csrfToken,
  'X-Visiora-Consent': 'cloud-v3-continuity' };
const denied = await fetch(`${base}/api/vision/analyze`, {
  method: 'POST', headers: { ...identity, Origin: base }, body: form,
});
assert.equal(denied.status, 403);
const result = await fetch(`${base}/api/vision/analyze`, { method: 'POST', headers, body: form });
const data = await result.json();
assert.equal(result.status, 200, JSON.stringify(data));
assert.equal(data.source, 'fake');
assert.equal(data.stamp.requestId, stamp.requestId);
assert.equal(data.evidence.observations.length, 0);
const duplicate = await fetch(`${base}/api/vision/analyze`, { method: 'POST', headers, body: form });
assert.equal(duplicate.status, 409, await duplicate.text());
console.log(JSON.stringify({ auth: 403, csrf: 403, analyze: 200, duplicate: 409,
  provider: config.provider }));
