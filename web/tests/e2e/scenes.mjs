import {
  launchTestBrowser,
  createTestContext,
  installTestVoice,
  captureGeneratedBlobs,
  saveGeneratedBlob,
} from './helpers.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.VISIORA_TEST_URL || 'http://127.0.0.1:8080';
const out = path.resolve('artifacts/e2e-scenes');
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile('artifacts/scene/browser-fixture.json', 'utf8'));
const browser = await launchTestBrowser(path.resolve('artifacts/scene/browser.y4m'));
const result = {
  scope:
    'Real SigLIP2 q4/WASM and YOLOX with a selected public positive image as fake camera; stubbed voice; fixture HTTP; no real users',
  cases: [],
  requests: [],
  errors: [],
  expected: fixture.expected,
};
let failModel = true;
try {
  const context = await createTestContext(browser, base, {
    fixtureMode: true,
    failRequest: (url) => failModel && url.pathname.endsWith('/siglip2/manifest.json'),
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => result.errors.push(e.message));
  page.on('request', (r) => result.requests.push({ url: r.url(), method: r.method() }));
  await installTestVoice(page);
  await captureGeneratedBlobs(page);
  await page.goto(base);
  await page.selectOption('#perception-provider', 'local');
  await page.click('#start');
  await page.waitForFunction(
    () => document.querySelector('#source-badge').textContent === 'Câmera local',
  );
  await page.waitForFunction(() => !document.querySelector('#scene-retry').hidden);
  assert.equal(await page.locator('#source-badge').innerText(), 'Câmera local');
  result.cases.push('scene-model download failure is explicit and object camera continues');
  failModel = false;
  await page.click('#scene-retry');
  await page.waitForFunction(
    (expected) => document.querySelector('#scene-place').textContent === expected,
    fixture.phrase,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    (expected) => window.__spoken.some((t) => t.includes(expected)),
    fixture.phrase,
    { timeout: 20000 },
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: out + '/scene-recognized.png', fullPage: true });
  assert.doesNotMatch(await page.locator('#scene-place').innerText(), /passos|metros|livre/);
  result.cases.push('retry loads verified real image model; temporal recognition and voice output');
  const before = await page.evaluate(
    (expected) => window.__spoken.filter((t) => t.includes(expected)).length,
    fixture.phrase,
  );
  const start = await page.evaluate(() => performance.now());
  await page.waitForFunction((start) => performance.now() - start >= 7000, start, {
    timeout: 10000,
  });
  const after = await page.evaluate(
    (expected) => window.__spoken.filter((t) => t.includes(expected)).length,
    fixture.phrase,
  );
  assert.equal(after, before);
  await page.click('[data-ask=where]');
  await page.waitForFunction(
    ({ expected, before }) => window.__spoken.filter((t) => t.includes(expected)).length > before,
    { expected: fixture.phrase, before },
  );
  result.cases.push('unchanged scene stays silent; an explicit place query can repeat it');
  // A fixed observation window gathers enough independent scene samples for a latency distribution.
  const spokenBeforeWindow = await page.evaluate(() => window.__spoken.length);
  const benchmarkStart = await page.evaluate(() => performance.now());
  await page.waitForFunction((start) => performance.now() - start >= 60000, benchmarkStart, {
    timeout: 65000,
  });
  assert.equal(await page.evaluate(() => window.__spoken.length), spokenBeforeWindow);
  result.cases.push('one-minute static scene stays silent after the explicit answer');
  await page.click('[data-page=help]');
  await page.click('.technical summary');
  await page.click('#export-diagnostics');
  await saveGeneratedBlob(page, 'application/json', out + '/diagnostic.json');
  result.diagnostic = JSON.parse(await readFile(out + '/diagnostic.json', 'utf8'));
  assert.ok(result.diagnostic.sceneSamples >= 2);
  assert.ok(result.diagnostic.sceneInferenceLatencyMs.length >= 25);
  assert.equal(
    result.diagnostic.sceneResponseLatencyMs.length,
    result.diagnostic.sceneInferenceLatencyMs.length,
  );
  assert.equal(
    result.diagnostic.localResponseLatencyMs.length,
    result.diagnostic.inferenceLatencyMs.length,
  );
  assert.ok(result.diagnostic.sceneResponseLatencyMs.every((value) => value >= 0));
  await page.click('[data-page=ambient]');
  await page.click('#start');
  assert.equal(await page.locator('#source-badge').innerText(), 'Câmera desligada');
  result.cases.push('local diagnostics include scene timing and stopping clears the scene');
  await page.click('[data-page=help]');
  await page.click('#local-download');
  result.zipBytes = await saveGeneratedBlob(page, 'application/zip', out + '/visiora-browser.zip');
  result.nativeDownloadNotTested =
    'Environment cancels even a minimal about:blank Blob download. QA copies generated bytes; no native download-save verification.';
  result.cases.push('complete offline ZIP generated in-browser from static assets');
  assert.equal(
    result.requests.some((r) => !r.url.startsWith(base) || r.method !== 'GET'),
    false,
  );
  assert.deepEqual(result.errors, []);
  result.cases.push('tested flow has no external page requests or uploads');
  const cpuContext = await createTestContext(browser, base, { fixtureMode: true });
  try {
    await cpuContext.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: { requestAdapter: async () => null },
      });
    });
    await installTestVoice(cpuContext);
    const cpuPage = await cpuContext.newPage();
    await cpuPage.goto(base);
    await cpuPage.selectOption('#perception-provider', 'local');
    await cpuPage.click('#start');
    await cpuPage.waitForFunction(
      (expected) => document.querySelector('#scene-place').textContent === expected,
      fixture.phrase,
      { timeout: 120000 },
    );
    result.cases.push(
      'same scene is recognized after WebGPU initialization fails and WASM is used',
    );
  } finally {
    await cpuContext.close();
  }
  result.passed = true;
  await context.close();
} catch (error) {
  result.passed = false;
  result.failure = String(error);
  throw error;
} finally {
  await writeFile(out + '/result.json', JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({ passed: result.passed, cases: result.cases, diagnostic: result.diagnostic }),
);
