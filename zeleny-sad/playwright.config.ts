import { defineConfig, devices } from '@playwright/test';

// Emulation only: WebKit with iPhone viewports/user agents. This is not a real iPhone.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'iphone-13-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-se-webkit', use: { ...devices['iPhone SE'] } },
    { name: 'pixel-7-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
