import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget, GatewayError } from '../../server/budget.mjs';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';

const chair = {
  id: 'c',
  kind: 'object',
  label: 'cadeira',
  article: 'uma',
  uncertain: false,
  box: { x: 0.1, y: 0.1, width: 0.2, height: 0.5 },
};
const person = {
  ...chair,
  id: 'p',
  kind: 'person',
  label: 'pessoa',
  box: { x: 0.4, y: 0.1, width: 0.2, height: 0.5 },
};
let evidence = {
  scene: { label: 'escritório', support: ['c'] },
  observations: [chair, person],
  relations: [],
  limitations: [],
};
let now = Date.now(),
  calls = 0,
  failures = 0,
  hold = false,
  release;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' }),
  budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    if (failures) {
      failures--;
      throw new GatewayError(503, 'provider-unavailable');
    }
    if (hold) await new Promise((resolve) => (release = resolve));
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`,
  browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
const report = {
  scope:
    'Loopback gateway + Chrome synthetic camera/voice, artificial evidence and clock. No OpenAI calls.',
  cases: [],
  errors: [],
};
try {
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' }),
    page = await context.newPage();
  const requests = [];
  page.setDefaultTimeout(15000);
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (error) => report.errors.push(error.message));
  await installTestVoice(page);
  await page.addInitScript(() => {
    window.__view = 0;
    window.__blobs = [];
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const image = original.apply(this, args);
      if (this.canvas.width === 32 && this.canvas.height === 24) {
        window.__viewSampled = window.__view;
        for (let i = 0; i < image.data.length; i += 4) {
          const pixel = i / 4,
            x = pixel % 32,
            y = Math.floor(pixel / 32);
          const value =
            window.__view === 2
              ? x % 2
                ? 210
                : 45
              : window.__view === 1 && x < 8 && y < 4
                ? 154
                : 128;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
        }
      }
      return image;
    };
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob.type === 'application/json') window.__blobs.push(blob);
      return create(blob);
    };
    HTMLAnchorElement.prototype.click = function () {}; // Capture diagnostics blob without native download.
  });
  await page.goto(base);
  await page.waitForFunction(() =>
    document.querySelector('#luna-config').textContent.includes('Simulador'),
  );
  await page.click('#start');
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(await page.locator('#caption').innerText(), /cadeira.*uma pessoa/s);
  await page.clock.install();
  evidence = { ...evidence, observations: [chair] };
  now += 5000;
  await page.evaluate(() => (window.__view = 1));
  await page.clock.fastForward(5000);
  await page.waitForFunction(() => window.__spoken.length === 2);
  assert.equal(calls, 2);
  assert.match(
    await page.locator('#caption').innerText(),
    /Não identifiquei pessoas nesta captura/,
  );
  report.cases.push(
    'Moderate localized change triggers analysis and a person no longer identified is voiced with unchanged furniture',
  );
  now += 60000;
  await page.clock.fastForward(60000);
  assert.equal(calls, 2);
  assert.equal(await page.evaluate(() => window.__spoken.length), 2);
  report.cases.push('Unchanged view after the update stays silent and makes no new request');
  now += 5000;
  await page.evaluate(() => (window.__view = 2));
  await page.clock.fastForward(5000);
  await page.waitForFunction(() => window.__spoken.length === 3);
  assert.match(
    await page.locator('#caption').innerText(),
    /Neste enquadramento.*escritório.*cadeira/s,
  );
  report.cases.push(
    'Broad structural change reintroduces visible references even with the same scene label',
  );

  hold = true;
  release = undefined;
  now += 5000;
  await page.evaluate(() => (window.__view = 0));
  await page.clock.fastForward(5000);
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    function check() {
      if (release) resolve();
      else if (Date.now() > deadline) reject(new Error('Held provider not called'));
      else setImmediate(check);
    }
    check();
  });
  await page.evaluate(() => (window.__view = 2));
  await page.clock.runFor(400);
  // Video decoding runs outside the fake clock. Await the new sampled frame, not a timer race.
  await page.waitForFunction(() => window.__viewSampled === 2);
  release();
  hold = false;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('mudou durante'),
  );
  now += 5000;
  await page.clock.fastForward(5000);
  await page.waitForFunction(() => window.__spoken.length === 4);
  report.cases.push(
    'A broad view change during an in-flight request omits old positions, stays silent for known scene context, then describes a fresh capture',
  );

  // A single temporary failure recovers without a question button, with a fresh request/capture.
  failures = 1;
  now += 5000;
  await page.evaluate(() => (window.__view = 0));
  await page.clock.fastForward(5000);
  await page.waitForFunction(() => window.__spoken.some((s) => s.includes('Falha temporária')));
  const failedCalls = calls;
  now += 10000;
  await page.clock.fastForward(10000);
  assert.equal(calls, failedCalls);
  now += 6000;
  await page.clock.fastForward(6000);
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Captura analisada'),
  );
  assert.equal(calls, failedCalls + 1);
  // The response/status arrives before fake voice completion. Finish delivery before jumping clocks.
  await page.waitForFunction(() => window.__spoken.at(-1)?.includes('cadeira'));
  const records = budget.db.prepare('SELECT id FROM requests ORDER BY at').all();
  assert.notEqual(records.at(-1).id, records.at(-2).id);
  report.cases.push(
    'Temporary failure announces once, waits 15 seconds, then automatically captures a fresh frame with a new request ID',
  );

  // Two consecutive failures must stop, even if camera motion continues.
  failures = 2;
  now += 5000;
  await page.evaluate(() => (window.__view = 2));
  await page.clock.fastForward(5000);
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Falha temporária'),
  );
  now += 16000;
  await page.clock.fastForward(16000);
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('automático pausado'),
  );
  const pausedCalls = calls;
  now += 60000;
  await page.evaluate(() => (window.__view = 1));
  await page.clock.fastForward(60000);
  assert.equal(calls, pausedCalls);
  report.cases.push(
    'A second temporary failure pauses automatic analysis and motion cannot restart paid attempts',
  );

  await page.click('[data-page=help]');
  await page.click('details.technical summary');
  await page.click('#export-diagnostics');
  report.diagnostics = await page.evaluate(
    async () => JSON.parse(await window.__blobs.at(-1).text()).onlineContinuity,
  );
  assert.equal(report.diagnostics.paused, true);
  assert.equal(report.diagnostics.lastError, 'http-503');
  assert.equal(report.diagnostics.recoveries, 2);
  assert.equal(report.diagnostics.obsolete, 1);
  assert.doesNotMatch(
    JSON.stringify(report.diagnostics),
    /pessoa|cadeira|escritório|base64|fingerprint/,
  );
  report.cases.push(
    'Exported continuity diagnostics contain counts and safe error codes without scene descriptions or pixels',
  );

  await page.click('[data-page=ambient]');
  await page.click('#start');
  failures = 1;
  now += 10000;
  await page.click('#start');
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Falha temporária'),
  );
  await page.click('#start');
  const stoppedCalls = calls;
  now += 60000;
  await page.clock.fastForward(60000);
  assert.equal(calls, stoppedCalls);
  assert.equal(await page.locator('#camera').evaluate((v) => v.srcObject), null);
  report.cases.push('Stop cancels scheduled recovery and releases the synthetic camera');
  assert.equal(
    requests.every((url) => new URL(url).origin === base),
    true,
  );
  report.transcript = await page.evaluate(() => window.__spoken);
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  release?.();
  report.failures = budget.db.prepare('SELECT code FROM request_failures').all();
  await browser.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-luna-continuity', { recursive: true });
  await writeFile('artifacts/e2e-luna-continuity/result.json', JSON.stringify(report, null, 2));
}
assert.deepEqual(report.errors, []);
console.log(JSON.stringify(report, null, 2));
