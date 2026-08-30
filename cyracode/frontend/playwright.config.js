import { defineConfig, devices } from '@playwright/test'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'python3 -m uvicorn app.main:app --port 8000',
      cwd: '../backend',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: 'npm run dev',
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
