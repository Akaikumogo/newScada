import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // ── Chunk splitting — separate heavy libs for better caching ──
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':  ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-flow':   ['@xyflow/react'],
          'vendor-radix':  ['@radix-ui/react-slot', '@radix-ui/react-select'],
        },
      },
    },
    // Target modern browsers for smaller output
    target: 'es2020',
  },
  server: {
    port: 3000,
    host: '127.0.0.1',  // bind IPv4 so proxy + browser are on the same stack
    proxy: {
      // Node 17+ resolves "localhost" to IPv6 ::1 first — but the
      // FastAPI backend listens on IPv4 127.0.0.1 only.  Using the
      // numeric address avoids the DNS hop and the IPv4/IPv6 mismatch.
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws':  { target: 'ws://127.0.0.1:8000',  ws: true },
    },
  },
})
