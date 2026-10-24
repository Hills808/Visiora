import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser } from './helpers.mjs';
import { CONFIG } from '../../dist/config.js';

const evidence = {
  scene: { label: 'quarto', support: ['0', '2'] },
  observations: ['janela com veneziana', 'pessoa', 'cama'].map((label, i) => ({
    id: String(i),
    kind: label === 'pessoa' ? 'person' : 'object',
    label,
    article: 'uma',
    uncertain: false,
    box: { x: 0.4, y: 0.1, width: 0.2, height: 0.5 },
  })),
  relations: [],
  limitations: [],
};
let offset = 0,
  calls = 0,
  hold = true,
  release,
  notifyCall;
let called = new Promise((resolve) => {
  notifyCall = resolve;
});
const config = loadConfig({ VISIORA_PROVIDER: 'fake' });
const budget = new Budget(':memory:', config, () => Date.now() + offset);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    const held = hold
      ? new Promise((resolve) => {
          release = resolve;
        })
      : null;
    notifyCall();
    if (held) await held;
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
const report = {
  scope:
    'Synthetic continuous pixel motion, fake API and controlled voice in Chrome; no paid calls or physical walking.',
  cases: [],
  errors: [],
  transcripts: [],
};
try {
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    localStorage.clear(); // Independent scenarios in this disposable test browser context.
    window.__motionPermissionRequests = 0;
    Object.defineProperty(DeviceMotionEvent, 'requestPermission', {
      configurable: true,
      value: () => {
        window.__motionPermissionRequests++;
        return Promise.resolve('granted');
      },
    });
    window.__samples = 0;
    window.__pattern = 'moving';
    window.__sampledPattern = null;
    window.__firstSample = null;
    window.__analysisRequests = [];
    const pixels = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const image = pixels.apply(this, args);
      if (this.canvas.width === 32 && this.canvas.height === 24) {
        window.__firstSample ??= performance.now();
        window.__samples++;
        window.__sampledPattern = window.__pattern;
        const level = window.__samples % 2 ? 70 : 120;
        for (let i = 0; i < image.data.length; i += 4) {
          // Every new frame exceeds the old motion threshold, even in the same structural view.
          const value =
            window.__pattern === 'broad' ? ((i / 4) % 2 ? level + 100 : level - 60) : level;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
        }
      }
      return image;
    };
    const fetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (String(url).endsWith('/api/vision/analyze'))
        window.__analysisRequests.push({ at: performance.now(), samples: window.__samples });
      return fetch(url, options);
    };
    let generation = 0;
    window.__spoken = [];
    window.__started = [];
    window.__canceled = [];
    window.__holdVoice = false;
    window.__deferVoiceStart = false;
    let active = null;
    const voice = {
      name: 'Controlled test voice',
      lang: 'pt-BR',
      voiceURI: 'test-local',
      localService: true,
    };
    const synth = {
      getVoices: () => [voice],
      addEventListener() {},
      cancel() {
        generation++;
        if (active) window.__canceled.push(active.text);
        active = null;
      },
      speak(u) {
        active = u;
        const token = generation;
        window.__queuedVoiceAt = performance.now();
        window.__startVoice = () => {
          if (token !== generation) return;
          window.__started.push(u.text);
          u.onstart?.();
          window.__endVoice = () => {
            if (token !== generation || active !== u) return;
            active = null;
            window.__spoken.push(u.text);
            u.onend?.();
          };
          if (!window.__holdVoice) window.__endVoice();
        };
        queueMicrotask(() => {
          if (!window.__deferVoiceStart) window.__startVoice();
        });
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
  });
  async function start(holdVoice) {
    offset += 60000;
    hold = true;
    release = undefined;
    called = new Promise((resolve) => {
      notifyCall = resolve;
    });
    await page.goto(base);
    await page.selectOption('#perception-provider', 'luna');
    await page.locator('.environment-details > summary').click();
    await page.waitForFunction(() =>
      document.querySelector('#luna-config').textContent.includes('Simulador'),
    );
    await page.evaluate((value) => {
      window.__holdVoice = value;
    }, holdVoice);
    await page.evaluate(async () => {
      const { OnlineSession } = await import('/vision/online-session.js');
      const original = OnlineSession.prototype.start;
      OnlineSession.prototype.start = function (...args) {
        window.__testOnlineSession = this;
        return original.apply(this, args);
      };
    });
    await page.click('#start');
    await called;
  }
  await start(true);
  report.firstFrameToDispatchMs = await page.evaluate(
    () => window.__analysisRequests[0].at - window.__firstSample,
  );
  assert.ok(report.firstFrameToDispatchMs < CONFIG.motion.settleMs);
  await page.waitForFunction(() => window.__samples >= 5);
  release();
  hold = false;
  await page.waitForFunction(() => window.__started.length === 1);
  await page.waitForFunction(() => window.__samples >= 10);
  assert.equal(await page.evaluate(() => window.__canceled.length), 0);
  await page.evaluate(() => {
    window.__holdVoice = false;
    window.__endVoice();
  });
  const first = await page.locator('#caption').innerText();
  assert.match(
    first,
    /À frente da câmera, havia uma janela com veneziana, uma pessoa e uma cama\./,
  );
  assert.equal(first.match(/À frente da câmera/g).length, 1);
  assert.ok(first.split(/\s+/).length <= CONFIG.speech.briefingWords);
  report.cases.push(
    'First fresh frame starts analysis before the old settling window, despite continuous synthetic motion',
  );
  report.cases.push(
    'Small ongoing motion during API and voice does not starve or cancel the age-labelled description',
  );
  report.cases.push(
    'Three items in one direction form one phrase with one directional prefix and a bounded word count',
  );
  const second = page.waitForResponse((response) => response.url().endsWith('/api/vision/analyze'));
  await second;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('Captura analisada'),
  );
  assert.equal(await page.evaluate(() => window.__spoken.length), 1);
  const sends = await page.evaluate(() => window.__analysisRequests);
  assert.equal(sends.length, 2);
  assert.ok(sends[1].at - sends[0].at >= CONFIG.online.autoIntervalMs);
  report.cases.push(
    'Continuous motion allows the next analysis at the configured cadence, while unchanged evidence stays silent',
  );
  report.transcripts.push(await page.evaluate(() => window.__spoken));
  await page.click('#start');

  await start(false);
  await page.evaluate(() => {
    window.__pattern = 'broad';
  });
  await page.waitForFunction(() => window.__sampledPattern === 'broad');
  release();
  hold = false;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('cena mudou'),
  );
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  assert.equal(await page.locator('#reference-count').innerText(), '0');
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(
    await page.locator('#caption').innerText(),
    /janela com veneziana, uma pessoa e uma cama/,
  );
  const replacement = await page.evaluate(() => window.__analysisRequests);
  assert.equal(replacement.length, 2);
  assert.ok(replacement[1].at - replacement[0].at >= CONFIG.online.autoIntervalMs);
  report.cases.push(
    'Invalid automatic response remains silent; a fresh replacement describes the new view at cadence',
  );
  report.transcripts.push(await page.evaluate(() => window.__spoken));
  await page.click('#start');

  await start(true);
  release();
  hold = false;
  await page.waitForFunction(() => window.__started.length === 1);
  await page.evaluate(() => {
    window.__pattern = 'broad';
  });
  await page.waitForFunction(() => window.__canceled.length === 1);
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  assert.equal(await page.evaluate(() => window.__started.length), 1);
  await page.evaluate(() => {
    window.__holdVoice = false;
  });
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(await page.locator('#caption').innerText(), /janela com veneziana/);
  report.cases.push(
    'Broad change cancels directional speech once and waits for a replacement, without historical speech',
  );
  report.transcripts.push(await page.evaluate(() => window.__spoken));
  await page.click('#start');
  await start(false);
  await page.evaluate(() => {
    window.__pattern = 'broad';
  });
  await page.waitForFunction(() => window.__sampledPattern === 'broad');
  await page.evaluate(() => {
    window.__pattern = 'moving';
  });
  await page.waitForFunction(() => window.__sampledPattern === 'moving');
  release();
  hold = false;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('cena mudou'),
  );
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(await page.locator('#caption').innerText(), /janela com veneziana/);
  report.cases.push(
    'A to B to A during API cannot revive old positions and receives one fresh replacement',
  );
  report.transcripts.push(await page.evaluate(() => window.__spoken));
  // After a completed delivery, broad change and return must also request a replacement.
  const deliveredCalls = await page.evaluate(() => window.__analysisRequests.length);
  hold = true;
  await page.evaluate(() => {
    window.__pattern = 'broad';
  });
  await page.waitForFunction(() => window.__sampledPattern === 'broad');
  await page.evaluate(() => {
    window.__pattern = 'moving';
  });
  await page.waitForFunction(() => window.__sampledPattern === 'moving');
  await page.waitForFunction((n) => window.__analysisRequests.length > n, deliveredCalls);
  const afterDelivery = await page.evaluate(() => window.__analysisRequests);
  assert.ok(afterDelivery.at(-1).at - afterDelivery.at(-2).at >= CONFIG.online.autoIntervalMs);
  report.cases.push(
    'A to B to A after completed delivery still dispatches a replacement at cadence',
  );
  release();
  hold = false;
  await page.click('#start');

  await start(false);
  assert.equal(await page.evaluate(() => window.__motionPermissionRequests), 0);
  await page.click('#settings-open');
  await page.getByText('Giros da câmera · experimental', { exact: true }).click();
  await page.click('#motion-toggle');
  assert.equal(await page.evaluate(() => window.__motionPermissionRequests), 1);
  await page.getByRole('button', { name: 'Fechar ajustes', exact: true }).click();
  for (let i = 0; i < 2; i++)
    await page.evaluate(() =>
      window.dispatchEvent(
        new DeviceMotionEvent('devicemotion', {
          rotationRate: { alpha: 25, beta: 0, gamma: 0 },
        }),
      ),
    );
  release();
  hold = false;
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('cena mudou'),
  );
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  assert.equal(await page.locator('#reference-count').innerText(), '0');
  await page.waitForFunction(() => window.__spoken.length === 1);
  const rotationRequests = await page.evaluate(() => window.__analysisRequests);
  assert.equal(rotationRequests.length, 2);
  assert.ok(rotationRequests[1].at - rotationRequests[0].at >= CONFIG.online.autoIntervalMs);
  assert.equal(
    await page.evaluate(() => window.__testOnlineSession.diagnostics().cameraRotationInvalidations),
    1,
  );
  report.cases.push(
    'Opt-in settings button requests permission only on click; synthetic sensor rotation during API replaces once at cadence',
  );
  await page.click('#start');
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceMotionEvent('devicemotion', {
        rotationRate: { alpha: 25, beta: 0, gamma: 0 },
      }),
    ),
  );
  assert.equal(
    await page.evaluate(() => window.__testOnlineSession.diagnostics().cameraRotationInvalidations),
    1,
  );

  await start(true);
  release();
  hold = false;
  await page.waitForFunction(() => window.__started.length === 1);
  await page.evaluate(() => {
    window.__holdVoice = false;
    window.__testOnlineSession.observeCameraRotation();
    window.__testOnlineSession.observeCameraRotation();
  });
  await page.waitForFunction(() => window.__canceled.length === 1);
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(await page.locator('#caption').innerText(), /janela com veneziana/);
  report.cases.push(
    'Confirmed device rotation cancels current speech idempotently; new capture can speak after rotation stops',
  );
  await page.click('#start');

  await start(true);
  release();
  hold = false;
  await page.waitForFunction(() => window.__started.length === 1);
  await page.click('#settings-open');
  assert.equal(await page.evaluate(() => window.__canceled.length), 1);
  assert.equal(await page.evaluate(() => window.__testOnlineSession.diagnostics().delivered), 0);
  await page.evaluate(() => {
    window.__holdVoice = false;
  });
  await page.getByRole('button', { name: 'Fechar ajustes', exact: true }).click();
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.equal(await page.evaluate(() => window.__testOnlineSession.diagnostics().paused), false);
  report.cases.push(
    'Opening settings cancels without acknowledgment; closing settings permits a fresh replacement without timeout',
  );
  await page.click('#start');

  await start(false);
  await page.click('#settings-open');
  await page.selectOption('#output', 'reader');
  await page.getByRole('button', { name: 'Salvar ajustes', exact: true }).click();
  release();
  hold = false;
  await page.waitForFunction(() => window.__testOnlineSession.diagnostics().delivered === 1);
  const readerTiming = await page.evaluate(() => window.__testOnlineSession.diagnostics().timing);
  assert.equal(readerTiming.captureToStart[0].channel, 'text');
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  await page.evaluate(() => {
    window.__testOnlineSession.noteUnusableResponse();
    window.__testOnlineSession.noteUnusableResponse();
  });
  await page.waitForFunction(() =>
    document.querySelector('#screen-reader').textContent.includes('Ainda não há descrição recente'),
  );
  report.cases.push(
    'Reader UI records text rather than voice and exposes the deduplicated obsolete-scene notice',
  );
  await page.click('#start');

  await start(true);
  await page.evaluate(() => {
    window.__deferVoiceStart = true;
  });
  release();
  hold = false;
  await page.waitForFunction(() => typeof window.__startVoice === 'function');
  await page.waitForFunction(
    (ttl) => performance.now() - window.__queuedVoiceAt >= ttl,
    CONFIG.speech.answerTtlMs + CONFIG.ui.tickMs,
  );
  await page.evaluate(() => {
    window.__startVoice();
    window.__endVoice?.();
  });
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  assert.equal(await page.evaluate(() => window.__canceled.length), 1);
  report.cases.push(
    'A voice callback delayed beyond the delivery TTL is rejected before audio and cannot acknowledge delivery',
  );
  await page.click('#start');
  assert.equal(await page.locator('#camera').evaluate((video) => video.srcObject), null);
  assert.equal(
    requests.every((url) => new URL(url).origin === base),
    true,
  );
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
  await mkdir('artifacts/e2e-luna-movement', { recursive: true });
  await writeFile('artifacts/e2e-luna-movement/result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
