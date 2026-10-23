import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';

const evidence = {
  scene: { label: 'sala de teste', support: ['c'] },
  observations: [
    {
      id: 'c',
      kind: 'object',
      label: 'cadeira',
      article: 'uma',
      uncertain: false,
      box: { x: 0.1, y: 0.1, width: 0.2, height: 0.5 },
    },
  ],
  relations: [],
  limitations: [],
};
let now = Date.now(),
  calls = 0,
  hold = true,
  release;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' }),
  budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  provider: async () => {
    calls++;
    if (hold) await new Promise((resolve) => (release = resolve));
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
const report = {
  scope:
    'Loopback HTTP, real Worker/message transfer and synthetic video/voice/evidence. No model inference or paid API.',
  browser: browser.version(),
  cases: [],
  errors: [],
  requestsOutsideLoopback: [],
};
const app = (await readFile('dist/app.js', 'utf8')).replace(
  './vision/online-session.js',
  '/qa/local-session.mjs',
);
async function open({ fallback = false, consent = false } = {}) {
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      report.requestsOutsideLoopback.push(url.origin);
      await route.abort();
      return;
    }
    if (url.pathname === '/app.js') {
      await route.fulfill({ contentType: 'text/javascript', body: app });
      return;
    }
    if (['/qa/local-session.mjs', '/qa/local-worker.mjs'].includes(url.pathname)) {
      await route.fulfill({
        contentType: 'text/javascript',
        body: await readFile('tests/fixtures/' + path.basename(url.pathname), 'utf8'),
      });
      return;
    }
    if (consent && url.pathname === '/api/vision/status') {
      const response = await route.fetch(),
        body = await response.json();
      await route.fulfill({ response, json: { ...body, provider: 'luna' } });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await installTestVoice(page);
  await page.addInitScript(
    ({ fallback }) => {
      window.__permissions = 0;
      window.__workers = [];
      window.__terminated = 0;
      window.__localStamps = [];
      const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (...args) => {
        window.__permissions++;
        return getMedia(...args);
      };
      if (fallback)
        Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
          value: undefined,
        });
      const imageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        const image = imageData.apply(this, args);
        if (this.canvas.width === 32 && this.canvas.height === 24) image.data.fill(128);
        return image;
      };
      const speak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (utterance) => {
        const end = utterance.onend;
        utterance.onend = () => {
          if (window.__holdVoice) window.__releaseVoice = end;
          else end?.();
        };
        speak(utterance);
      };
    },
    { fallback },
  );
  await page.goto(base);
  await page.waitForFunction(() =>
    document.querySelector('#luna-config').textContent.includes('Simulador'),
  );
  if (consent) await page.check('#cloud-consent');
  return { page, context };
}
try {
  const { page, context } = await open();
  await page.click('#start');
  await page.waitForFunction(
    () => window.__online.diagnostics().pending && window.__online.diagnostics().local.accepted > 0,
  );
  const before = await page.evaluate(() => ({
    now: performance.now(),
    stats: window.__online.diagnostics(),
  }));
  await page.waitForFunction((start) => performance.now() - start >= 12000, before.now, {
    timeout: 15000,
  });
  const during = await page.evaluate(() => ({
    now: performance.now(),
    stats: window.__online.diagnostics(),
    permissions: window.__permissions,
    stamps: window.__localStamps.map((s) => ({
      id: s.frameId,
      time: s.capturedAtMs,
      generation: s.sessionGeneration,
    })),
  }));
  assert.equal(during.stats.pending, true);
  assert.ok(during.stats.local.accepted - before.stats.local.accepted >= 8);
  assert.equal(during.stats.local.pendingFrames, 0);
  assert.ok(during.stats.local.busySkipped > 0);
  assert.equal(during.permissions, 1);
  assert.ok(
    during.stamps.every((s, i, all) => !i || (s.id > all[i - 1].id && s.time > all[i - 1].time)),
  );
  assert.equal(calls, 1);
  report.concurrent = {
    pendingMs: during.now - before.now,
    acceptedDuringWait: during.stats.local.accepted - before.stats.local.accepted,
    busySkipped: during.stats.local.busySkipped,
    pendingFrames: 0,
    cameraRequests: during.permissions,
  };
  report.cases.push(
    'CA-H1: one stream and local worker keeps processing fresh frames during 12 s of pending API, with zero queued frames',
  );
  const response = page.waitForResponse((r) => r.url().endsWith('/api/vision/analyze'));
  hold = false;
  release();
  await response;
  await page.waitForFunction(() => window.__online.diagnostics().lastError === 'response-expired');
  assert.equal(
    await page
      .locator('#references')
      .innerText()
      .then((s) => s.includes('cadeira')),
    false,
  );
  report.cases.push(
    'CA-H2/CA-L4: delayed snapshot beyond 10 s is rejected even though local observations are fresh',
  );
  await page.click('#start');
  assert.equal(await page.evaluate(() => window.__terminated), 1);

  now += 20000;
  await page.evaluate(() => {
    window.__holdVoice = true;
  });
  await page.click('#start');
  await page.waitForFunction(() => typeof window.__releaseVoice === 'function');
  const voiceCount = await page.evaluate(() => window.__online.diagnostics().local.accepted);
  await page.waitForFunction(
    (n) => window.__online.diagnostics().local.accepted >= n + 4,
    voiceCount,
  );
  assert.equal(await page.locator('#speech-state').innerText(), 'Falando');
  assert.equal(calls, 2);
  assert.match(await page.locator('#caption').innerText(), /sala de teste.*cadeira/s);
  report.cases.push(
    'CA-H1/CA-F4: local worker continues during held speech; unchanged view makes no extra API request',
  );
  await page.evaluate(() => {
    window.__holdVoice = false;
    window.__releaseVoice();
  });
  await page.waitForFunction(
    () => document.querySelector('#speech-state').textContent === 'Em silêncio',
  );
  const stamps = await page.evaluate(() => window.__localStamps);
  assert.equal(new Set(stamps.map((s) => s.sessionGeneration)).size, 2);
  report.cases.push('CA-H2: restart has a new generation and disposes the previous worker');

  await page.evaluate(() => window.__workers.at(-1).postMessage({ control: 'fail' }));
  await page.waitForFunction(() => window.__online.diagnostics().local.state === 'error');
  const frames = await page.evaluate(() => window.__online.diagnostics().capture.frames);
  await page.waitForFunction((n) => window.__online.diagnostics().capture.frames > n + 3, frames);
  assert.ok(await page.locator('#camera').evaluate((v) => v.srcObject !== null));
  assert.equal(await page.evaluate(() => window.__terminated), 2);
  report.cases.push(
    'CA-H9: failed local worker terminates once and leaves the existing snapshot path available with a capability notice',
  );
  report.diagnostics = await page.evaluate(() => window.__online.diagnostics());
  assert.doesNotMatch(
    JSON.stringify(report.diagnostics),
    /base64|fingerprint|rgba|sala de teste|cadeira|sk-/,
  );
  await page.click('#start');
  await context.close();

  now += 20000;
  const fallback = await open({ fallback: true });
  await fallback.page.click('#start');
  await fallback.page.waitForFunction(() => window.__online.diagnostics().local.accepted >= 3);
  assert.equal(
    await fallback.page.evaluate(() => window.__online.diagnostics().capture.backend),
    'animation-frame',
  );
  await fallback.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await fallback.page.waitForFunction(() => document.querySelector('#camera').srcObject === null);
  assert.equal(await fallback.page.evaluate(() => window.__terminated), 1);
  report.cases.push(
    'CA-H1/H9: fallback without video-frame callback processes frames; simulated hidden-tab event stops camera and worker',
  );
  await fallback.context.close();

  now += 20000;
  const revocation = await open({ consent: true });
  await revocation.page.click('#start');
  await revocation.page.waitForFunction(() => window.__online.diagnostics().local.accepted >= 1);
  await revocation.page.uncheck('#cloud-consent');
  await revocation.page.waitForFunction(() => document.querySelector('#camera').srcObject === null);
  assert.equal(await revocation.page.evaluate(() => window.__terminated), 1);
  report.cases.push(
    'CA-H9: consent revocation stops capture, worker and scheduling (fake transport, Luna consent policy)',
  );
  await revocation.context.close();
  assert.deepEqual(report.requestsOutsideLoopback, []);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  release?.();
  await browser.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-hybrid-capture', { recursive: true });
  await writeFile('artifacts/e2e-hybrid-capture/result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
