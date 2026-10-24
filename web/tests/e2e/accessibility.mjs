import { chromium } from '../../node_modules/playwright-core/index.mjs';
import { createTestContext, auditAccessibility } from './helpers.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

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
    await mkdir('artifacts/visual-redesign', { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'artifacts/visual-redesign/desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/visual-redesign/mobile.png', fullPage: true });
    const details = page.locator('.environment-details');
    assert.equal(await details.getAttribute('open'), null);
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.notEqual(await details.getAttribute('open'), null);
    assert.equal(await page.locator('#scene-place').isVisible(), true);
    await page.locator('.analysis-details > summary').click();
    const expanded = await auditAccessibility(page);
    await page.click('#settings-open');
    await page.getByText('Giros da câmera · experimental', { exact: true }).click();
    const motionSettings = await auditAccessibility(page);
    await page.selectOption('#theme', 'dark');
    await page.check('#large-text');
    await page.click('#settings-form button[value=save]');
    const darkLarge = await auditAccessibility(page);
    await page.screenshot({ path: 'artifacts/visual-redesign/dark-large.png', fullPage: true });
    console.log(
      JSON.stringify({
        passed: true,
        viewports,
        expanded,
        darkLarge,
        motionSettings,
        keyboardDisclosure: true,
        screenshots: 'artifacts/visual-redesign',
      }),
    );
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
