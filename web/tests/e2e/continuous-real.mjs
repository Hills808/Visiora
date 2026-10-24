import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser } from './helpers.mjs';

// No .env: only an in-memory ledger and artificial gateway evidence. Detector is real.
const cpu = process.argv.includes('--cpu');
const video = path.resolve(process.env.VISIORA_QA_VIDEO || 'artifacts/vision/dog.y4m');
await access(video);
const evidence = {
  scene: { label: 'sala de teste', support: ['fixture'] },
  observations: [
    {
      id: 'fixture',
      kind: 'object',
      label: 'cadeira',
      article: 'uma',
      uncertain: false,
      box: { x: 0.1, y: 0.1, width: 0.2, height: 0.4 },
    },
  ],
  relations: [],
  limitations: [],
};
let clockOffset = 0,
  calls = 0,
  holdApi = false,
  releaseApi;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' });
const budget = new Budget(':memory:', config, () => Date.now() + clockOffset);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    if (holdApi)
      await new Promise((resolve) => {
        releaseApi = resolve;
      });
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const report = {
  schemaVersion: 1,
  passed: false,
  cpuRequested: cpu,
  scope:
    'Real YOLOX Nano/Tiny/S, loopback fake API, video camera and controlled voice. No paid API, physical camera, accuracy, identity, walking or human acceptance claim.',
  fixture: process.env.VISIORA_QA_VIDEO ? 'external-qa-video' : 'static-public-dog',
  limitation:
    'Static image video measures transport/inference latency only; temporal video without independent annotation does not establish tracking quality.',
  cases: [],
  errors: [],
  requestsOutsideLoopback: [],
};
let browser;
const gates = new Set();
const summary = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (fraction) =>
    sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
  return {
    samples: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1) ?? null,
  };
};

async function open() {
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  let releaseGate;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });
  gates.add(releaseGate);
  let scriptRequested = false;
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      report.requestsOutsideLoopback.push(url.origin);
      await route.abort();
      return;
    }
    if (url.pathname === '/vision/worker.js') {
      scriptRequested = true;
      await gate;
    }
    // Exercise product consent revocation without connecting a real cloud provider.
    if (url.pathname === '/api/vision/status') {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, provider: 'luna' } });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.addInitScript(() => {
    window.__cameraRequests = 0;
    window.__localWorkers = 0;
    window.__localTerminations = 0;
    window.__readyAt = null;
    window.__apiAt = [];
    window.__results = [];
    window.__sentFrames = [];
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (...args) => {
      window.__cameraRequests++;
      return getMedia(...args);
    };
    const fetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (String(url).endsWith('/api/vision/analyze')) window.__apiAt.push(performance.now());
      return fetch(url, options);
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.qaLocal = new URL(String(url), location.href).pathname === '/vision/worker.js';
        if (!this.qaLocal) return;
        window.__localWorkers++;
        this.addEventListener('message', (event) => {
          const data = event.data;
          if (data?.type === 'ready') window.__readyAt = performance.now();
          if (data?.type === 'result') {
            const now = performance.now();
            window.__results.push({
              frameId: data.frameId,
              capturedAtMs: data.capturedAtMs,
              receivedAtMs: now,
              captureToResultMs: now - data.capturedAtMs,
              provider: data.provider,
              inferenceMs: data.latencyMs,
            });
            if (window.__results.length > 300) window.__results.shift();
          }
        });
      }
      postMessage(value, transfer) {
        if (this.qaLocal && value?.type === 'frame') {
          window.__sentFrames.push({ frameId: value.frameId, capturedAtMs: value.capturedAtMs });
          if (window.__sentFrames.length > 300) window.__sentFrames.shift();
        }
        return super.postMessage(value, transfer);
      }
      terminate() {
        if (this.qaLocal) window.__localTerminations++;
        return super.terminate();
      }
    };
    let generation = 0;
    let active = null;
    window.__holdVoice = false;
    window.__voiceActive = false;
    const voice = {
      name: 'Controlled local test voice',
      lang: 'pt-BR',
      voiceURI: 'test-local',
      localService: true,
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [voice],
        addEventListener() {},
        cancel() {
          generation++;
          active = null;
          window.__voiceActive = false;
        },
        speak(utterance) {
          active = utterance;
          const token = generation;
          queueMicrotask(() => {
            if (token !== generation || active !== utterance) return;
            window.__voiceActive = true;
            utterance.onstart?.();
            window.__endVoice = () => {
              if (token !== generation || active !== utterance) return;
              active = null;
              window.__voiceActive = false;
              utterance.onend?.();
            };
            if (!window.__holdVoice) window.__endVoice();
          });
        },
      },
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
  });
  await page.goto(base);
  await page.evaluate(async () => {
    const { OnlineSession } = await import('/vision/online-session.js');
    const start = OnlineSession.prototype.start;
    OnlineSession.prototype.start = function (...args) {
      window.__online = this;
      return start.apply(this, args);
    };
  });
  await page.selectOption('#perception-provider', 'luna');
  await page.waitForFunction(() =>
    document.querySelector('#luna-config').textContent.includes('Simulador'),
  );
  await page.check('#cloud-consent');
  await page.click('#settings-open');
  await page.locator('#local-observer-settings > summary').click();
  assert.equal(await page.isChecked('#local-observer'), false);
  await page.check('#local-observer');
  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
  clockOffset += 60000;
  await page.click('#start');
  await page.waitForFunction(() => window.__online.diagnostics().local.state === 'loading');
  return {
    page,
    context,
    requested: () => scriptRequested,
    release: () => {
      releaseGate();
      gates.delete(releaseGate);
    },
  };
}

