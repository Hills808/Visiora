import test from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl =
  process.env.VISIORA_CONTINUOUS_MODULE ??
  new URL('../dist/perception/continuous.js', import.meta.url).href;
const { ContinuousPerception } = await import(moduleUrl);
const { CONFIG } = await import(new URL('../config.js', moduleUrl));
const flush = () => new Promise(setImmediate);
const viewA = Array.from({ length: 24 }, (_, i) => i % 2);
const viewB = viewA.map((value) => 1 - value);
const label = 'private-reference-label';

function fixture(t, simulated = true) {
  let now = 100,
    copies = 0,
    disposed = 0,
    unavailable = 0;
  const initializations = [],
    jobs = [];
  const source = { id: 'fixture-local', revision: 'fixture-1', simulated };
  const adapter = {
    source,
    input: { width: 32, height: 24 },
    analyze(frame, signal) {
      return new Promise((resolve, reject) => {
        const job = {
          frame,
          signal,
          settled: false,
          succeed(
            observations = [
              {
                label,
                score: 0.9,
                verified: true,
                box: { x: 0.2, y: 0.2, width: 0.2, height: 0.4 },
              },
            ],
          ) {
            if (job.settled) return;
            job.settled = true;
            resolve({
              schemaVersion: 1,
              stamp: { ...frame.stamp },
              transform: { ...frame.transform },
              source: { ...source },
              observations,
            });
          },
          fail() {
            if (job.settled) return;
            job.settled = true;
            reject(new Error('private runtime failure'));
          },
        };
        jobs.push(job);
      });
    },
    dispose() {
      disposed++;
    },
    diagnostics() {
      return { provider: 'wasm', runtimeErrors: 0 };
    },
  };
  const factory = (signal, status) =>
    new Promise((resolve, reject) => {
      initializations.push({ signal, status, resolve, reject });
    });
  const observer = new ContinuousPerception(
    factory,
    () => now,
    () => unavailable++,
  );
  function offer(id, signature = viewA, generation = 1) {
    const stamp = {
      schemaVersion: 1,
      sessionGeneration: generation,
      frameId: id,
      capturedAtMs: now,
      width: 640,
      height: 480,
      orientation: 'browser-upright',
      mirrored: false,
    };
    observer.offer(
      {
        stamp,
        pixels(width, height) {
          copies++;
          return {
            stamp,
            transform: {
              width,
              height,
              scaleX: width / stamp.width,
              scaleY: height / stamp.height,
            },
            rgba: new ArrayBuffer(width * height * 4),
          };
        },
      },
      signature,
    );
  }
  async function ready() {
    initializations.at(-1).resolve(adapter);
    await flush();
  }
  async function deliver(id, time, signature = viewA) {
    now = time;
    offer(id, signature);
    jobs.at(-1).succeed();
    await flush();
  }
  t.after(async () => {
    observer.stop();
    jobs.forEach((job) => job.succeed());
    initializations.forEach((init) => init.reject(new Error('canceled fixture')));
    await flush();
  });
  return {
    observer,
    adapter,
    initializations,
    jobs,
    offer,
    ready,
    deliver,
    setTime(value) {
      now = value;
    },
    status() {
      return { copies, disposed, unavailable };
    },
  };
}

test('CA-H1/H9: disabled observer never loads models or copies frames', async (t) => {
  const f = fixture(t);
  f.observer.start(1);
  f.offer(1);
  assert.equal(f.observer.enabledNow, false);
  assert.equal(f.observer.diagnostics().state, 'disabled');
  assert.deepEqual(f.observer.snapshot(), []);
  assert.equal(f.initializations.length, 0);
  assert.equal(f.status().copies, 0);
  f.observer.setEnabled(true);
  assert.equal(f.initializations.length, 1);
  assert.equal(f.observer.diagnostics().state, 'loading');
  await f.ready();
  assert.equal(f.observer.diagnostics().state, 'simulated');
});

