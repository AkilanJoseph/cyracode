import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Several specs drive long real-user flows (full invoice address + 16-digit
    // card number typed keystroke-by-keystroke via userEvent). Those legitimately
    // exceed the 5s default on slower machines, so give them real headroom
    // instead of letting them flake on timing.
    testTimeout: 20000,
    hookTimeout: 20000,
    environmentOptions: {
      jsdom: { url: 'http://localhost:5173' },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/__tests__/**'],
    },
  },
})
