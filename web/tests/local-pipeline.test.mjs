import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPipeline } from '../dist/perception/local-pipeline.js';
import { WorkerLocalAdapter } from '../dist/perception/worker-adapter.js';
import { CONFIG } from '../dist/config.js';

const flush = () => new Promise(setImmediate);
const source = { id: 'test-local', revision: '1', simulated: true };
function frame(id, time = 100, generation = 1) {
  const stamp = {
    schemaVersion: 1,
    sessionGeneration: generation,
    frameId: id,
    capturedAtMs: time,
    width: 640,
    height: 480,
    orientation: 'browser-upright',
    mirrored: false,
  };
  return {
    stamp,
    pixels: (width, height) => ({
      stamp,
      transform: { width, height, scaleX: width / 640, scaleY: height / 480 },
      rgba: new ArrayBuffer(width * height * 4),
    }),
  };
}
const result = (input) => ({
  schemaVersion: 1,
  stamp: { ...input.stamp },
  transform: { ...input.transform },
  source: { ...source },
  observations: [],
});
function fixture() {
  let now = 100,
    resolve,
    reject,
    pendingFrame,
    disposed = 0,
    failed = 0;
  const accepted = [],
    inputs = [];
  const adapter = {
    source,
    input: { width: 32, height: 24 },
    analyze(input, signal) {
      inputs.push(input.stamp);
      pendingFrame = input;
      return new Promise((yes, no) => {
        resolve = yes;
        reject = no;
        signal.addEventListener('abort', () => no(new Error('aborted')), { once: true });
      });
    },
    dispose() {
      disposed++;
    },
  };
  const pipeline = new LocalPipeline(
    1,
    adapter,
    (r) => accepted.push(r),
    () => failed++,
    () => now,
  );
  return {
    pipeline,
    accepted,
    inputs,
    adapter,
    time: (value) => (now = value),
    resolve: (change = (v) => v) => resolve(change(result(pendingFrame))),
    reject: () => reject(new Error('private provider error must not be logged')),
    status: () => ({ disposed, failed }),
  };
}

test('CA-H1: single in-flight, no copy/queue while busy; next offer uses the latest frame', async () => {
  const f = fixture();
  f.pipeline.offer(frame(1));
  for (let id = 2; id <= 80; id++)
    f.pipeline.offer({
      ...frame(id),
      pixels() {
        assert.fail('queued copy');
      },
    });
  assert.equal(f.inputs.length, 1);
  assert.equal(f.pipeline.diagnostics().busySkipped, 79);
  assert.equal(f.pipeline.diagnostics().pendingFrames, 0);
  f.resolve();
  await flush();
  assert.equal(f.inputs.length, 1); // No stale frame is dispatched when the worker becomes free.
  f.pipeline.offer(frame(81));
  f.resolve();
  await flush();
  assert.deepEqual(
    f.accepted.map((r) => r.stamp.frameId),
    [1, 81],
  );
  f.pipeline.stop();
});

test('CA-H2: expired, future, duplicate, out-of-order and other-session offers never copy pixels', async () => {
  const f = fixture();
  f.pipeline.offer(frame(10));
  f.resolve();
  await flush();
  f.time(4000);
  for (const value of [
    frame(11, 0),
    frame(12, 4001),
    frame(10, 4000),
    frame(9, 4000),
    frame(13, 4000, 0),
  ])
    f.pipeline.offer({
      ...value,
      pixels() {
        assert.fail('invalid copy');
      },
    });
  assert.equal(f.pipeline.diagnostics().stale, 5);
  assert.equal(f.inputs.length, 1);
  f.pipeline.stop();
});

test('CA-H2: a slow valid result is discarded at the original 3 s boundary', async () => {
  const f = fixture();
  f.pipeline.offer(frame(1));
  f.time(3101);
  f.resolve();
  await flush();
  assert.equal(f.accepted.length, 0);
  assert.equal(f.pipeline.diagnostics().stale, 1);
  assert.equal(f.pipeline.diagnostics().inFlight, 0);
  f.pipeline.stop();
});

