import {
  launchTestBrowser,
  createTestContext,
  installTestVoice,
  captureGeneratedBlobs,
  saveGeneratedBlob,
} from './helpers.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:8080',
  out = path.resolve('artifacts/e2e-people');
await mkdir(out, { recursive: true });
const browser = await launchTestBrowser(path.resolve('artifacts/recognition-upgrade/people.y4m'));
let cpuBrowser;
const result = {
  scope:
    'Selected public COCO23899 image as fake camera, real local models, GPU/CPU provider check, stubbed voice, fixture transport; integration only, no accuracy or live camera claim',
  cases: [],
  errors: [],
};
try {
  const context = await createTestContext(browser, base, { fixtureMode: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => result.errors.push(e.message));
  await installTestVoice(page);
  await captureGeneratedBlobs(page);
  await page.goto(base);
  await page.locator('.environment-details > summary').click();
  await page.selectOption('#perception-provider', 'local');
  await page.click('#start');
  await page.waitForFunction(
    () => document.querySelector('#references').textContent.includes('pessoa'),
    undefined,
    { timeout: 120000 },
  );
  result.cases.push('person consensus reaches the real app object memory');
  result.gpuReferences = await page.locator('#references').innerText();
  result.gpuStatus = await page.locator('#status').innerText();
  assert.match(result.gpuStatus, /visão local na (GPU|CPU)/);
  await page.click('[data-ask=describe]');
  await page.waitForFunction(() => window.__spoken.some((t) => t.includes('pessoa')), undefined, {
    timeout: 30000,
  });
  assert.doesNotMatch(await page.locator('#caption').innerText(), /passos|metros/);
  assert.match(await page.locator('#caption-age').innerText(), /Última descrição/);
  result.cases.push('person description reaches output without fabricated depth and shows its age');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: out + '/mobile-people.png', fullPage: true });
  result.cases.push('mobile layout including description age has no horizontal overflow');
  await page.click('[data-page=help]');
  await page.click('.technical summary');
  await page.click('#export-diagnostics');
  await saveGeneratedBlob(page, 'application/json', out + '/diagnostic.json');
  result.diagnostic = JSON.parse(await readFile(out + '/diagnostic.json', 'utf8'));
  assert.ok(result.diagnostic.frames >= 3);
  assert.equal(result.diagnostic.rejectedFrames, 0);
  assert.ok(result.diagnostic.inferenceLatencyMs.every((ms) => ms <= 3000));
  assert.ok(['webgpu', 'wasm'].includes(result.diagnostic.localProvider));
  assert.ok(result.diagnostic.recognitionProvenance.lastAcceptedObjectFrame.frameId >= 3);
  assert.deepEqual(result.errors, []);
  result.cases.push(
    'accepted frames retain numeric provenance and the measured object pipeline stays below 3s',
  );
  await page.click('[data-page=ambient]');
  await page.click('#start');
  assert.equal(await page.locator('#caption-age').innerText(), '');
  result.cases.push('stopping clears description-age state');
  await context.close();

  cpuBrowser = await launchTestBrowser(path.resolve('artifacts/recognition-upgrade/people.y4m'), [
    '--disable-gpu',
  ]);
  const cpuContext = await createTestContext(cpuBrowser, base, { fixtureMode: true });
  const cpuPage = await cpuContext.newPage();
  await cpuPage.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => null },
    });
  });
  await installTestVoice(cpuPage);
  await captureGeneratedBlobs(cpuPage);
  await cpuPage.goto(base);
  await cpuPage.locator('.environment-details > summary').click();
  await cpuPage.selectOption('#perception-provider', 'local');
  await cpuPage.click('#start');
  await cpuPage.waitForFunction(
    () => document.querySelector('#references').textContent.includes('pessoa'),
    undefined,
    { timeout: 120000 },
  );
  await cpuPage.click('[data-page=help]');
  await cpuPage.click('.technical summary');
  await cpuPage.click('#export-diagnostics');
  await saveGeneratedBlob(cpuPage, 'application/json', out + '/diagnostic-cpu.json');
  result.cpuFallback = JSON.parse(await readFile(out + '/diagnostic-cpu.json', 'utf8'));
  result.cpuReferences = await cpuPage.locator('#references').innerText();
  result.cpuStatus = await cpuPage.locator('#status').innerText();
  assert.equal(result.cpuFallback.localProvider, 'wasm');
  assert.match(result.cpuStatus, /visão local na CPU/);
  assert.ok(result.cpuFallback.frames > 0);
  assert.equal(
    result.cpuReferences.replaceAll(/\s+/g, ''),
    result.gpuReferences.replaceAll(/\s+/g, ''),
  );
  result.cases.push('failed WebGPU initialization keeps real detection on WASM');
  await cpuContext.close();
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.failure = String(error);
  throw error;
} finally {
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  if (cpuBrowser) await cpuBrowser.close();
  await browser.close();
}
console.log(JSON.stringify(result));
