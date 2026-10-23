import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/vision/camera.js';

test('CA-H7: GPU failure keeps the stream, discards the failed frame and restarts on CPU', async () => {
  const previous = {
    document: globalThis.document,
    navigator: globalThis.navigator,
    Worker: globalThis.Worker,
  };
  const workers = [];
  let cameraRequests = 0;
  let trackStops = 0;
  const statuses = [];
  const results = [];
  const errors = [];
  const track = { stop: () => trackStops++, addEventListener: () => undefined };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = {
    videoWidth: 0,
    videoHeight: 0,
    play: async () => undefined,
    pause: () => undefined,
    srcObject: null,
  };
  class FakeWorker {
    constructor() {
      this.terminated = false;
      workers.push(this);
    }
    postMessage(message) {
      if (message.type === 'init') {
        this.forceCpu = message.forceCpu;
        queueMicrotask(() =>
          this.onmessage({
            data: { type: 'ready', provider: message.forceCpu ? 'wasm' : 'webgpu' },
          }),
        );
      }
    }
    terminate() {
      this.terminated = true;
    }
  }
  globalThis.document = { createElement: () => ({ width: 0, height: 0 }) };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          cameraRequests++;
          return stream;
        },
      },
    },
  });
  globalThis.Worker = FakeWorker;
  const camera = new Camera(
    video,
    (result) => results.push(result),
    (error) => errors.push(error),
  );
  try {
    await camera.start((message) => statuses.push(message));
    assert.equal(workers.length, 2); // Object worker plus independent scene worker.
    const gpu = workers[0];
    gpu.onmessage({ data: { type: 'error', message: 'GPU device lost' } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(workers.length, 3);
    assert.equal(workers[2].forceCpu, true);
    assert.equal(gpu.terminated, true);
    assert.equal(cameraRequests, 1);
    assert.equal(trackStops, 0);
    assert.deepEqual(results, []);
    assert.deepEqual(errors, []);
    assert.match(statuses.at(-1), /CPU/);
    workers[2].onmessage({ data: { type: 'error', message: 'CPU failed' } });
    assert.deepEqual(errors, ['CPU failed']);
    assert.equal(trackStops, 1);
  } finally {
    camera.stop();
    globalThis.document = previous.document;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previous.navigator,
    });
    globalThis.Worker = previous.Worker;
  }
});
