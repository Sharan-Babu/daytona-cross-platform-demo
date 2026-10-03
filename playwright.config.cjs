const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: '**/electron.spec.cjs',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'artifacts/live/playwright-results.json' }]
  ],
  use: {
    trace: 'on',
    screenshot: 'on'
  },
  outputDir: 'test-results'
});

