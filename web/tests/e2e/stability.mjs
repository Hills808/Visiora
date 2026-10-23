import { chromium } from '../../node_modules/playwright-core/index.mjs';
import {
  createTestContext,
  installTestVoice,
  captureGeneratedBlobs,
  saveGeneratedBlob,
} from './helpers.mjs';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const minutes = Number(process.env.VISIORA_STRESS_MINUTES ?? 30);
if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30)
  throw new Error('VISIORA_STRESS_MINUTES deve estar entre 1 e 30.');
if (process.platform !== 'win32') throw new Error('A medição de RAM deste roteiro exige Windows.');
const durationMs = minutes * 60_000;
const sampleIntervalMs = 30_000; // Long enough to observe growth without perturbing inference.
const warmupMs = Math.min(2 * 60_000, durationMs / 5); // Excludes model loading and JIT startup.
const base = 'http://127.0.0.1:8080';
const out = path.resolve('artifacts/e2e-stability');
await mkdir(out, { recursive: true });
const browserServer = await chromium.launchServer({
  headless: true,
  executablePath:
    process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${path.resolve('artifacts/vision/dog.y4m')}`,
  ],
});
const browserPid = browserServer.process().pid;
const report = {
  scope:
    'Windows Chrome, public YOLOX dog fixture as camera, real local models, stubbed voice; no physical webcam or user',
  minutes,
  browserPid,
  samples: [],
  pageErrors: [],
  passed: false,
};
let browser;

function privateBytes() {
  const script = `
$rootChrome = ${browserPid}
$items = @(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'")
$processIds = [System.Collections.Generic.HashSet[int]]::new()
[void]$processIds.Add($rootChrome)
do {
  $before = $processIds.Count
  foreach ($item in $items) {
    if ($processIds.Contains([int]$item.ParentProcessId)) { [void]$processIds.Add([int]$item.ProcessId) }
  }
} while ($processIds.Count -gt $before)
$totalBytes = [int64]0
$missingProcesses = 0
foreach ($processId in $processIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -eq $process) { $missingProcesses++ }
  else { $totalBytes += $process.PrivateMemorySize64 }
}
@{ bytes = $totalBytes; processes = $processIds.Count - $missingProcesses; missingProcesses = $missingProcesses } | ConvertTo-Json -Compress
`;
  return JSON.parse(
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }),
  );
}

try {
  browser = await chromium.connect(browserServer.wsEndpoint());
  const context = await createTestContext(browser, base, { fixtureMode: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  await installTestVoice(page);
  await captureGeneratedBlobs(page);
  await page.goto(base);
  await page.selectOption('#perception-provider', 'local');
  await page.click('#start');
  await page.waitForFunction(
    () => document.querySelector('#source-badge')?.textContent === 'Câmera local',
    undefined,
    { timeout: 120_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('#references')?.textContent?.includes('cachorro'),
    undefined,
    { timeout: 120_000 },
  );
  const startedAt = Date.now();
  const endAt = startedAt + durationMs;
  while (Date.now() < endAt) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(sampleIntervalMs, endAt - Date.now())),
    );
    const state = await page.evaluate(() => ({
      source: document.querySelector('#source-badge')?.textContent,
      status: document.querySelector('#status')?.textContent,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
    }));
    const ram = privateBytes();
    const sample = {
      elapsedMs: Date.now() - startedAt,
      ...state,
      privateBytes: ram.bytes,
      processes: ram.processes,
      missingProcesses: ram.missingProcesses,
    };
    report.samples.push(sample);
    console.log(JSON.stringify({ sample }));
    assert.equal(state.source, 'Câmera local');
    assert.match(state.status ?? '', /Câmera ativa/);
    assert.ok(ram.bytes > 0);
    assert.deepEqual(report.pageErrors, []);
  }
  await page.click('[data-page=help]');
  await page.click('.technical summary');
  await page.click('#export-diagnostics');
  await saveGeneratedBlob(page, 'application/json', path.join(out, 'diagnostic.json'));
  const diagnostic = JSON.parse(await readFile(path.join(out, 'diagnostic.json'), 'utf8'));
  report.diagnostic = {
    frames: diagnostic.frames,
    sceneSamples: diagnostic.sceneSamples,
    errors: diagnostic.errors,
    localProvider: diagnostic.localProvider,
  };
  const steady = report.samples.filter((sample) => sample.elapsedMs >= warmupMs);
  const first = steady[0];
  const last = steady.at(-1);
  report.steadyMinPrivateBytes = Math.min(...steady.map((sample) => sample.privateBytes));
  report.steadyMaxPrivateBytes = Math.max(...steady.map((sample) => sample.privateBytes));
  report.ramGrowthPercent =
    first && last ? Math.round((last.privateBytes / first.privateBytes - 1) * 10_000) / 100 : null;
  report.passed =
    diagnostic.frames > 0 &&
    diagnostic.errors === 0 &&
    report.pageErrors.length === 0 &&
    (minutes < 30 || (report.ramGrowthPercent !== null && report.ramGrowthPercent <= 10));
  assert.equal(report.passed, true);
  await context.close();
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await browserServer.close();
}
console.log(
  JSON.stringify({
    passed: report.passed,
    minutes,
    ramGrowthPercent: report.ramGrowthPercent,
    diagnostic: report.diagnostic,
  }),
);
