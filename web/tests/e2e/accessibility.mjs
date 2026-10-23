import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { createTestContext, auditAccessibility } from './helpers.mjs';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8080';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined),
});
try {
  const context = await createTestContext(browser, base, { fixtureMode: true });
  try {
    const page = await context.newPage();
    await page.goto(base);
    await page.waitForSelector('#heading');
    assert.equal(await page.title(), 'Visiora — Seu espaço, em palavras');
    assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
    const viewports = await auditAccessibility(page);
    console.log(JSON.stringify({ passed: true, viewports }));
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
