import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Skip .DS_Store files during public dir copy (macOS EPERM fix)
    {
      name: 'skip-ds-store',
      generateBundle() {
        const publicDir = path.resolve(__dirname, 'public');
        const copyRecursive = (src: string) => {
          let entries;
          try {
            entries = fs.readdirSync(src, { withFileTypes: true });
          } catch {
            return;
          }
          for (const entry of entries) {
            if (entry.name === '.DS_Store') continue;
            const srcPath = path.join(src, entry.name);
            const relPath = path.relative(publicDir, srcPath);
            if (entry.isDirectory()) {
              copyRecursive(srcPath);
            } else {
              try {
                const content = fs.readFileSync(srcPath);
                this.emitFile({ type: 'asset', fileName: relPath, source: content });
              } catch {
                // Skip files we can't read (macOS protection)
              }
            }
          }
        };
        copyRecursive(publicDir);
      },
    },
  ],
  build: {
    // Prevent EPERM on macOS-protected .DS_Store files in dist/
    emptyOutDir: false,
    copyPublicDir: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — changes rarely, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting — loaded lazily with AnalyticsDashboard
          'vendor-recharts': ['recharts'],
          // PDF rendering — only used in export feature
          'vendor-react-pdf': ['@react-pdf/renderer'],
          // State management
          'vendor-state': ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
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
