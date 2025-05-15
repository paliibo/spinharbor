import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

/**
 * E2E suite runs against the real stack (Next dev server + NestJS API + Postgres/Redis from
 * docker compose). Servers are started automatically unless they are already running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1360, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @spinharbor/api dev',
      url: 'http://localhost:4000/health',
      cwd: path.resolve(__dirname, '../..'),
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @spinharbor/web dev',
      url: 'http://localhost:3000',
      cwd: path.resolve(__dirname, '../..'),
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
