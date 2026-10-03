const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

let electronApp;
let page;
let testProfile;

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: { ...process.env, PLATFORM_PULSE_TEST: '1' }
  });
  testProfile = await electronApp.evaluate(({ app }) => app.getPath('userData'));
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp?.close();
  if (testProfile) await fs.rm(testProfile, { recursive: true, force: true });
});

test('reports the native operating system', async ({}, testInfo) => {
  await expect(page).toHaveTitle('Platform Pulse');
  await expect(page.getByTestId('platform-name')).not.toHaveText('Loading platform…');

  const platform = await page.locator('body').getAttribute('data-platform');
  expect(['win32', 'darwin', 'linux']).toContain(platform);
  if (process.env.EXPECTED_PLATFORM) expect(platform).toBe(process.env.EXPECTED_PLATFORM);

  await page.screenshot({ path: testInfo.outputPath(`overview-${platform}.png`), fullPage: true });
});

test('runs desktop diagnostics and persists a QA note', async ({}, testInfo) => {
  await page.getByTestId('run-diagnostics').click();
  await expect(page.locator('.diagnostic-row')).toHaveCount(4);
  await expect(page.locator('.diagnostic-row[data-status="pass"]')).toHaveCount(4);

  await page.getByRole('button', { name: /QA note/i }).click();
  const note = `Automated Electron check passed on ${process.platform}.`;
  await page.getByTestId('qa-note').fill(note);
  await page.getByTestId('save-note').click();
  await expect(page.locator('#save-state')).toContainText('Saved');
  await page.screenshot({ path: testInfo.outputPath('saved-note.png'), fullPage: true });
});

