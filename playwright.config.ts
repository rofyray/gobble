import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 3210;
const dataDir = process.env.GOBBLE_E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), 'gobble-e2e-'));
process.env.GOBBLE_E2E_DATA_DIR = dataDir;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { GOBBLE_DATA_DIR: dataDir, GOBBLE_AGENT_TOKEN: '', KV_REST_API_URL: '', UPSTASH_REDIS_REST_URL: '' },
  },
});
