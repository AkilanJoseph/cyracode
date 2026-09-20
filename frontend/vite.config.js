import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || '127.0.0.1',
      port: Number(env.VITE_PORT || 5173),
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      // AC 6.7: Split vendor bundles so unchanged deps are served from CDN cache
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-maps': ['leaflet', 'react-leaflet'],
            'vendor-i18n': ['i18next', 'react-i18next'],
            'vendor-misc': ['axios', 'react-hot-toast', 'lucide-react'],
          },
        },
      },
      // AC 6.7: Inline tiny assets as base64 to save round trips; hash-named
      // output files get Cache-Control: immutable from the CDN/Nginx layer.
      assetsInlineLimit: 4096,
      // country-state-city geo datasets (state.json, city.json) are code-split
      // into on-demand chunks via dynamic import() and only fetched when the
      // user selects a country/state. They are large by nature, so raise the
      // warning threshold above the largest (city) chunk rather than warn.
      chunkSizeWarningLimit: 9000,
    },
  }
})
