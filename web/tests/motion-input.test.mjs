import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionInput } from '../dist/vision/motion-input.js';
import { CONFIG } from '../dist/config.js';

function setup(overrides = {}) {
  let at = 1000;
  let listener = null;
  let rotations = 0;
  let requests = 0;
  const host = {
    secure: true,
    supported: true,
    requestPermission: () => {
      requests++;
      return Promise.resolve('granted');
    },
    listen: (value) => {
      listener = value;
    },
    unlisten: (value) => {
      assert.equal(listener, value);
      listener = null;
    },
    ...overrides,
  };
  const input = new MotionInput(
    host,
    () => rotations++,
    () => at,
  );
  return {
    input,
    get requests() {
      return requests;
    },
    get listening() {
      return listener !== null;
    },
    get rotations() {
      return rotations;
    },
    advance: (ms) => {
      at += ms;
    },
    emit: (rate = { alpha: 25, beta: 0, gamma: 0 }) => listener?.({ rotationRate: rate }),
  };
}
test('sensor is opt-in, requests permission synchronously and listens only during Luna', async () => {
  const s = setup();
  s.input.setRunning(true);
  assert.equal(s.requests, 0);
  assert.equal(s.listening, false);
  const enabling = s.input.enable();
  assert.equal(s.requests, 1);
  await enabling;
  assert.equal(s.listening, true);
  assert.match(s.input.status, /sem leitura recente/);
  s.emit();
  s.advance(30);
  s.emit();
  assert.equal(s.rotations, 1);
  assert.match(s.input.status, /Recebendo leituras/);
  s.advance(CONFIG.cameraRotation.staleMs + 1);
  assert.match(s.input.status, /sem leitura recente/);
  s.input.setRunning(false);
  assert.equal(s.listening, false);
  assert.match(s.input.status, /aguarda uma sessão/);
  s.input.setRunning(true);
  s.emit();
  assert.equal(s.rotations, 1, 'stopping clears consecutive rotation samples');
  s.input.disable();
  assert.equal(s.listening, false);
  assert.equal(s.input.enabled, false);
});
test('denied, unavailable and insecure devices do not attach a listener', async () => {
  for (const options of [
    { secure: false },
    { supported: false },
    { requestPermission: () => Promise.resolve('denied') },
  ]) {
    const s = setup(options);
    s.input.setRunning(true);
    await s.input.enable();
    assert.equal(s.listening, false);
    assert.equal(s.input.enabled, false);
    assert.match(s.input.status, /indisponível|negada/);
  }
});
test('revocation during pending permission cannot activate later; missing samples stay unavailable', async () => {
  let resolve;
  const s = setup({
    requestPermission: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  s.input.setRunning(true);
  const pending = s.input.enable();
  s.input.disable();
  resolve('granted');
  await pending;
  assert.equal(s.listening, false);
  const n = setup({ requestPermission: undefined });
  n.input.setRunning(true);
  await n.input.enable();
  n.emit(null);
  n.advance(30);
  n.emit({ alpha: null, beta: 0, gamma: 0 });
  assert.equal(n.rotations, 0);
  assert.match(n.input.status, /sem leitura recente/);
  const diagnostic = n.input.diagnostics();
  assert.equal(diagnostic.recentReading, false);
  assert.equal(JSON.stringify(diagnostic).includes('alpha'), false);
});
