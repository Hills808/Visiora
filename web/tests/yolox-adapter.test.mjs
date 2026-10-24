import test from 'node:test';
import assert from 'node:assert/strict';
import { YoloxAdapter, validYoloxDetections } from '../dist/perception/yolox-adapter.js';
import { localInputSize, LocalFrameDiscardedError } from '../dist/perception/frame.js';
import { prepareYolox, YoloxPreparer } from '../dist/perception/yolox-preparation.js';
import { CONFIG } from '../dist/config.js';

const flush = () => new Promise(setImmediate);
function frame(width = 640, height = 480, frameId = 1) {
  return {
    stamp: {
      schemaVersion: 1,
      sessionGeneration: 1,
      frameId,
      capturedAtMs: 100,
      width,
      height,
      orientation: 'browser-upright',
      mirrored: false,
    },
    transform: { width, height, scaleX: 1, scaleY: 1 },
    rgba: new ArrayBuffer(width * height * 4),
  };
}
function browser(t) {
  const workers = [],
    draws = [];
  class FakeWorker {
    terminated = false;
    sent = [];
    constructor() {
      workers.push(this);
    }
    postMessage(data, transfer = []) {
      this.sent.push(structuredClone(data, { transfer }));
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.onmessage?.({ data });
    }
    ready(provider = 'webgpu') {
      this.emit({ type: 'ready', model: 'YOLOX Nano/Tiny/S', provider });
    }
  }
  t.mock.method(globalThis, 'Worker', function () {
    return new FakeWorker();
  });
  t.mock.method(globalThis, 'ImageData', function ImageData() {});
  t.mock.method(globalThis.document, 'createElement', () => {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({
      putImageData() {},
      fillRect() {},
      drawImage(...args) {
        draws.push(args.slice(1));
      },
      getImageData() {
        return { data: new Uint8ClampedArray(canvas.width * canvas.height * 4) };
      },
    });
    return canvas;
  });
  return { workers, draws };
}

// Node has no browser globals. Restore after each test; fake workers never load a model.
const globals = {
  Worker: globalThis.Worker,
  ImageData: globalThis.ImageData,
  document: globalThis.document,
};
test.beforeEach(() => {
  globalThis.Worker = function () {};
  globalThis.ImageData = function () {};
  globalThis.document = { createElement() {} };
});
test.afterEach(() => {
  Object.assign(globalThis, globals);
});

test('CA-H2: portrait/landscape input stays within 640 and preserves full-frame proportion', (t) => {
  const { draws } = browser(t);
  for (const [width, height, expected] of [
    [1920, 1080, { width: 640, height: 360 }],
    [1080, 1920, { width: 360, height: 640 }],
  ]) {
    const size = localInputSize(
      { width, height },
      { width: 640, height: 640, preserveAspectRatio: true },
    );
    assert.deepEqual(size, expected);
    const prepared = prepareYolox(frame(size.width, size.height));
    assert.equal(prepared.rgba.byteLength, CONFIG.vision.size ** 2 * 4);
    assert.equal(prepared.verificationRgba.byteLength, 640 ** 2 * 4);
    assert.deepEqual(prepared.bounds, { ...size, ratio: CONFIG.vision.size / 640 });
    const latest = draws.slice(-2);
    assert.deepEqual(latest[0], [
      0,
      0,
      Math.floor((size.width * CONFIG.vision.size) / 640),
      Math.floor((size.height * CONFIG.vision.size) / 640),
    ]);
    assert.deepEqual(latest[1], [0, 0, size.width, size.height]);
  }
  assert.deepEqual(localInputSize({ width: 1920, height: 1080 }, { width: 32, height: 24 }), {
    width: 32,
    height: 24,
  });
});

test('CA-H9: initialization cancellation terminates immediately without waiting 180 s', async (t) => {
  const { workers } = browser(t);
  const controller = new AbortController();
  const pending = YoloxAdapter.create(controller.signal);
  controller.abort();
  await assert.rejects(pending, /stopped/);
  assert.equal(workers[0].terminated, true);
  assert.equal(workers[0].onmessage, null);
});

test('CA-H9: continuous preparation reuses three canvases and disposal releases surfaces', (t) => {
  browser(t);
  const preparer = new YoloxPreparer();
  const canvases = document.createElement.mock.calls.map((call) => call.result);
  const first = preparer.prepare(frame());
  const second = preparer.prepare(frame());
  assert.equal(document.createElement.mock.calls.length, 3);
  assert.notEqual(first.rgba, second.rgba);
  assert.deepEqual(
    canvases.map((canvas) => [canvas.width, canvas.height]),
    [
      [640, 480],
      [CONFIG.vision.size, CONFIG.vision.size],
      [640, 640],
    ],
  );
  preparer.dispose();
  assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  assert.throws(() => preparer.prepare(frame()), /stopped/);
});