test('CA-H2: mismatched provenance, transform, source or invalid box cannot become evidence', async () => {
  const changes = [
    (v) => ({ ...v, stamp: { ...v.stamp, frameId: 2 } }),
    (v) => ({ ...v, stamp: { ...v.stamp, sessionGeneration: 2 } }),
    (v) => ({ ...v, stamp: { ...v.stamp, capturedAtMs: 101 } }),
    (v) => ({ ...v, transform: { ...v.transform, scaleX: 9 } }),
    (v) => ({ ...v, source: { ...v.source, revision: 'unknown' } }),
    (v) => ({
      ...v,
      observations: [
        {
          label: 'pessoa',
          score: 0.9,
          verified: true,
          box: { x: 0.9, y: 0, width: 0.9, height: 1 },
        },
      ],
    }),
  ];
  for (const change of changes) {
    const f = fixture();
    f.pipeline.offer(frame(1));
    f.resolve(change);
    await flush();
    assert.equal(f.accepted.length, 0);
    assert.equal(f.pipeline.diagnostics().invalid, 1);
    assert.deepEqual(f.status(), { disposed: 1, failed: 1 });
  }
});

test('CA-H9: stop aborts the in-flight job and late success never enters the next session', async () => {
  const f = fixture();
  f.pipeline.offer(frame(1));
  f.pipeline.stop();
  f.pipeline.stop();
  f.resolve();
  await flush();
  assert.equal(f.accepted.length, 0);
  assert.deepEqual(f.status(), { disposed: 1, failed: 0 });
  assert.equal(f.pipeline.diagnostics().inFlight, 0);
});

test('CA-H9: worker and pixel-copy failures stop once and expose no provider text', async () => {
  for (const copyFailure of [false, true]) {
    const f = fixture();
    f.pipeline.offer(
      copyFailure
        ? {
            ...frame(1),
            pixels() {
              throw new Error('private pixels');
            },
          }
        : frame(1),
    );
    if (!copyFailure) f.reject();
    await flush();
    assert.deepEqual(f.status(), { disposed: 1, failed: 1 });
    assert.equal(f.pipeline.diagnostics().state, 'error');
    assert.doesNotMatch(JSON.stringify(f.pipeline.diagnostics()), /private|rgba|pessoa|base64/);
  }
});

test('CA-H1/H9: watchdog aborts stalled perception, without retry or accumulating work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.pipeline.offer(frame(1));
  t.mock.timers.tick(CONFIG.vision.inferenceTimeoutMs);
  await flush();
  assert.deepEqual(f.status(), { disposed: 1, failed: 1 });
  assert.equal(f.pipeline.diagnostics().inFlight, 0);
});

test('CA-H9: numerical latency samples remain bounded for a long session', async () => {
  const f = fixture();
  for (let id = 1; id <= CONFIG.ui.diagnosticSamples + 3; id++) {
    f.pipeline.offer(frame(id));
    f.resolve();
    await flush();
  }
  assert.equal(f.pipeline.diagnostics().latencyMs.length, CONFIG.ui.diagnosticSamples);
  f.pipeline.stop();
});

test('CA-H1/H9: worker adapter transfers pixel ownership and cancellation rejects pending work', async () => {
  let sent,
    terminated = 0;
  const worker = {
    postMessage(value, transfer) {
      sent = structuredClone(value, { transfer });
    },
    terminate() {
      terminated++;
    },
  };
  const adapter = new WorkerLocalAdapter(worker, source, { width: 32, height: 24 });
  const input = frame(1).pixels(32, 24),
    controller = new AbortController();
  const pending = adapter.analyze(input, controller.signal);
  assert.equal(input.rgba.byteLength, 0);
  assert.equal(sent.rgba.byteLength, 32 * 24 * 4);
  await assert.rejects(adapter.analyze(frame(2).pixels(32, 24), controller.signal), /busy/);
  worker.onmessage({ data: result(sent) });
  assert.equal((await pending).stamp.frameId, 1);
  const canceled = adapter.analyze(frame(2).pixels(32, 24), controller.signal);
  controller.abort();
  await assert.rejects(canceled, /stopped/);
  adapter.dispose();
  assert.equal(terminated, 1);
  assert.equal(worker.onmessage, null);
});
