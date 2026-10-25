import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureHub } from '../dist/vision/capture-hub.js';
import { SnapshotCamera } from '../dist/vision/snapshot-camera.js';
import { CONFIG } from '../dist/config.js';

test('CA-H1/H9: resize surfaces are bounded and reused while pixel contents and timestamps stay fresh', async (t) => {
  const f = setup(t);
  const observations = [];
  f.hub.subscribe((frame) => {
    const rgb = frame.pixels(32, 24);
    const detector = frame.pixels(640, 480);
    observations.push([
      frame.stamp.frameId,
      new Uint8Array(rgb.rgba)[0],
      new Uint8Array(detector.rgba)[0],
    ]);
  });
  await f.hub.start(1);
  for (let i = 1; i <= 10; i++) {
    f.pixels(i);
    f.emit(i * 250, i);
  }
  assert.equal(f.canvases.length, 1 + CONFIG.continuous.derivativeCanvases);
  assert.equal(observations.length, 10);
  assert.deepEqual(
    observations.map((row) => row.slice(1)),
    Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]),
  );
  f.hub.stop();
  assert.ok(f.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
});

function setup(
  t,
  { fallback = false, quality = true, delayPermission = false, delayPlay = false } = {},
) {
  let now = 0,
    requested = 0,
    stopped = 0,
    canceled = 0,
    ended = 0,
    callback;
  let permit, play, blob;
  let pixelValue = 0;
  const canvases = [],
    tracks = [],
    frameCallbacks = new Map();
  const video = {
    paused: true,
    readyState: 2,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 0,
    srcObject: null,
    decoded: 0,
    play() {
      this.paused = false;
      return delayPlay ? new Promise((r) => (play = r)) : Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    ...(!fallback
      ? {
          requestVideoFrameCallback(fn) {
            callback = fn;
            return 1;
          },
          cancelVideoFrameCallback() {
            canceled++;
            callback = null;
          },
        }
      : {}),
    ...(quality
      ? {
          getVideoPlaybackQuality() {
            return { totalVideoFrames: this.decoded };
          },
        }
      : {}),
  };
  const media = {
    getUserMedia: async (constraints) => {
      requested++;
      assert.equal(constraints.audio, false);
      const track = {
        stop() {
          stopped++;
        },
        addEventListener(type, fn) {
          frameCallbacks.set(track, fn);
        },
      };
      tracks.push(track);
      const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
      if (delayPermission) await new Promise((r) => (permit = r));
      return stream;
    },
  };
  const old = new Map();
  function global(name, value) {
    old.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true });
  }
  global('navigator', { mediaDevices: media });
  global('document', {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        toBlob(fn) {
          blob = fn;
        },
        getContext() {
          return {
            drawImage() {},
            getImageData(_x, _y, w, h) {
              return { data: new Uint8ClampedArray(w * h * 4).fill(pixelValue) };
            },
          };
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  global('requestAnimationFrame', (fn) => {
    callback = fn;
    return 1;
  });
  global('cancelAnimationFrame', () => {
    canceled++;
    callback = null;
  });
  t.mock.method(performance, 'now', () => now);
  const hub = new CaptureHub(video, () => ended++);
  t.after(() => {
    hub.stop();
    for (const [name, descriptor] of old)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  return {
    hub,
    video,
    canvases,
    pixels(value) {
      pixelValue = value;
    },
    emit(time, decoded) {
      now = time;
      video.currentTime = time / 1000;
      video.decoded = decoded;
      const fn = callback;
      callback = null;
      fn?.(time, { mediaTime: video.currentTime, presentedFrames: decoded });
    },
    clock(time) {
      now = time;
    },
    permit: () => permit(),
    play: () => play(),
    blob: () => blob(new Blob(['jpeg'])),
    blobCallback: () => blob,
    end: () => frameCallbacks.get(tracks.at(-1))(),
    status: () => ({ requested, stopped, canceled, ended }),
  };
}

test('CA-H1/H2: two consumers and JPEG share one camera, ID/time and full-frame geometry', async (t) => {
  const f = setup(t),
    seen = [];
  f.hub.subscribe((frame) => seen.push(frame.pixels(32, 24)));
  f.hub.subscribe((frame) => seen.push(frame.pixels(320, 240)));
  await f.hub.start(7);
  f.emit(200, 1);
  assert.equal(f.status().requested, 1);
  assert.equal(seen[0].stamp, seen[1].stamp);
  assert.equal(seen[0].stamp.sessionGeneration, 7);
  assert.deepEqual(seen[1].transform, { width: 320, height: 240, scaleX: 0.5, scaleY: 0.5 });
  const jpeg = f.hub.jpeg();
  f.emit(400, 2);
  f.blob();
  assert.equal((await jpeg).stamp, seen[0].stamp); // Encoding never steals a later frame's ID.
  assert.equal(f.hub.current.frameId, 2);
});

for (const variant of [{ fallback: false }, { fallback: true }, { fallback: true, quality: false }])
  test(`CA-H1: new source frames only, no repeated observation (${JSON.stringify(variant)})`, async (t) => {
    const f = setup(t, variant);
    let count = 0;
    f.hub.subscribe(() => count++);
    await f.hub.start(1);
    f.emit(200, 1);
    f.emit(200, 1);
    if (variant.quality !== false) f.emit(400, 1);
    f.emit(600, 2);
    assert.equal(count, 2);
    f.video.paused = true;
    f.emit(800, 3);
    assert.equal(count, 2);
    f.hub.stop();
    assert.ok(f.status().canceled > 0);
  });

test('CA-H2: retained frame handles and frozen old frames cannot produce new evidence', async (t) => {
  const f = setup(t);
  let old;
  f.hub.subscribe((frame) => (old ??= frame));
  await f.hub.start(1);
  f.emit(200, 1);
  f.emit(400, 2);
  assert.throws(() => old.pixels(32, 24), /expirado/);
  f.clock(3401);
  assert.equal(f.hub.fresh, false);
  await assert.rejects(f.hub.jpeg(), { code: 'capture-stale' });
});

test('CA-H9: stopping before delayed permission resolves releases its late stream', async (t) => {
  const f = setup(t, { delayPermission: true });
  const start = f.hub.start(1);
  f.hub.stop();
  f.permit();
  await start;
  assert.equal(f.status().stopped, 1);
  assert.equal(f.video.srcObject, null);
  assert.equal(f.hub.current, null);
});

test('CA-H9: stop during play or JPEG clears resources and rejects late capture', async (t) => {
  const f = setup(t, { delayPlay: true });
  const start = f.hub.start(1);
  await Promise.resolve();
  f.hub.stop();
  f.play();
  await start;
  assert.equal(f.video.srcObject, null);
  const restart = f.hub.start(2);
  await Promise.resolve();
  f.play();
  await restart;
  f.emit(200, 1);
  const jpeg = f.hub.jpeg();
  f.hub.stop();
  f.blob();
  await assert.rejects(jpeg, /cancelada/);
  assert.equal(
    f.canvases.every((c) => c.width === 0 && c.height === 0),
    true,
  );
});

test('CA-H9: track ended stops capture; a stop inside a subscriber halts delivery to others', async (t) => {
  const f = setup(t);
  let delivered = 0;
  const unsubscribe = f.hub.subscribe(() => f.hub.stop());
  f.hub.subscribe(() => delivered++);
  await f.hub.start(1);
  f.emit(200, 1);
  assert.equal(delivered, 0);
  unsubscribe();
  await f.hub.start(2);
  f.end();
  assert.equal(f.status().ended, 1);
  assert.equal(f.video.srcObject, null);
});

test('CA-H2: SnapshotCamera needs new frames after a freeze before declaring stable again', async (t) => {
  const f = setup(t),
    camera = new SnapshotCamera(
      f.video,
      () => {},
      () => {},
    );
  t.after(() => camera.stop());
  await camera.start(1);
  f.emit(200, 1);
  assert.equal(camera.ready, true);
  f.emit(1600, 2);
  assert.equal(camera.stable, true);
  f.clock(4601);
  assert.equal(camera.stable, false);
  assert.equal(camera.ready, false);
  f.emit(4800, 3);
  assert.equal(camera.stable, false);
  f.emit(6000, 4);
  assert.equal(camera.stable, true);
});

test('CA-F1/L1/H2: first frame and continuous motion can produce snapshots without settling', async (t) => {
  const f = setup(t),
    camera = new SnapshotCamera(
      f.video,
      () => {},
      () => {},
    );
  t.after(() => camera.stop());
  await camera.start(1);
  assert.equal(camera.ready, false);
  for (let frame = 1; frame <= 10; frame++) {
    f.pixels(frame % 2 ? 40 : 160);
    f.emit(frame * 200, frame);
    assert.equal(camera.ready, true);
    assert.equal(camera.stable, false);
    const capture = camera.capture();
    f.blob();
    const result = await capture;
    assert.equal(result.frameId, frame);
    assert.equal(result.capturedAtMs, frame * 200);
  }
});

test('CA-H2/L3: JPEG retains its original timestamp and cannot become fresh because the camera advanced', async (t) => {
  const f = setup(t);
  await f.hub.start(1);
  f.emit(200, 1);
  const pending = f.hub.jpeg();
  f.emit(CONFIG.capture.maxFrameAgeMs + 201, 2); // The camera is fresh; the encoded image is not.
  assert.equal(f.hub.fresh, true);
  f.blob();
  await assert.rejects(pending, { code: 'capture-stale' });
  assert.equal(f.hub.diagnostics().jpeg.stale, 1);
  assert.equal(f.hub.diagnostics().jpeg.completed, 0);
  const fresh = f.hub.jpeg();
  f.blob();
  assert.equal((await fresh).stamp.frameId, 2);
});

test('CA-H9/D4: hung JPEG ends at its deadline; late callback cannot resolve a newer preparation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t);
  await f.hub.start(1);
  f.emit(200, 1);
  const pending = f.hub.jpeg();
  const oldCallback = f.blobCallback();
  const rejected = assert.rejects(pending, { code: 'capture-timeout' });
  t.mock.timers.tick(CONFIG.capture.jpegTimeoutMs);
  await rejected;
  assert.equal(f.hub.diagnostics().jpeg.inFlight, 0);
  assert.equal(f.hub.diagnostics().jpeg.timeouts, 1);
  f.emit(500, 2);
  const fresh = f.hub.jpeg();
  oldCallback(new Blob(['old pixels']));
  assert.equal(f.hub.diagnostics().jpeg.inFlight, 1);
  f.blob();
  assert.equal((await fresh).stamp.frameId, 2);
  assert.equal(f.hub.diagnostics().jpeg.completed, 1);
});

test('CA-H9: stop settles preparation before its callback and previous cancellation does not enter a new session', async (t) => {
  const f = setup(t);
  await f.hub.start(1);
  f.emit(200, 1);
  const pending = f.hub.jpeg();
  const oldCallback = f.blobCallback();
  const rejected = assert.rejects(pending, { code: 'capture-canceled' });
  f.hub.stop();
  await f.hub.start(2);
  await rejected;
  assert.deepEqual(f.hub.diagnostics().jpeg, {
    requested: 0,
    completed: 0,
    canceled: 0,
    timeouts: 0,
    stale: 0,
    failed: 0,
    inFlight: 0,
  });
  f.emit(400, 2);
  const fresh = f.hub.jpeg();
  oldCallback(new Blob(['old pixels']));
  assert.equal(f.hub.diagnostics().jpeg.inFlight, 1);
  f.blob();
  assert.equal((await fresh).stamp.sessionGeneration, 2);
});

test('CA-H1/H9: no concurrent JPEG queue and synchronous encoder errors settle without leaking data', async (t) => {
  const f = setup(t);
  await f.hub.start(1);
  f.emit(200, 1);
  const pending = f.hub.jpeg();
  await assert.rejects(f.hub.jpeg(), { code: 'capture-busy' });
  f.blob();
  await pending;
  f.canvases[0].toBlob = () => {
    throw new Error('private browser exception');
  };
  await assert.rejects(
    f.hub.jpeg(),
    (error) => error.code === 'capture-unavailable' && !error.message.includes('private'),
  );
  assert.equal(f.hub.diagnostics().jpeg.inFlight, 0);
  assert.equal(f.hub.diagnostics().jpeg.failed, 1);
  assert.doesNotMatch(JSON.stringify(f.hub.diagnostics()), /pixels|private|blob|label/i);
});

test('CA-H1/H6: a permanent zero quality counter uses advancing media time without freezing after the first frame', async (t) => {
  const f = setup(t, { fallback: true });
  await f.hub.start(1);
  for (let frame = 1; frame <= 20; frame++) f.emit(frame * 200, 0);
  assert.equal(f.hub.diagnostics().frames, 20);
  assert.equal(f.hub.diagnostics().frameBasis, 'media-time');
  assert.equal(f.hub.fresh, true);
  f.emit(4000, 0);
  assert.equal(f.hub.diagnostics().frames, 20);
  f.video.paused = true;
  f.emit(4200, 0);
  assert.equal(f.hub.diagnostics().frames, 20);
  f.hub.stop();
  assert.equal(f.hub.diagnostics().frameBasis, 'waiting');
});
