import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /local-product/,
  outputDir: 'test-results-local',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome', actionTimeout: 20_000,
    baseURL: process.env.ANVESHA_TEST_URL || 'http://127.0.0.1:8000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
