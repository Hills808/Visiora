import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';
const evidence = {
  scene: { label: 'laboratório de cerâmica', support: ['a'] },
  observations: [
    {
      id: 'a',
      kind: 'object',
      label: 'torno de cerâmica',
      article: 'um',
      uncertain: false,
      box: { x: 0.05, y: 0.1, width: 0.2, height: 0.5 },
    },
  ],
  relations: [],
  limitations: [],
};
let calls = 0,
  now = Date.now(),
  hold = false,
  fail = false,
  currentEvidence = evidence,
  release;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' });
const budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  provider: async () => {
    calls++;
    if (fail) throw new Error('Simulated provider failure');
    if (hold) await new Promise((resolve) => (release = resolve));
    return { evidence: currentEvidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
const report = {
  scope:
    'Real loopback HTTP and browser camera capture; synthetic video, provider evidence and voice. No OpenAI call.',
  cases: [],
  calls: 0,
  errors: [],
};
async function waitForProvider() {
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 3000;
    function check() {
      if (release) resolve();
      else if (Date.now() > deadline) reject(new Error('Provider not called'));
      else setImmediate(check);
    }
    check();
  });
}
try {
  const context = await browser.newContext({
    permissions: ['camera'],
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const requests = [];
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await installTestVoice(page);
  await page.addInitScript(() => {
    window.__sceneLevel = 0;
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const image = original.apply(this, args);
      if (this.canvas.width === 32 && this.canvas.height === 24)
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = image.data[i + 1] = image.data[i + 2] = window.__sceneLevel;
        }
      return image;
    };
  });
  await page.goto(base);
  await page.waitForFunction(() =>
    document.querySelector('#luna-config').textContent.includes('Simulador'),
  );
  assert.equal(await page.locator('#perception-provider').inputValue(), 'luna');
  assert.equal(await page.locator('#cloud-consent').isChecked(), false);
  await page.click('#start');
  assert.equal(await page.locator('#perception-provider').isDisabled(), true);
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(
    await page.locator('#caption').innerText(),
    /Simulação de análise.*capturada há.*laboratório de cerâmica.*torno de cerâmica/s,
  );
  assert.match(await page.locator('#references').innerText(), /torno de cerâmica/);
  assert.equal(calls, 1);
  assert.equal(
    requests.some((url) => /\.onnx|model\.part|ort\.wasm|api\.openai/.test(url)),
    false,
  );
  report.cases.push(
    'Activation automatically analyzes and speaks the first fresh view, without question button or ONNX',
  );
  await page.click('[data-ask=repeat]');
  await page.waitForFunction(() => window.__spoken.length === 2);
  assert.equal(calls, 1);
  report.cases.push('Repeat uses completed local memory without another provider call');
  now += 10000;
  await page.click('#search-open');
  await page.fill('#search-input', 'torno');
  await page.click('#search-form button[value=search]');
  await page.waitForFunction(() => window.__spoken.length === 3);
  assert.equal(calls, 2);
  report.transcript = await page.evaluate(() => window.__spoken.slice());
  assert.match(report.transcript[2], /torno de cerâmica/);
  assert.doesNotMatch(report.transcript[2], /Falha|O ambiente/);
  assert.match(await page.locator('#caption').innerText(), /torno de cerâmica/);
  assert.doesNotMatch(await page.locator('#caption').innerText(), /passos|metros/);
  report.cases.push('Find open item, fixed camera direction, no fabricated distance');
  await mkdir('artifacts/e2e-luna', { recursive: true });
  await page.screenshot({ path: 'artifacts/e2e-luna/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/e2e-luna/mobile.png', fullPage: true });
  report.cases.push('390px layout has no horizontal overflow');
  now += 12000;
  currentEvidence = {
    ...evidence,
    observations: [
      {
        ...evidence.observations[0],
        label: 'passagem com placa de saída',
        article: 'uma',
        uncertain: true,
      },
    ],
  };
  await page.evaluate(() => {
    window.__sceneLevel = 120;
  });
  await page.waitForFunction(() => window.__spoken.length === 4, null, { timeout: 22000 });
  assert.equal(calls, 3);
  assert.match(
    await page.locator('#caption').innerText(),
    /talvez haja uma passagem com placa de saída/,
  );
  assert.doesNotMatch(
    await page.locator('#caption').innerText(),
    /laboratório|saída segura|caminho livre/,
  );
  assert.doesNotMatch(await page.locator('#caption').innerText(), /torno de cerâmica/);
  report.cases.push(
    'Material camera change automatically analyzes a new view and voices a visible passage without repeating the room',
  );
  now += 12000;
  const deduplicated = page.waitForResponse((r) => r.url().endsWith('/api/vision/analyze'));
  await page.evaluate(() => {
    window.__sceneLevel = 0;
  });
  await deduplicated;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Captura analisada'),
  );
  assert.equal(calls, 4);
  assert.equal(await page.evaluate(() => window.__spoken.length), 4);
  report.cases.push('Changed pixels with the same acknowledged references do not repeat speech');
  now += 10000;
  hold = true;
  release = undefined;
  await page.click('[data-ask=describe]');
  await waitForProvider();
  await page.click('#settings-open');
  const delivered = page.waitForResponse((r) => r.url().endsWith('/api/vision/analyze'));
  release();
  hold = false;
  await delivered;
  assert.equal(await page.evaluate(() => window.__spoken.length), 4);
  await page.click('#settings button[value=cancel]');
  await page.waitForFunction(() => window.__spoken.length === 5);
  assert.match(await page.evaluate(() => window.__spoken[4]), /passagem com placa de saída/);
  report.cases.push(
    'A result arriving during settings waits for the dialog to close without another API request',
  );
  now += 10000;
  hold = true;
  release = undefined;
  await page.click('[data-ask=describe]');
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Analisando'),
  );
  await waitForProvider();
  await page.click('#start');
  release();
  hold = false;
  await page.waitForFunction(() =>
    document.querySelector('#caption').textContent.includes('Sessão encerrada'),
  );
  assert.equal(await page.locator('#camera').evaluate((v) => v.srcObject), null);
  assert.equal(await page.evaluate(() => window.__spoken.length), 5);
  report.cases.push('Stopping during upstream analysis stops camera and rejects late speech');
  let releaseStatus;
  let intercepted;
  const statusHeld = new Promise((resolve) => (intercepted = resolve));
  await page.route(
    '**/api/vision/status',
    (route) =>
      new Promise((resolve) => {
        intercepted();
        releaseStatus = async () => {
          await route.continue();
          resolve();
        };
      }),
  );
  await page.click('#start');
  await statusHeld;
  await page.waitForFunction(() =>
    document.querySelector('#start').textContent.includes('Cancelar'),
  );
  await page.click('#start');
  const statusReturned = page.waitForResponse((r) => r.url().endsWith('/api/vision/status'));
  await releaseStatus();
  await statusReturned;
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.unroute('**/api/vision/status');
  assert.equal(await page.locator('#camera').evaluate((v) => v.srcObject), null);
  report.cases.push('Canceling startup during gateway configuration does not open the camera');
  now += 12000;
  fail = true;
  await page.click('#start');
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('automático pausado'),
  );
  await page.waitForFunction(() => window.__spoken.length === 6);
  const failedCalls = calls;
  await page.clock.install();
  await page.evaluate(() => {
    window.__sceneLevel = 255;
  });
  await page.clock.fastForward(60000);
  assert.equal(calls, failedCalls);
  assert.match(await page.locator('#status').innerText(), /pausado/);
  report.cases.push(
    'Provider failure pauses automatic dispatch and announces once, with no automatic paid retry',
  );
  report.transcript = await page.evaluate(() => window.__spoken.slice());
  await page.click('#start');
  assert.equal(
    requests.every((url) => new URL(url).origin === base),
    true,
  );
} finally {
  // Always release the owned fake provider on a failed assertion.
  release?.();
  await browser.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-luna', { recursive: true });
  await writeFile('artifacts/e2e-luna/result.json', JSON.stringify(report, null, 2));
}
assert.deepEqual(report.errors, []);
console.log(JSON.stringify(report, null, 2));
