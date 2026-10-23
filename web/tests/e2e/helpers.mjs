import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

export async function auditAccessibility(page) {
  const script = await readFile(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: script });
  const results = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const smallControls = await page.evaluate(() =>
      [...document.querySelectorAll('button, select')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        })
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map((element) => ({
          id: element.id,
          text: element.textContent.trim().slice(0, 40),
          width: Math.round(element.getBoundingClientRect().width),
          height: Math.round(element.getBoundingClientRect().height),
        })),
    );
    assert.deepEqual(smallControls, [], `Controls smaller than 44px at ${width}px`);
    const axe = await page.evaluate(() => window.axe.run(document));
    const violations = axe.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact))
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      }));
    assert.deepEqual(violations, [], `axe serious/critical at ${width}px`);
    const enhanced = await page.evaluate(() =>
      window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast-enhanced'] } }),
    );
    const enhancedContrast = enhanced.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    }));
    assert.deepEqual(enhancedContrast, [], `Enhanced contrast violations at ${width}px`);
    results.push({ width, violations, enhancedContrast });
  }
  return results;
}

export async function launchTestBrowser(video, extraArgs = []) {
  return chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    downloadsPath: path.resolve('artifacts/browser-downloads'),
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
      ...extraArgs,
    ],
  });
}
export async function createTestContext(browser, base, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ['camera'],
    ...(options.fixtureMode ? { serviceWorkers: 'block' } : {}),
    acceptDownloads: true,
  });
  if (options.fixtureMode)
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base || route.request().method() !== 'GET') {
        await route.abort();
        return;
      }
      if (options.failRequest?.(url)) {
        await route.fulfill({ status: 503, body: 'Intentional QA failure' });
        return;
      }
      const root = path.resolve('dist');
      const file = path.resolve(
        root,
        '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)),
      );
      if (!file.startsWith(root + path.sep)) {
        await route.abort();
        return;
      }
      try {
        const body = await readFile(file);
        const type =
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.mjs': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.wasm': 'application/wasm',
            '.webmanifest': 'application/manifest+json',
          }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, contentType: type, body });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    });
  return context;
}
export async function installTestVoice(page) {
  await page.addInitScript(() => {
    const local = {
      name: 'Synthetic test voice',
      lang: 'pt-BR',
      voiceURI: 'test-local',
      localService: true,
    };
    let generation = 0;
    window.__spoken = [];
    const synth = {
      getVoices: () => [local],
      addEventListener() {},
      cancel() {
        generation++;
      },
      speak(u) {
        const active = generation;
        queueMicrotask(() => {
          if (active !== generation) return;
          u.onstart?.();
          setTimeout(() => {
            if (active === generation) {
              window.__spoken.push(u.text);
              u.onend?.();
            }
          }, 30);
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
}

/** Test transport only: this environment cancels even a minimal native Blob download. */
export async function captureGeneratedBlobs(page) {
  await page.addInitScript(() => {
    window.__qaBlobs = [];
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob) window.__qaBlobs.push(blob);
      return original(blob);
    };
  });
}
export async function saveGeneratedBlob(page, type, destination) {
  const { open } = await import('node:fs/promises');
  await page.waitForFunction((type) => window.__qaBlobs.some((blob) => blob.type === type), type, {
    timeout: 120000,
  });
  const size = await page.evaluate(async (type) => {
    const matches = window.__qaBlobs.filter((blob) => blob.type === type);
    window.__qaBytes = new Uint8Array(await matches.at(-1).arrayBuffer());
    return window.__qaBytes.length;
  }, type);
  const file = await open(destination, 'w');
  try {
    const chunkSize = 2 * 1024 * 1024;
    for (let offset = 0; offset < size; offset += chunkSize) {
      const encoded = await page.evaluate(
        ({ offset, chunkSize }) => {
          const part = window.__qaBytes.subarray(offset, offset + chunkSize);
          const strings = [];
          for (let p = 0; p < part.length; p += 16384)
            strings.push(String.fromCharCode(...part.subarray(p, p + 16384)));
          return btoa(strings.join(''));
        },
        { offset, chunkSize },
      );
      await file.write(Buffer.from(encoded, 'base64'));
    }
  } finally {
    await file.close();
    await page.evaluate(() => {
      window.__qaBytes = null;
    });
  }
  return size;
}
