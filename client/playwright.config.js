import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const client = fileURLToPath(new URL('.', import.meta.url));
const sibling = path.resolve(client, '../../viarena-backend');
const backend = process.env.BACKEND_DIR
  ? path.resolve(process.env.BACKEND_DIR)
  : existsSync(sibling)
    ? sibling
    : path.resolve(client, '../../backend');
process.env.PRODUCTION_BASE_URL = 'http://127.0.0.1:5175';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/browser-test-server.js',
      cwd: backend,
      url: 'http://127.0.0.1:5001/api/health',
      timeout: 180000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://127.0.0.1:5174',
        COOKIE_NAME: 'viarena_browser_test',
      },
    },
    {
      command: 'node scripts/serve.mjs',
      cwd: client,
      url: 'http://127.0.0.1:5175/healthz',
      timeout: 60000,
      reuseExistingServer: false,
      env: { PORT: '5175', API_PROXY_TARGET: 'http://127.0.0.1:5001' },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      cwd: client,
      url: 'http://127.0.0.1:5174',
      timeout: 60000,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5001', VITE_API_BASE_URL: '/api' },
    },
  ],
});
