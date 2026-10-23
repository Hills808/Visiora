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
    await page.waitForFunction(() =>
      document.querySelector('#luna-config').textContent.includes('Simulador'),
    );
    await page.evaluate((value) => {
      window.__holdVoice = value;
    }, holdVoice);
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
  assert.match(first, /À sua frente, há uma janela com veneziana, uma pessoa e uma cama\./);
  assert.equal(first.match(/À sua frente/g).length, 1);
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
  await page.waitForFunction(() => window.__spoken.length === 1);
  const contextOnly = await page.locator('#caption').innerText();
  assert.match(contextOnly, /capturada há.*O ambiente parecia quarto\./);
  assert.doesNotMatch(contextOnly, /À sua|janela|pessoa|cama/);
  assert.equal(await page.locator('#reference-count').innerText(), '0');
  report.cases.push(
    'Broad view change during API preserves only historical scene context and removes old object positions',
  );
  await page.waitForFunction(() => window.__spoken.length === 2);
  assert.match(
    await page.locator('#caption').innerText(),
    /janela com veneziana, uma pessoa e uma cama/,
  );
  report.cases.push(
    'Next fresh snapshot can describe objects omitted from context-only speech, without a stability pause',
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
  await page.waitForFunction(() => window.__started.length === 2);
  assert.equal(await page.evaluate(() => window.__canceled.length), 1);
  assert.equal(await page.evaluate(() => window.__spoken.length), 0);
  assert.match(await page.locator('#caption').innerText(), /O ambiente parecia quarto/);
  await page.evaluate(() => {
    window.__holdVoice = false;
    window.__endVoice();
  });
  assert.equal(await page.evaluate(() => window.__spoken.length), 1);
  report.cases.push(
    'Broad change during speech cancels directional output once; only completed historical context is acknowledged',
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
  await page.waitForFunction(() => window.__spoken.length === 1);
  assert.match(await page.locator('#caption').innerText(), /O ambiente parecia quarto/);
  assert.doesNotMatch(await page.locator('#caption').innerText(), /janela|pessoa|cama|À sua/);
  report.cases.push(
    'A broad change and return during API cannot revive the positions of that earlier capture',
  );
  report.transcripts.push(await page.evaluate(() => window.__spoken));
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
