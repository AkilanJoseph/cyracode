import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // AC 6.7: Split vendor bundles so unchanged deps are served from CDN cache
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-maps': ['@react-google-maps/api'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-misc': ['axios', 'react-hot-toast', 'lucide-react'],
        },
      },
    },
    // AC 6.7: Inline tiny assets as base64 to save round trips; hash-named
    // output files get Cache-Control: immutable from the CDN/Nginx layer.
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500,
  },
})