test('CA-H1/H9: async initialization does not block offers and cancellation disposes late readiness', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  assert.equal(f.observer.diagnostics().state, 'waiting');
  assert.equal(f.initializations.length, 0);
  assert.equal(f.observer.start(1), undefined);
  for (let id = 1; id <= 30; id++) f.offer(id);
  assert.equal(f.status().copies, 0);
  assert.equal(f.jobs.length, 0);
  assert.equal(f.observer.diagnostics().pendingFrames, 0);
  f.observer.stop();
  assert.equal(f.initializations[0].signal.aborted, true);
  f.initializations[0].status('late private status');
  await f.ready();
  assert.equal(f.status().disposed, 1);
  assert.equal(f.status().unavailable, 0);
  assert.equal(f.observer.diagnostics().state, 'stopped');
  assert.doesNotMatch(f.observer.feedback, /private status/);
  assert.deepEqual(f.observer.snapshot(), []);
});

test('CA-H1: ready observer processes latest offered frames without a queue during other work', async (t) => {
  const f = fixture(t, false);
  let networkCalls = 0;
  t.mock.method(globalThis, 'fetch', () => {
    networkCalls++;
    throw new Error('No network is permitted');
  });
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  assert.equal(f.observer.diagnostics().state, 'active');
  f.offer(1);
  for (let id = 2; id <= 40; id++) f.offer(id);
  assert.equal(f.jobs.length, 1);
  assert.equal(f.status().copies, 1);
  assert.equal(f.observer.diagnostics().busySkipped, 39);
  assert.equal(f.observer.diagnostics().pendingFrames, 0);
  f.jobs[0].succeed();
  await flush();
  assert.equal(f.jobs.length, 1);
  await f.deliver(41, 200);
  assert.equal(f.jobs[1].frame.stamp.frameId, 41);
  assert.equal(networkCalls, 0);
  assert.equal(
    f.observer.diagnostics().outputGate,
    'observation-only-no-local-speech-or-paid-triggers',
  );
});

test('CA-H2: dispatch revision survives broad A to B to A; late positions never return', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  f.offer(1, viewA);
  f.setTime(200);
  f.offer(2, viewB);
  f.setTime(300);
  f.offer(3, viewA);
  assert.equal(f.jobs.length, 1);
  assert.equal(f.observer.diagnostics().memory.viewInvalidations, 2);
  f.jobs[0].succeed();
  await flush();
  assert.equal(f.observer.diagnostics().accepted, 1);
  assert.equal(f.observer.diagnostics().memory.rejectedFrames, 1);
  assert.deepEqual(f.observer.snapshot(), []);
  assert.equal(f.observer.diagnostics().lastResultAgeMs, null);
  await f.deliver(4, 400, viewA);
  assert.equal(f.observer.snapshot().length, 1);
  assert.equal(f.observer.snapshot()[0].firstObservedAt, 400);
  assert.equal(f.observer.snapshot()[0].state, 'candidate');
});

test('CA-H2: broad view change retires confirmed positions even when the former image returns', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  for (let id = 1; id <= CONFIG.continuous.minHits; id++) await f.deliver(id, 100 * id);
  const previous = f.observer.snapshot()[0];
  assert.equal(previous.state, 'confirmed');
  f.setTime(500);
  f.offer(10, viewB);
  assert.deepEqual(f.observer.snapshot(), []);
  f.setTime(600);
  f.offer(11, viewA);
  f.jobs.at(-1).succeed();
  await flush();
  assert.deepEqual(f.observer.snapshot(), []);
  await f.deliver(12, 700);
  assert.notEqual(f.observer.snapshot()[0].id, previous.id);
  assert.equal(f.observer.snapshot()[0].state, 'candidate');
});

test('CA-H2/H9: rotation invalidates pending inference and suppresses offers until the last settling deadline', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  await f.deliver(1, 100);
  f.setTime(200);
  f.offer(2);
  f.setTime(250);
  f.observer.rotated();
  assert.deepEqual(f.observer.snapshot(), []);
  assert.match(f.observer.feedback, /giro/);
  f.setTime(300);
  f.observer.rotated();
  assert.equal(f.observer.diagnostics().memory.viewInvalidations, 1);
  f.jobs.at(-1).succeed();
  await flush();
  assert.deepEqual(f.observer.snapshot(), []);
  const copied = f.status().copies;
  f.setTime(300 + CONFIG.motion.settleMs - 1);
  f.offer(3);
  assert.equal(f.status().copies, copied);
  f.setTime(300 + CONFIG.motion.settleMs);
  assert.deepEqual(f.observer.snapshot(), []);
  f.offer(4);
  f.jobs.at(-1).succeed();
  await flush();
  assert.equal(f.status().copies, copied + 1);
  assert.equal(f.observer.snapshot()[0].lastObservedAt, 300 + CONFIG.motion.settleMs);
  assert.equal(f.observer.snapshot()[0].state, 'candidate');
});

