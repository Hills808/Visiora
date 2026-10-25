import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';

const original = [
  {
    kind: 'object',
    label: 'mesa',
    article: 'uma',
    box: { x: 0.4, y: 0.3, width: 0.2, height: 0.4 },
  },
  {
    kind: 'object',
    label: 'cadeira',
    article: 'uma',
    box: { x: 0.46, y: 0.3, width: 0.15, height: 0.4 },
  },
  {
    kind: 'person',
    label: 'pessoa',
    article: 'uma',
    box: { x: 0.38, y: 0.2, width: 0.15, height: 0.6 },
  },
];
const windowItem = {
  kind: 'object',
  label: 'janela',
  article: 'uma',
  box: { x: 0.35, y: 0.05, width: 0.2, height: 0.2 },
};
const makeEvidence = ({
  step = 0,
  scene = 'sala',
  omit = false,
  extra = false,
  shifted = false,
} = {}) => {
  const observations = [...original, ...(extra ? [windowItem] : [])]
    .filter((item) => !omit || item.label !== 'cadeira')
    .map((item, index) => ({
      ...item,
      label:
        item.label === 'cadeira'
          ? ['cadeira', 'cadeira gamer', 'cadeira de escritório', 'cadeira giratória'][step % 4]
          : item.label,
      id: `${step % 2 ? 'alternado' : 'original'}-${index}`,
      uncertain: step % 2 === 1,
      box: shifted ? { ...item.box, x: index % 2 ? 0.8 : 0.05 } : { ...item.box },
    }));
  return {
    scene: { label: scene, support: observations.map((item) => item.id) },
    observations,
    relations: [],
    limitations: [],
  };
};
let current = makeEvidence(),
  now = Date.now(),
  calls = 0;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' });
const budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    return { evidence: current, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const report = {
  schemaVersion: 1,
  passed: false,
  scope:
    'Loopback HTTP; synthetic public-video camera, controlled local voice, fake provider evidence and simulated five-minute clock. No OpenAI calls, physical camera, walking or human acceptance claim.',
  cases: [],
  errors: [],
  outsideLoopback: [],
  transcript: [],
};
let browser;
try {
  browser = await launchTestBrowser(
    path.resolve(process.env.VISIORA_QA_VIDEO || 'artifacts/vision/dog.y4m'),
  );
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {
      report.outsideLoopback.push(url.origin);
      await route.abort();
      return;
    }
    // This test covers linguistic memory only; no perception models should load.
    assert.doesNotMatch(url.pathname, /\.onnx$|model\.part|ort.*\.wasm/);
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  await installTestVoice(page);
  await page.addInitScript(() => {
    window.__level = 80;
    window.__broad = false;
    window.__sampled = null;
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const image = original.apply(this, args);
      if (this.canvas.width === 32 && this.canvas.height === 24) {
        window.__sampled = `${window.__level}:${window.__broad}`;
        for (let index = 0; index < image.data.length; index += 4) {
          const value = window.__broad ? ((index / 4) % 2 ? 220 : 30) : window.__level;
          image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
        }
      }
      return image;
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
    const { compareViews } = await import('/vision/view-change.js');
    const uniform = compareViews(
      Array(32 * 24 * 3).fill(80 / 255),
      Array(32 * 24 * 3).fill(144 / 255),
    );
    if (!uniform.changed || uniform.broad)
      throw new Error('QA fingerprint must trigger analysis without broad view change');
  });
  await page.selectOption('#perception-provider', 'luna');
  await page.waitForFunction(() =>
    document.querySelector('#luna-config').textContent.includes('Simulador'),
  );
  await page.click('#start');
  await page.waitForFunction(() => window.__spoken.length === 1);
  const initial = await page.evaluate(() => window.__spoken[0]);
  for (const word of ['mesa', 'cadeira', 'pessoa'])
    assert.ok(initial.includes(word), `Initial briefing must acknowledge ${word}`);
  assert.equal(calls, 1);
  report.cases.push(
    'CA-F4/L4: initial briefing acknowledges table, chair and person before repetition checks',
  );
  await page.clock.install();
  const simulatedStart = await page.evaluate(() => performance.now());

  async function capture(next, step, { broad = false } = {}) {
    current = next;
    now += 5000; // Same five-second advance as the browser; below the 15/minute fake gateway ceiling.
    const count = calls;
    const accepted = await page.evaluate(() => window.__online.diagnostics().accepted);
    await page.evaluate(
      ({ step, broad }) => {
        window.__level = step % 2 ? 144 : 80;
        window.__broad = broad;
      },
      { step, broad },
    );
    const response = page.waitForResponse(
      (value) => value.url().endsWith('/api/vision/analyze') && value.request().method() === 'POST',
    );
    await page.clock.fastForward(5000);
    await page.waitForFunction(
      ({ step, broad }) => window.__sampled === `${step % 2 ? 144 : 80}:${broad}`,
      { step, broad },
    );
    const received = await response;
    assert.equal(received.status(), 200);
    await page.waitForFunction(
      (previous) =>
        window.__online.diagnostics().accepted > previous && !window.__online.diagnostics().pending,
      accepted,
    );
    // Complete any synthetic speech before the next clock jump, rather than expiring queued speech.
    await page.clock.runFor(200);
    await page.waitForFunction(
      () => document.querySelector('#speech-state').textContent !== 'Falando',
    );
    assert.equal(calls, count + 1);
    const diagnostic = await page.evaluate(() => window.__online.diagnostics());
    assert.equal(diagnostic.lastError, null);
    return page.evaluate(() => window.__spoken.slice());
  }

  // A single missing frame is followed by presence. It must not retire delivered memory.
  for (let step = 1; step <= 60; step++) {
    const scene = step >= 6 && step <= 7 ? 'biblioteca' : 'sala';
    const spoken = await capture(makeEvidence({ step, scene, omit: step % 7 === 3 }), step);
    const updates = spoken.slice(1);
    assert.ok(
      updates.every((text) => !/mesa|cadeira|pessoa|não identifiquei|não confirmei/iu.test(text)),
      `Repeated references or one-frame absence at capture ${step}`,
    );
    if (step === 7)
      assert.ok(
        updates.some((text) => /biblioteca/iu.test(text)),
        'Confirmed place correction should be spoken alone',
      );
  }
  const stable = await page.evaluate(() => ({
    transcript: window.__spoken.slice(),
    elapsedMs: performance.now(),
  }));
  assert.ok(stable.elapsedMs - simulatedStart >= 300000);
  assert.ok(
    stable.transcript.length <= 2,
    'Five-minute same-view run permits initial briefing and at most one isolated place correction',
  );
  assert.equal(calls, 61);
  report.fiveMinutes = {
    simulatedMs: stable.elapsedMs - simulatedStart,
    analyzedSnapshots: calls,
    speechCount: stable.transcript.length,
    objectRepeatsAfterBriefing: 0,
  };
  report.cases.push(
    'CA-F1/F4/L4: five simulated minutes, 60 changed-pixel captures, alternating IDs/uncertainty and one-frame omissions never repeat delivered objects; confirmed place correction is isolated',
  );

  const beforeNovelty = stable.transcript.length;
  const novelty = await capture(makeEvidence({ step: 61, extra: true }), 61);
  assert.equal(novelty.length, beforeNovelty + 1);
  assert.match(novelty.at(-1), /janela/iu);
  assert.doesNotMatch(novelty.at(-1), /mesa|cadeira|pessoa/iu);
  report.cases.push('CA-F4: a genuinely new window is spoken without repeating known references');

  const beforeRepeatCalls = calls;
  await page.click('[data-ask=repeat]');
  await page.clock.runFor(3000);
  await page.waitForFunction((count) => window.__spoken.length === count + 1, novelty.length);
  assert.equal(calls, beforeRepeatCalls);
  assert.match(await page.evaluate(() => window.__spoken.at(-1)), /janela/iu);
  report.cases.push(
    'CA-F4: explicit Repeat speaks again from delivered memory without another API request',
  );

  await page.click('#start');
  now += 10000;
  current = makeEvidence();
  const stoppedCount = await page.evaluate(() => window.__spoken.length);
  await page.click('#start');
  await page.clock.runFor(1000);
  await page.waitForFunction((count) => window.__spoken.length === count + 1, stoppedCount);
  const restarted = await page.evaluate(() => window.__spoken.at(-1));
  for (const word of ['mesa', 'cadeira', 'pessoa']) assert.ok(restarted.includes(word));
  report.cases.push(
    'CA-F4/L4: Stop/Start creates a fresh briefing and resets session linguistic memory',
  );

  const beforeBroad = await page.evaluate(() => window.__spoken.length);
  const changed = await capture(makeEvidence({ step: 63, shifted: true, extra: true }), 63, {
    broad: true,
  });
  assert.ok(changed.length > beforeBroad);
  assert.match(changed.at(-1), /câmera/iu);
  assert.match(changed.at(-1), /mesa|cadeira|pessoa|janela/iu);
  report.cases.push(
    'CA-F4/L4: broad structural change with substantially shifted positions permits a new-view briefing instead of suppressing references forever',
  );
  report.transcript = await page.evaluate(() => window.__spoken.slice());
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.outsideLoopback, []);
  await page.click('#start');
  await context.close();
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-luna-repetition', { recursive: true });
  await writeFile('artifacts/e2e-luna-repetition/result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
