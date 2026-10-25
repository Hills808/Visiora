import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGateway } from '../../server/gateway.mjs';
import { loadConfig } from '../../server/config.mjs';
import { Budget } from '../../server/budget.mjs';
import { launchTestBrowser, installTestVoice } from './helpers.mjs';

const evidence = {
  scene: { label: 'sala', support: ['a', 'b', 'c'] },
  observations: [
    {
      id: 'a',
      kind: 'object',
      label: 'mesa',
      article: 'uma',
      uncertain: false,
      box: { x: 0.05, y: 0.2, width: 0.1, height: 0.5 },
    },
    {
      id: 'b',
      kind: 'object',
      label: 'cadeira',
      article: 'uma',
      uncertain: false,
      box: { x: 0.45, y: 0.2, width: 0.1, height: 0.5 },
    },
    {
      id: 'c',
      kind: 'person',
      label: 'pessoa',
      article: 'uma',
      uncertain: false,
      box: { x: 0.85, y: 0.2, width: 0.1, height: 0.5 },
    },
  ],
  relations: [],
  limitations: [],
};
let now = Date.now(),
  calls = 0,
  held = false,
  release;
const config = loadConfig({ VISIORA_PROVIDER: 'fake' });
const budget = new Budget(':memory:', config, () => now);
const server = createGateway(config, {
  budget,
  logModel: () => {},
  provider: async () => {
    calls++;
    if (held) await new Promise((resolve) => (release = resolve));
    return { evidence, usage: null };
  },
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const report = {
  passed: false,
  scope:
    'Loopback HTTP, public video as camera, fake API and controlled voice; word counts are not acoustic latency.',
  cases: [],
  profiles: [],
  errors: [],
};
let browser;
try {
  browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
  for (const [profile, max] of [
    ['essential', 25],
    ['balanced', 32],
    ['detailed', 45],
    ['waiting', 32],
  ]) {
    now += 60000;
    const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (e) => report.errors.push(e.message));
      await installTestVoice(page);
      if (profile === 'waiting') await page.clock.install();
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
      await page.click('#settings-open');
      await page.selectOption('#verbosity', profile === 'waiting' ? 'balanced' : profile);
      await page.getByRole('button', { name: 'Salvar ajustes', exact: true }).click();
      const before = calls;
      held = profile === 'waiting';
      release = undefined;
      await page.click('#start');
      if (held) {
        await page.waitForFunction(() => window.__online.diagnostics().pending);
        await page.click('#settings-open');
        // A received response waits behind a real open settings dialog, with no extra API request.
        const deadline = Date.now() + 3000;
        while (!release) {
          if (Date.now() > deadline) throw new Error('Fake provider was not called');
          await new Promise(setImmediate);
        }
        release();
        held = false;
        await page.waitForFunction(() => window.__online.diagnostics().accepted === 1);
        assert.equal(await page.evaluate(() => window.__spoken.length), 0);
        await page.clock.runFor(1500);
        await page.getByRole('button', { name: 'Fechar ajustes', exact: true }).click();
        await page.clock.runFor(250);
      }
      await page.waitForFunction(() => window.__spoken.length === 1);
      const text = await page.evaluate(() => window.__spoken[0]);
      const words = text.trim().split(/\s+/u).length;
      assert.ok(words <= max, `${profile}: ${words} words`);
      assert.match(text, /capturada há.*segundo/);
      assert.match(text, /câmera/);
      if (profile === 'essential') {
        assert.match(text, /cadeira/);
        assert.doesNotMatch(text, /mesa|pessoa/);
      }
      if (profile === 'detailed')
        for (const noun of ['mesa', 'cadeira', 'pessoa']) assert.ok(text.includes(noun));
      const d = await page.evaluate(() => window.__online.diagnostics());
      assert.equal(d.timing.responseToStart.length, 1);
      assert.equal(d.timing.responseToPreparation.length, 1);
      assert.equal(d.lastError, null);
      if (profile === 'waiting') {
        assert.ok(d.timing.responseToPreparation[0].milliseconds >= 1400, JSON.stringify(d.timing));
        assert.ok(d.timing.responseToStart[0].milliseconds >= 1400);
        report.waiting = {
          responseToPreparationMs: d.timing.responseToPreparation[0].milliseconds,
          responseToStartMs: d.timing.responseToStart[0].milliseconds,
          preparationToStartMs: d.timing.preparationToStart[0].milliseconds,
        };
      } else report.profiles.push({ profile, words, text });
      assert.equal(calls, before + 1);
      await page.click('#start');
      report.cases.push(profile);
    } finally {
      release?.();
      await context.close();
    }
  }
  assert.ok(
    report.profiles.find((x) => x.profile === 'balanced').words <
      report.profiles.find((x) => x.profile === 'detailed').words,
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  release?.();
  await browser?.close();
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  report.calls = calls;
  await mkdir('artifacts/e2e-luna-verbosity', { recursive: true });
  await writeFile('artifacts/e2e-luna-verbosity/result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
