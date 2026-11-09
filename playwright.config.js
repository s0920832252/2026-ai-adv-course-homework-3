const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 180000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    browserName: 'chromium',
    headless: true,
    actionTimeout: 20000,
    launchOptions: { slowMo: Number(process.env.E2E_SLOW_MO || 0) }
  },
  // Intentionally no webServer: E2E must use the already-running application.
  outputDir: 'test-results'
});