test('CA-H9: stop aborts in-flight work and late worker completion cannot repopulate memory', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  f.offer(1);
  f.observer.stop();
  f.observer.stop();
  assert.equal(f.jobs[0].signal.aborted, true);
  assert.equal(f.status().disposed, 1);
  f.jobs[0].succeed();
  await flush();
  f.offer(2);
  assert.equal(f.status().copies, 1);
  assert.deepEqual(f.observer.snapshot(), []);
  assert.equal(f.observer.diagnostics().accepted, 0);
  assert.equal(f.observer.diagnostics().inFlight, 0);
});

test('CA-H9: disabling during initialization cancels load; enabling again ignores the old promise', async (t) => {
  const f = fixture(t);
  f.observer.start(1);
  f.observer.setEnabled(true);
  const oldInitialization = f.initializations[0];
  f.observer.setEnabled(false);
  assert.equal(oldInitialization.signal.aborted, true);
  assert.equal(f.observer.diagnostics().state, 'disabled');
  f.observer.setEnabled(true);
  assert.equal(f.initializations.length, 2);
  oldInitialization.resolve(f.adapter);
  await flush();
  assert.equal(f.status().disposed, 1);
  assert.equal(f.observer.diagnostics().state, 'loading');
  await f.ready();
  await f.deliver(1, 100);
  assert.equal(f.observer.snapshot().length, 1);
});

test('CA-H9: startup failure exposes a capability notice once and does not retry on frames', async (t) => {
  const f = fixture(t);
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  f.observer.setEnabled(true);
  f.observer.start(1);
  f.initializations[0].reject(new Error('private token and provider details'));
  await flush();
  for (let id = 1; id <= 20; id++) f.offer(id);
  assert.equal(f.status().unavailable, 1);
  assert.equal(f.initializations.length, 1);
  assert.equal(f.observer.diagnostics().state, 'error');
  assert.match(f.observer.feedback, /Não foi possível preparar/);
  assert.doesNotMatch(JSON.stringify(warnings), /private token|provider details/);
  assert.deepEqual(f.observer.snapshot(), []);
});

test('CA-H9: runtime failure withdraws local positions and deduplicates capability notice', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  await f.deliver(1, 100);
  f.setTime(200);
  f.offer(2);
  f.jobs.at(-1).fail();
  await flush();
  assert.equal(f.observer.diagnostics().state, 'error');
  assert.deepEqual(f.observer.snapshot(), []);
  assert.match(f.observer.feedback, /Confira também o estado da análise Luna/);
  assert.doesNotMatch(
    f.observer.feedback,
    /continua/,
    'local failure cannot claim a paused Luna is running',
  );
  for (let id = 3; id <= 20; id++) f.offer(id);
  assert.equal(f.status().unavailable, 1);
  assert.equal(f.status().disposed, 1);
  assert.equal(f.initializations.length, 1);
});

test('CA-H2/H9: only explicit snapshots expose observations; exported counts contain no labels, boxes or pixels', async (t) => {
  const f = fixture(t);
  f.observer.setEnabled(true);
  f.observer.start(1);
  await f.ready();
  await f.deliver(1, 100);
  assert.equal(f.observer.snapshot()[0].label, label);
  const data = f.observer.diagnostics();
  assert.equal(data.memory.candidateTracks, 1);
  assert.equal(data.memory.freshTracks, 1);
  assert.ok(
    Object.values(data.memory).every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(data),
    /private-reference|box|label|rgba|signature|capturedAtMs|local-1/,
  );
  f.setTime(100 + CONFIG.continuous.maxAgeMs + 1);
  assert.deepEqual(f.observer.snapshot(), []);
  assert.match(f.observer.feedback, /Sem observação local recente/);
});