async function localStats(page) {
  return page.evaluate(() => ({
    now: performance.now(),
    local: window.__online.diagnostics().local,
    capture: window.__online.diagnostics().capture,
    pending: window.__online.diagnostics().pending,
    cameraRequests: window.__cameraRequests,
  }));
}
async function setLocal(page, enabled) {
  await page.click('#settings-open');
  await page.locator('#local-observer-settings').evaluate((element) => {
    element.open = true;
  });
  await page.setChecked('#local-observer', enabled);
  await page.getByRole('button', { name: 'Fechar ajustes' }).click();
}

try {
  browser = await launchTestBrowser(video, cpu ? ['--disable-gpu'] : []);
  report.browser = browser.version();
  const main = await open();
  await main.page.waitForFunction(() => window.__apiAt.length > 0);
  assert.equal((await localStats(main.page)).local.state, 'loading');
  assert.equal(await main.page.evaluate(() => window.__readyAt), null);
  main.release();
  report.cases.push(
    'CA-H1: initial Luna dispatch occurs while real local worker initialization is gated; opt-in defaults off',
  );
  await main.page.waitForFunction(
    () => window.__online.diagnostics().local.accepted >= 3,
    undefined,
    { timeout: 180000 },
  );
  const ready = await localStats(main.page);
  assert.equal(ready.cameraRequests, 1);
  assert.equal(ready.local.state, 'active');
  assert.equal(ready.local.detector.source.simulated, false);
  assert.ok(['wasm', 'webgpu'].includes(ready.local.detector.provider));
  if (cpu) assert.equal(ready.local.detector.provider, 'wasm');
  assert.equal(ready.local.pendingFrames, 0);
  report.initialization = await main.page.evaluate(() => ({
    firstLunaAtMs: window.__apiAt[0],
    modelReadyAtMs: window.__readyAt,
  }));
  assert.ok(report.initialization.firstLunaAtMs < report.initialization.modelReadyAtMs);

  await main.page.waitForFunction(
    () => !window.__online.diagnostics().pending && !window.__voiceActive,
  );
  clockOffset += 20000;
  await main.page.evaluate(() => {
    window.__holdVoice = true;
  });
  await main.page.click('[data-ask=describe]');
  await main.page.waitForFunction(() => window.__voiceActive);
  const voiceBefore = await localStats(main.page);
  await main.page.waitForFunction(
    (count) => window.__online.diagnostics().local.accepted >= count + 4,
    voiceBefore.local.accepted,
    { timeout: 25000 },
  );
  const voiceDuring = await localStats(main.page);
  assert.equal(await main.page.evaluate(() => window.__voiceActive), true);
  assert.equal(voiceDuring.local.pendingFrames, 0);
  report.voiceHold = {
    accepted: voiceDuring.local.accepted - voiceBefore.local.accepted,
    elapsedMs: voiceDuring.now - voiceBefore.now,
  };
  await main.page.evaluate(() => {
    window.__holdVoice = false;
    window.__endVoice();
  });
  report.cases.push(
    'CA-H1: real local inference continues for at least four accepted frames while controlled speech remains active',
  );

  clockOffset += 20000;
  holdApi = true;
  const previousCalls = calls;
  await main.page.click('[data-ask=describe]');
  await main.page.waitForFunction(() => window.__online.diagnostics().pending);
  const before = await localStats(main.page);
  await main.page.waitForFunction((start) => performance.now() - start >= 12000, before.now, {
    timeout: 12500,
    polling: 50,
  });
  const during = await localStats(main.page);
  assert.equal(during.pending, true);
  assert.equal(calls, previousCalls + 1);
  assert.ok(during.local.accepted - before.local.accepted >= 4);
  assert.equal(during.local.pendingFrames, 0);
  assert.equal(during.capture.pendingFrames, 0);
  assert.equal(during.cameraRequests, 1);
  report.apiHold = {
    elapsedMs: during.now - before.now,
    accepted: during.local.accepted - before.local.accepted,
    busySkipped: during.local.busySkipped,
    pendingFrames: during.local.pendingFrames,
    cameraRequests: during.cameraRequests,
  };
  holdApi = false;
  releaseApi?.();
  report.cases.push(
    'CA-H1/H2: one camera, zero local frame queue and at least four accepted real detector frames during 12 s pending fake API',
  );
  const measurements = await main.page.evaluate(() => ({
    results: window.__results,
    sent: window.__sentFrames,
    detector: window.__online.diagnostics().local.detector,
    local: window.__online.diagnostics().local,
  }));
  assert.ok(
    measurements.sent.every(
      (item, index, all) =>
        !index ||
        (item.frameId > all[index - 1].frameId && item.capturedAtMs > all[index - 1].capturedAtMs),
    ),
  );
  report.metrics = {
    provider: measurements.detector.provider,
    initializationMs: summary(measurements.detector.initializationMs),
    inferenceMs: summary(measurements.detector.inferenceMs),
    inferenceBasis:
      'aggregate; inferenceByProvider groups worker results by their reported backend',
    inferenceByProvider: Object.fromEntries(
      ['webgpu', 'wasm'].map((provider) => [
        provider,
        summary(
          measurements.results
            .filter((item) => item.provider === provider)
            .map((item) => item.inferenceMs),
        ),
      ]),
    ),
    preparationMs: summary(measurements.detector.preparationMs),
    captureToResultMs: summary(measurements.results.map((item) => item.captureToResultMs)),
    acceptedCaptureToResultMs: summary(measurements.local.latencyMs),
    dispatchFrameDelta: summary(
      measurements.sent
        .slice(1)
        .map((item, index) => item.frameId - measurements.sent[index].frameId),
    ),
    dispatchCaptureDeltaMs: summary(
      measurements.sent
        .slice(1)
        .map((item, index) => item.capturedAtMs - measurements.sent[index].capturedAtMs),
    ),
    accepted: measurements.local.accepted,
    stale: measurements.local.stale,
    errors: measurements.local.errors,
    confirmedTracks: measurements.local.memory.confirmedTracks,
  };
  await main.page.click('#start');
  await main.context.close();

  // Delay the actual worker script for deterministic lifecycle cancellation, never fake its output.
  for (const action of ['disable', 'stop', 'consent']) {
    const scenario = await open();
    assert.equal((await localStats(scenario.page)).local.state, 'loading');
    if (action === 'disable') await setLocal(scenario.page, false);
    else if (action === 'stop') await scenario.page.click('#start');
    else await scenario.page.uncheck('#cloud-consent');
    await scenario.page.waitForFunction(() => window.__localTerminations >= 1);
    scenario.release();
    const state = await localStats(scenario.page);
    assert.equal(state.local.accepted, 0);
    assert.equal(state.local.state, action === 'disable' ? 'disabled' : 'stopped');
    assert.equal(await scenario.page.evaluate(() => window.__readyAt), null);
    if (action === 'disable') {
      const frames = state.capture.frames;
      await scenario.page.waitForFunction(
        (n) => window.__online.diagnostics().capture.frames > n + 2,
        frames,
      );
    } else
      assert.equal(
        await scenario.page.locator('#camera').evaluate((element) => element.srcObject === null),
        true,
      );
    report.cases.push(`CA-H9: ${action} cancels initialization and prevents late ready/results`);
    await scenario.context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requestsOutsideLoopback, []);
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  releaseApi?.();
  for (const release of gates) release();
  await browser?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.apiCalls = calls;
  const output = `artifacts/e2e-continuous-real${cpu ? '-cpu' : ''}`;
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/result.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
