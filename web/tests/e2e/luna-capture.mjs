import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { CONFIG } from '../../dist/config.js';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';
const evidence = {
  scene: { label: 'sala', support: ['a'] },
  observations: [
    {
      id: 'a',
      kind: 'object',
      label: 'cadeira',
      article: 'uma',
      uncertain: false,
      box: { x: 0.4, y: 0.2, width: 0.2, height: 0.4 },
    },
  ],
  relations: [],
  limitations: [],
};
let now = Date.now(),
  calls = 0;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' }),
  budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const report = {
  passed: false,
  scope:
    'Real browser/loopback HTTP, public synthetic camera, simulated clocks, controlled voice and fake API; no paid call or real camera.',
  cases: [],
  errors: [],
  calls: 0,
};
let browser;
try {
  browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
  for (const mode of ['timeout', 'stop', 'stale', 'zero-counter']) {
    now += 60000;
    const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => report.errors.push(e.message));
      await installTestVoice(page);
      if (mode !== 'zero-counter') await page.clock.install();
      await page.addInitScript((mode) => {
        window.__jpegMode = ['timeout', 'stop'].includes(mode) ? 'hang' : 'normal';
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
          if (window.__jpegMode === 'hang') {
            window.__releaseJpeg = () => callback(new Blob(['late fake result']));
            return;
          }
          return original.call(this, callback, ...args);
        };
        if (mode === 'zero-counter') {
          HTMLVideoElement.prototype.requestVideoFrameCallback = undefined;
          HTMLVideoElement.prototype.getVideoPlaybackQuality = () => ({ totalVideoFrames: 0 });
        }
      }, mode);
      await page.goto(base);
      await page.evaluate(async (mode) => {
        const { OnlineSession } = await import('/vision/online-session.js');
        const start = OnlineSession.prototype.start;
        OnlineSession.prototype.start = function (...args) {
          window.__online = this;
          return start.apply(this, args);
        };
        if (mode === 'stale') {
          const { SnapshotCamera } = await import('/vision/snapshot-camera.js');
          const capture = SnapshotCamera.prototype.capture;
          SnapshotCamera.prototype.capture = async function (...args) {
            const image = await capture.apply(this, args);
            return { ...image, capturedAtMs: performance.now() - 4000 };
          };
        }
      }, mode);
      await page.selectOption('#perception-provider', 'luna');
      await page.waitForFunction(() =>
        document.querySelector('#luna-config').textContent.includes('Simulador'),
      );
      const before = calls;
      await page.click('#start');
      if (mode === 'timeout' || mode === 'stop')
        await page.waitForFunction(() => window.__online.diagnostics().capture.jpeg.inFlight === 1);
      if (mode === 'timeout') {
        await page.clock.runFor(CONFIG.capture.jpegTimeoutMs + 200);
        await page.waitForFunction(
          () => window.__online.diagnostics().lastError === 'capture-timeout',
        );
        const failed = await page.evaluate(() => window.__online.diagnostics());
        assert.equal(failed.dispatched, 0);
        assert.equal(failed.recovering, true);
        assert.equal(failed.capture.jpeg.inFlight, 0);
        assert.equal(calls, before);
        await page.evaluate(() => {
          window.__jpegMode = 'normal';
          window.__releaseJpeg();
        });
        assert.equal(calls, before);
        now += 20000;
        await page.clock.runFor(CONFIG.online.recoveryDelayMs + 1000);
        await page.waitForFunction(() => window.__online.diagnostics().delivered === 1);
        const recovered = await page.evaluate(() => window.__online.diagnostics());
        assert.equal(recovered.dispatched, 1);
        assert.equal(recovered.lastError, null);
        assert.equal(calls, before + 1);
        report.cases.push(
          'CA-H1/H9/L3: JPEG deadline releases capture; late callback never dispatches; one bounded recovery uses a new image and fake request',
        );
      } else if (mode === 'stop') {
        await page.click('#start');
        await page.evaluate(() => window.__releaseJpeg());
        await page.clock.runFor(CONFIG.capture.jpegTimeoutMs + 200);
        const stopped = await page.evaluate(() => window.__online.diagnostics());
        assert.equal(stopped.running, false);
        assert.equal(stopped.pending, false);
        assert.equal(stopped.capture.jpeg.inFlight, 0);
        assert.equal(calls, before);
        assert.equal(stopped.lastError, null);
        assert.equal(await page.locator('#camera').evaluate((video) => video.srcObject), null);
        report.cases.push(
          'CA-H9/L3: stop immediately cancels an encoding that never returns, with no upstream call or late speech',
        );
      } else if (mode === 'stale') {
        await page.waitForFunction(
          () => window.__online.diagnostics().lastError === 'capture-stale',
        );
        const stale = await page.evaluate(() => window.__online.diagnostics());
        assert.equal(stale.dispatched, 0);
        assert.equal(stale.recovering, true);
        assert.equal(calls, before);
        assert.match(await page.locator('#status').innerText(), /temporária|captura/);
        report.cases.push(
          'CA-H2/L3: an expired original frame is blocked before gateway reservation even while current video remains fresh',
        );
      } else {
        await page.waitForFunction(() => window.__spoken.length === 1);
        await page.waitForFunction(() => window.__online.diagnostics().capture.frames >= 4);
        const fallback = await page.evaluate(() => window.__online.diagnostics());
        assert.equal(fallback.capture.backend, 'animation-frame');
        assert.equal(fallback.capture.frameBasis, 'media-time');
        assert.equal(fallback.capture.fresh, true);
        assert.equal(calls, before + 1);
        report.cases.push(
          'CA-H1/H6: browser exposing a permanent zero quality counter still captures advancing media time without repeat API calls',
        );
      }
      if (mode !== 'stop') await page.click('#start');
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  await browser?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-luna-capture', { recursive: true });
  await writeFile('artifacts/e2e-luna-capture/result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
