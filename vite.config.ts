import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data': path.resolve(__dirname, '../.tmp'),
    },
  },
  server: {
    port: 3000,
    fs: {
      // Allow serving files from parent directory
      allow: ['..'],
    },
    proxy: {
      // Proxy Anthropic API calls in development to avoid CORS
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/anthropic/, ''),
      },
    },
  },
})
