import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'module'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

const localReviewPath = '/__local-review/session'

interface LocalReviewAdminApp {
  name: string
}

interface LocalReviewAdminAppModule {
  cert(serviceAccount: Record<string, unknown>): unknown
  getApps(): LocalReviewAdminApp[]
  initializeApp(options: { credential: unknown }, name: string): LocalReviewAdminApp
}

interface LocalReviewUser {
  uid: string
  email?: string
  emailVerified: boolean
  displayName?: string
}

interface LocalReviewAdminAuth {
  getUserByEmail(email: string): Promise<LocalReviewUser>
  createCustomToken(uid: string): Promise<string>
}

interface LocalReviewAdminAuthModule {
  getAuth(app: LocalReviewAdminApp): LocalReviewAdminAuth
}

function isLoopbackRequest(request: IncomingMessage): boolean {
  const hostname = (request.headers.host ?? '').split(':')[0]
  const remoteAddress = request.socket.remoteAddress ?? ''
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isLocalPeer =
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'

  return isLocalHost && isLocalPeer
}

function localReviewAuth(): Plugin {
  return {
    name: 'local-review-auth',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(localReviewPath, async (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }

        const origin = request.headers.origin ?? ''
        const allowedOrigin =
          origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000'
        const requestedByApp = request.headers['x-lemon-local-review'] === '1'

        if (!isLoopbackRequest(request) || !allowedOrigin || !requestedByApp) {
          response.statusCode = 403
          response.end('Local review sign-in is available only from this Mac.')
          return
        }

        try {
          const { cert, getApps, initializeApp } = require(
            './functions/node_modules/firebase-admin/lib/app/index.js',
          ) as LocalReviewAdminAppModule
          const { getAuth } = require(
            './functions/node_modules/firebase-admin/lib/auth/index.js',
          ) as LocalReviewAdminAuthModule
          const credentialPath =
            process.env.GOOGLE_APPLICATION_CREDENTIALS ??
            path.resolve(__dirname, 'service-account.json')

          if (!fs.existsSync(credentialPath)) {
            throw new Error('The local Firebase service account is not configured.')
          }

          const serviceAccount = JSON.parse(
            fs.readFileSync(credentialPath, 'utf8'),
          ) as Record<string, unknown>
          const existing = getApps().find((app) => app.name === 'local-review-auth')
          const adminApp =
            existing ??
            initializeApp({ credential: cert(serviceAccount) }, 'local-review-auth')
          const adminAuth = getAuth(adminApp)
          const email = process.env.LEMON_LOCAL_REVIEW_EMAIL ?? 'billy@lemonfilms.com'
          const user = await adminAuth.getUserByEmail(email)

          if (!user.emailVerified || !user.email?.endsWith('@lemonfilms.com')) {
            throw new Error('The local review account is not a verified Lemon account.')
          }

          const token = await adminAuth.createCustomToken(user.uid)
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify({ token, displayName: user.displayName ?? 'Billy' }))
        } catch (error) {
          server.config.logger.error(
            error instanceof Error ? error.message : 'Local review sign-in failed.',
          )
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify({ error: 'Local review sign-in is unavailable.' }))
        }
      })
    },
  }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function releaseMetadata(): Plugin {
  return {
    name: 'release-metadata',
    generateBundle() {
      const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      const sourceClean = execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
      }).trim() === ''
      const catalog = fs.readFileSync(
        path.resolve(__dirname, 'src/config/anthropic-model-catalog.json'),
      )
      const hostingConfig = fs.readFileSync(path.resolve(__dirname, 'firebase.json'))
      this.emitFile({
        type: 'asset',
        fileName: 'release.json',
        source: JSON.stringify({
          git_sha: gitSha,
          source_clean: sourceClean,
          catalog_sha256: sha256(catalog),
          build_timestamp: new Date().toISOString(),
          hosting_config_sha256: sha256(hostingConfig),
        }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localReviewAuth(),
    releaseMetadata(),
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
          // Split heavy deps out of main bundle for better caching
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'vendor-pdfjs': ['pdfjs-dist'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
      // Scope to only the .tmp data directory (for @data alias) + project root.
      // Previously `['..']` allowed the full parent directory to be served.
      allow: [path.resolve(__dirname, '../.tmp'), __dirname],
    },
    // Anthropic calls use the Firebase llmProxy, which invokes Anthropic's official SDK directly.
  },
})
