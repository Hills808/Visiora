import {
  launchTestBrowser,
  createTestContext,
  installTestVoice,
  auditAccessibility,
} from './helpers.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://127.0.0.1:8080';
const fixtureMode = process.argv.includes('--fixtures');
const out = path.resolve('artifacts/e2e');
await mkdir(out, { recursive: true });
const browser = await launchTestBrowser(path.resolve('artifacts/vision/dog.y4m'));
const result = {
  scope:
    'Headless Chrome; public static image as simulated camera; real local YOLOX model; stubbed speech; no real user',
  transport: fixtureMode
    ? 'Local static files fulfilled by test routing; no server/network validation'
    : 'HTTP server',
  cases: [],
  console: [],
  requests: [],
};
try {
  const context = await createTestContext(browser, base, { fixtureMode });
  const page = await context.newPage();
  page.on('pageerror', (error) => result.console.push(error.message));
  page.on('request', (request) =>
    result.requests.push({ method: request.method(), url: request.url() }),
  );
  await installTestVoice(page);
  await page.goto(base);
  await page.waitForSelector('#heading');
  assert.equal(await page.title(), 'Visiora — Seu espaço, em palavras');
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
  await page.screenshot({ path: `${out}/desktop-idle.png`, fullPage: true });
  result.axeByViewport = await auditAccessibility(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile-idle.png`, fullPage: true });
  result.cases.push('initial page, language, desktop/mobile overflow and 44px controls');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.click('#demo');
  await page.waitForFunction(() =>
    document.querySelector('#caption').textContent.includes('Parece uma sala de estar.'),
  );
  assert.match(await page.locator('#source-badge').innerText(), /simulada/);
  await page.locator('.environment-details > summary').click();
  assert.ok(Number(await page.locator('#reference-count').innerText()) > 0);
  await page.screenshot({ path: `${out}/desktop-demo.png`, fullPage: true });
  assert.doesNotMatch(
    await page.locator('#caption').innerText(),
    /possível obstáculo|objeto não identificado/i,
  );
  result.cases.push('demo ambient briefing and equivalent object list');
  await page.click('#search-open');
  await page.fill('#search-input', 'cadeira');
  await page.click('#search-form button[value=search]');
  await page.waitForFunction(
    () =>
      document.querySelector('#caption').textContent.includes('cadeira') &&
      !document.querySelector('#caption').textContent.includes('Parece'),
  );
  result.cases.push('object lookup, fixed direction and explicit response');
  await page.click('#settings-open');
  await page.selectOption('#theme', 'dark');
  await page.check('#large-text');
  await page.check('#keep-history');
  await page.click('#settings-form button[value=save]');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.click('[data-ask=describe]');
  await page.waitForFunction(() => !!localStorage.getItem('visiora.history.v1'));
  await page.click('[data-page=history]');
  assert.ok((await page.locator('#history-list').innerText()).includes('Demonstração simulada'));
  result.cases.push('settings, dark theme, large text and explicit history opt-in');
  if (!fixtureMode) {
    await page.click('[data-page=help]');
    await page.click('#offline');
    await page.waitForFunction(
      () => document.querySelector('#offline-state').textContent.includes('Arquivos preparados'),
      undefined,
      { timeout: 60000 },
    );
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('#heading');
    await context.setOffline(false);
    result.cases.push('explicit offline preparation and reload without network');
  } else
    result.offlineNotTested =
      'HTTP access denied by environment; service workers intentionally blocked in fixture tests';
  if ((await page.locator('#source-badge').innerText()).includes('simulada')) {
    await page.click('[data-page=ambient]');
    await page.click('#demo');
  }
  await page.click('[data-page=ambient]');
  await page.selectOption('#perception-provider', 'local');
  await page.click('#start');
  await page.waitForFunction(
    () => document.querySelector('#source-badge').textContent === 'Câmera local',
    undefined,
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => document.querySelector('#references').textContent.includes('cachorro'),
    undefined,
    { timeout: 60000 },
  );
  assert.doesNotMatch(await page.locator('#references').innerText(), /simulad/i);
  await page.waitForFunction(() => document.querySelector('#caption').textContent.includes('há'));
  assert.doesNotMatch(await page.locator('#caption').innerText(), /passos|metros/);
  await page.screenshot({ path: `${out}/desktop-real-model-fake-camera.png`, fullPage: true });
  result.cases.push(
    'real local YOLOX weights with fake camera image, no fabricated metric distance',
  );
  await page.click('#start');
  assert.equal(await page.locator('#source-badge').innerText(), 'Câmera desligada');
  await page.click('#settings-open');
  await page.click('.data-controls summary');
  await page.click('#clear-open');
  await page.click('#clear-confirm');
  assert.equal(await page.evaluate(() => localStorage.getItem('visiora.history.v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('visiora.preferences.v1')), null);
  result.cases.push('stop camera and delete application data');
  assert.equal(
    result.requests.filter((r) => !r.url.startsWith(base) && !r.url.startsWith('blob:')).length,
    0,
  );
  assert.equal(result.requests.filter((r) => r.method !== 'GET').length, 0);
  assert.deepEqual(result.console, []);
  result.cases.push('no external requests or image uploads in tested flow');
  await page.click('#demo');
  await page.click('#settings-open');
  await page.selectOption('#output', 'reader');
  await page.click('#settings-form button[value=save]');
  await page.click('[data-ask=describe]');
  await page.waitForFunction(() =>
    document.querySelector('#screen-reader').textContent.includes('Parece'),
  );
  const readerText = await page.locator('#screen-reader').textContent();
  await page.click('[data-ask=repeat]');
  await page.waitForFunction(
    (expected) => document.querySelector('#screen-reader').textContent === expected,
    readerText,
  );
  assert.equal(await page.locator('#speech-state').innerText(), 'Descrição em texto');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#source-badge').innerText(), 'Câmera desligada');
  result.cases.push(
    'reader text output, explicit repetition and Escape stop; no real screen reader',
  );
  if (!fixtureMode)
    await page.addScriptTag({
      content: await readFile(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8'),
    });
  const axe = await page.evaluate(() => window.axe.run(document));
  result.axe = axe.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target),
  }));
  assert.equal(result.axe.filter((v) => ['serious', 'critical'].includes(v.impact)).length, 0);
  result.cases.push('axe no serious/critical violations in idle desktop state');
  await context.close();
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.failure = String(error);
  throw error;
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result));
