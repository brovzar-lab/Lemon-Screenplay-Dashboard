import { defineConfig, devices } from '@playwright/test';

const authState = 'playwright/.auth/lemon-user.json';

/**
 * Playwright E2E Test Configuration
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  // Run tests in files in parallel
  fullyParallel: false,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  // Reporter to use
  reporter: 'html',
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium-light',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: authState },
      dependencies: ['auth-setup'],
    },
    {
      name: 'chromium-dark',
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: authState },
      dependencies: ['auth-setup'],
    },
  ],

  // Run preview server before starting the tests
  webServer: {
    command: 'VITE_E2E=true npm run dev -- --host 127.0.0.1',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