test('CA-H2/H9: real source, one inference, transferred buffers, person consensus provenance', async (t) => {
  const { workers } = browser(t);
  const pending = YoloxAdapter.create(new AbortController().signal);
  workers[0].ready();
  const adapter = await pending;
  assert.equal(adapter.source.simulated, false);
  const input = frame();
  const result = adapter.analyze(input, new AbortController().signal);
  await assert.rejects(adapter.analyze(frame(), new AbortController().signal), /busy/);
  const sent = workers[0].sent[1];
  assert.equal(sent.rgba.byteLength, CONFIG.vision.size ** 2 * 4);
  workers[0].emit({
    type: 'result',
    frameId: 1,
    capturedAtMs: 100,
    provider: 'webgpu',
    latencyMs: 10,
    detections: [
      { cls: 'person', score: 0.8, bearing: 0, box: [0.1, 0.2, 0.4, 0.9] },
      { cls: 'chair', score: 0.8, bearing: 0, box: [0.5, 0.2, 0.9, 0.9] },
    ],
  });
  const value = await result;
  assert.deepEqual(
    value.observations.map((x) => [x.label, x.verified]),
    [
      ['person', true],
      ['chair', false],
    ],
  );
  assert.deepEqual(value.stamp, input.stamp);
  assert.deepEqual(value.source, adapter.source);
  assert.deepEqual(adapter.diagnostics().inferenceByProvider, { webgpu: [10], wasm: [] });
  assert.doesNotMatch(JSON.stringify(adapter.diagnostics()), /chair|box|rgba|capturedAt/);
  adapter.dispose();
});

test('CA-H2: protocol rejects unknown fields, vocabulary, source ids and wrong frames', async (t) => {
  const { workers } = browser(t);
  for (const mutation of [
    (x) => ({ ...x, source: 'fake' }),
    (x) => ({ ...x, frameId: 2 }),
    (x) => ({ ...x, detections: [{ cls: 'door', score: 0.8, box: [0, 0, 1, 1], bearing: 0 }] }),
  ]) {
    const pending = YoloxAdapter.create(new AbortController().signal);
    const worker = workers.at(-1);
    worker.ready();
    const adapter = await pending;
    const result = adapter.analyze(frame(), new AbortController().signal);
    worker.emit(
      mutation({
        type: 'result',
        frameId: 1,
        capturedAtMs: 100,
        provider: 'webgpu',
        latencyMs: 10,
        detections: [],
      }),
    );
    await assert.rejects(result, /protocol/);
    adapter.dispose();
  }
  assert.equal(
    validYoloxDetections([
      { cls: 'person', score: 1, bearing: 0, box: [0, 0, 1, 1], private: 'no' },
    ]),
    false,
  );
});

test('CA-H7/H9: runtime GPU failure discards frame, initializes CPU once independently, then uses new frame', async (t) => {
  const { workers } = browser(t);
  const pending = YoloxAdapter.create(new AbortController().signal);
  workers[0].ready();
  const adapter = await pending;
  const failed = adapter.analyze(frame(), new AbortController().signal);
  workers[0].emit({ type: 'error', message: 'device lost' });
  await assert.rejects(failed, LocalFrameDiscardedError);
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(workers[1].sent[0], { type: 'init', forceCpu: true });
  await assert.rejects(
    adapter.analyze(frame(), new AbortController().signal),
    LocalFrameDiscardedError,
  );
  workers[1].ready('wasm');
  await flush();
  const next = adapter.analyze(frame(640, 480, 2), new AbortController().signal);
  workers[1].emit({
    type: 'result',
    frameId: 2,
    capturedAtMs: 100,
    provider: 'wasm',
    latencyMs: 10,
    detections: [],
  });
  assert.equal((await next).stamp.frameId, 2);
  assert.deepEqual(adapter.diagnostics().inferenceByProvider, { webgpu: [], wasm: [10] });
  const cpuFailed = adapter.analyze(frame(640, 480, 3), new AbortController().signal);
  workers[1].emit({ type: 'error', message: 'cpu failed' });
  await assert.rejects(cpuFailed, /failed/);
  assert.equal(workers.length, 2);
  adapter.dispose();
});
