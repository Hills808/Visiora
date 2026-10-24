import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineTiming } from '../dist/vision/online-timing.js';

test('CA-D1/D3/S4: timings retain bounded numeric samples and distinguish text from voice callbacks', () => {
  const timing = new OnlineTiming(2);
  for (let i = 1; i <= 3; i++) timing.responded(0, i * 100, true);
  timing.started(0, 100, 300, 'voice', true, false);
  timing.completed(300, 500, 'voice', true, false);
  timing.started(0, 200, 250, 'text', false, false);
  timing.completed(250, 250, 'text', false, false);
  const data = timing.diagnostics();
  assert.deepEqual(
    data.captureToResponse.map((x) => x.milliseconds),
    [200, 300],
  );
  assert.deepEqual(data.summary.captureToResponse, [
    { simulated: true, count: 2, p50Ms: 200, p95Ms: 300 },
  ]);
  assert.deepEqual(data.preparationToStart, [
    { milliseconds: 200, simulated: true, channel: 'voice' },
    { milliseconds: 50, simulated: false, channel: 'text' },
  ]);
  assert.deepEqual(
    data.captureToStart.map((x) => x.milliseconds),
    [300, 250],
  );
  assert.deepEqual(
    data.startToCompletion.map((x) => x.milliseconds),
    [200, 0],
  );
  assert.match(data.basis, /no acoustic measurement/);
  assert.match(data.simulatedBasis, /simulation cannot be inferred/);
  assert.doesNotMatch(JSON.stringify(data), /requestId|image|signature|utterance/);
});

test('CA-F4/F6/S4: repeats and invalid clock intervals do not distort fresh response samples; retirements are categorical', () => {
  const timing = new OnlineTiming(2);
  timing.started(0, 10, 30, 'voice', false, true);
  timing.completed(30, 40, 'voice', false, true);
  timing.responded(50, 0, false);
  timing.responded(0, NaN, false);
  timing.withdrew('view');
  timing.withdrew('expiration');
  timing.withdrew('cancellation');
  const data = timing.diagnostics();
  assert.deepEqual(data.captureToResponse, []);
  assert.deepEqual(data.captureToStart, []);
  assert.deepEqual(data.startToCompletion, []);
  assert.deepEqual(data.withdrawals, { view: 1, expiration: 1, cancellation: 1 });
});

test('CA-D3/L4: session text delivery records text callbacks once; explicit Repeat adds no new timing', async () => {
  const { OnlineSession } = await import('../dist/vision/online-session.js');
  const { AutoAnalysis } = await import('../dist/vision/auto-analysis.js');
  const session = Object.create(OnlineSession.prototype);
  session.timing = new OnlineTiming(4);
  session.observeViews = () => {};
  session.withdrawDirections = () => {};
  session.running = true;
  session.generation = 1;
  session.camera = { ready: true };
  session.memory = { complete: () => true };
  session.automatic = new AutoAnalysis();
  session.counts = { delivered: 0 };
  function prepare(id, repeat = false) {
    const now = performance.now();
    session.current = {
      id,
      generation: 1,
      capturedAtMs: now - 100,
      preparedAtMs: now - 10,
      expiresAt: now + 1000,
      repeat,
      contextOnly: false,
      started: false,
      startedAtMs: null,
    };
  }
  prepare('text');
  assert.equal(session.showText('text'), true);
  assert.equal(session.showText('text'), false);
  prepare('repeat', true);
  assert.equal(session.showText('repeat'), true);
  const data = session.timing.diagnostics();
  assert.equal(data.captureToStart.length, 1);
  assert.equal(data.captureToStart[0].channel, 'text');
  assert.equal(data.startToCompletion.length, 1);
  assert.equal(data.startToCompletion[0].channel, 'text');
});
