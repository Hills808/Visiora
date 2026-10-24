import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraRotationGuard } from '../dist/vision/camera-rotation.js';
import { SnapshotView } from '../dist/vision/snapshot-view.js';
import { OnlineSession } from '../dist/vision/online-session.js';
import { AutoAnalysis } from '../dist/vision/auto-analysis.js';
import { CONFIG } from '../dist/config.js';
const options = { minRateDegPerSecond: 15, confirmations: 2, maxGapMs: 200 };
const high = { alpha: 9, beta: -12, gamma: 0 }; // Norm is 15 deg/s, regardless of axis/sign.

test('CA-F5/L4: rotation norm needs distinct nearby samples; sustained rotation keeps confirming', () => {
  const guard = new CameraRotationGuard(options);
  assert.equal(guard.observe(high, 0), false);
  assert.equal(guard.observe(high, 100), true);
  assert.equal(guard.observe(high, 200), true);
  assert.equal(guard.observe({ alpha: 0, beta: 0, gamma: -14 }, 300), false);
  assert.equal(guard.observe(high, 400), false);
  assert.equal(guard.observe(high, 600), true);
  assert.equal(guard.observe(high, 801), false);
  assert.equal(guard.observe(high, 850), true);
  guard.reset();
  assert.equal(guard.observe(high, 900), false);
});

test('CA-F5/S4: missing/nonfinite axes and clocks reset confirmation; duplicate/out-of-order samples never confirm', () => {
  for (const bad of [
    null,
    { ...high, alpha: null },
    { ...high, beta: NaN },
    { ...high, gamma: Infinity },
  ]) {
    const guard = new CameraRotationGuard(options);
    guard.observe(high, 10);
    assert.equal(guard.observe(bad, 20), false);
    assert.equal(guard.observe(high, 30), false);
  }
  for (const at of [NaN, Infinity, -1, 10, 9]) {
    const guard = new CameraRotationGuard(options);
    guard.observe(high, 10);
    assert.equal(guard.observe(high, at), false);
    assert.equal(guard.observe(high, 30), false);
  }
  assert.throws(() => new CameraRotationGuard({ ...options, confirmations: 1 }), RangeError);
  assert.throws(() => new CameraRotationGuard({ ...options, maxGapMs: 0 }), RangeError);
  assert.throws(
    () => new CameraRotationGuard({ ...options, minRateDegPerSecond: NaN }),
    RangeError,
  );
});

test('CA-F3/F6/L4: explicit rotation invalidates both capture views irreversibly, cancels once and respects replacement gates', () => {
  const session = Object.create(OnlineSession.prototype);
  const view = [0.5];
  session.camera = { ready: true, signature: view };
  session.running = true;
  session.generation = 1;
  session.cameraRotationInvalidations = 0;
  session.counts = { obsolete: 0 };
  session.memory = { forgetDirections: () => {} };
  session.automatic = new AutoAnalysis();
  session.automatic.dispatched(0, view);
  session.resultView = new SnapshotView(view);
  session.pendingView = new SnapshotView(view);
  session.current = {
    id: 'old',
    repeat: false,
    contextOnly: false,
    automatic: true,
    view: session.resultView,
    started: true,
    startedAtMs: performance.now(),
    capturedAtMs: performance.now(),
    generation: 1,
  };
  let canceled = 0;
  session.hooks = { cancelSpeech: () => canceled++ };
  session.clearReferences = () => {};
  session.observeCameraRotation();
  assert.equal(session.resultView.valid, false);
  assert.equal(session.pendingView.valid, false);
  assert.equal(session.current, null);
  assert.equal(canceled, 1);
  session.observeCameraRotation();
  assert.equal(canceled, 1);
  assert.equal(session.cameraRotationInvalidations, 1);
  assert.equal(session.resultView.observe(view), false);
  assert.equal(session.resultView.valid, false);
  const gap = CONFIG.online.autoIntervalMs;
  assert.equal(session.automatic.due(gap - 1, view, true, false), false);
  assert.equal(session.automatic.due(gap, view, true, true), false);
  assert.equal(session.automatic.due(gap, view, true, false), true);
  session.automatic.dispatched(gap, view);
  assert.equal(session.automatic.due(gap * 2, view, true, false), false);
  session.resultView = new SnapshotView(view);
  assert.equal(session.resultView.valid, true); // No sticky rotation gate.
  session.running = false;
  session.observeCameraRotation();
  assert.equal(session.resultView.valid, true);
});

test('CA-F6/L4: output interruption clears pending delivery once, never confirms, and stale callbacks cannot clear new output', () => {
  const session = Object.create(OnlineSession.prototype);
  session.automatic = new AutoAnalysis();
  session.automatic.dispatched(0, [0]);
  session.current = { id: 'old', started: true };
  let retirements = 0;
  session.timing = { withdrew: () => retirements++ };
  session.interrupted('old');
  session.interrupted('old');
  assert.equal(session.current, null);
  assert.equal(session.waiting, null);
  assert.equal(retirements, 1);
  assert.equal(session.automatic.isPaused, false);
  assert.equal(session.automatic.due(CONFIG.online.autoIntervalMs, [0], true, false), true);
  session.current = { id: 'new' };
  session.interrupted('old');
  assert.equal(session.current.id, 'new');
  session.automatic.pause();
  session.interrupted('new');
  assert.equal(session.automatic.due(100000, [0], true, false), false);
});
