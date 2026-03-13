# External Integrations

**Analysis Date:** 2026-03-13

## APIs & External Services

**Screenplay Analysis:**
- Anthropic API (https://api.anthropic.com/v1/messages)
  - Purpose: Analyzes screenplay PDFs using Claude models (sonnet, haiku, opus)
  - SDK/Client: HTTP fetch with custom headers
  - Auth: `x-api-key` header (user-provided via Settings)
  - Configuration: `anthropic-dangerous-direct-browser-access` header enables browser CORS
  - Models: `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-opus-4-6`
  - Dev: Proxied via Vite at `/api/anthropic` (configured in `vite.config.ts` line 82-88)
  - Env var: `ANTHROPIC_API_KEY` (user enters in Settings → API Configuration)

**Poster Generation:**
- Google Gemini API (https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent)
  - Purpose: Generates cinematic movie posters from screenplay metadata
  - SDK/Client: HTTP fetch with API key
  - Auth: `key` query parameter (user-provided via Settings)
  - Model: `gemini-2.5-flash-image`
  - Response: Base64-encoded PNG image
  - Caching: Existing posters cached in Firebase Storage path `Posters/{screenplayId}.png`
  - Env var: `GOOGLE_API_KEY` (user enters in Settings → API Configuration)
  - Error handling: If API key missing, throws `GOOGLE_API_KEY_MISSING` error

## Data Storage

**Databases:**
- Firestore (Firebase) - Primary data store
  - Connection: Native Firebase SDK (`getFirestore()`)
  - Collection: `uploaded_analyses` (screenplay analysis results)
  - Documents: One per analysis, keyed by sanitized source filename
  - Client: `firebase/firestore` (setDoc, getDocs, deleteDoc, collection, query)
  - Dual-write pattern: localStorage for instant reads, Firestore syncs in background
  - Firestore config: `src/lib/firebase.ts` lines 14-32

**File Storage:**
- Firebase Storage
  - Purpose: PDFs (`screenplays/{category}/{filename}.pdf`), posters (`Posters/{screenplayId}.png`)
  - Client: `firebase/storage` (uploadBytes, getDownloadURL, ref, getBlob)
  - Upload paths: `screenplays/{category}/{sanitized_title}.pdf`
  - Metadata: originalFilename, category, uploadedAt (custom metadata on PDFs)
  - Download: Direct URL returned after upload

**Caching:**
- Browser localStorage
  - `lemon-local-analyses` - Analysis results (primary for reads, instant access)
  - `lemon-api-config` - API configuration (persisted Zustand store)
  - Migration key: `lemon-migration-v6-done` - Tracks data format migrations
  - Dual-write: Firestore syncs happen asynchronously after localStorage write

## Authentication & Identity

**Auth Provider:**
- Custom (user-provided API keys)
  - Anthropic: API key entry in Settings panel (`src/components/settings/ApiConfigPanel.tsx`)
  - Google: API key entry in Settings panel (same location)
  - No OAuth or identity provider
  - Keys stored in localStorage under `lemon-api-config` store
  - Keys never baked into production bundle (Zustand migration handles leaked key cleanup in v2)

**Firebase Security:**
- Firestore Rules: `firestore.rules` (read-only, defined in Firebase console)
- Storage Rules: `storage.rules` (read-only, defined in Firebase console)
- App Check (reCAPTCHA v3): Currently disabled (see `src/lib/firebase.ts` comment — mismatch between client and console provider caused 400 errors)

## Monitoring & Observability

**Error Tracking:**
- None - Console logging only

**Logs:**
- Browser console
  - Analysis progress: `[Lemon]` prefix
  - Firebase uploads: `[Firebase Storage]` prefix
  - Poster generation: `[Poster]` prefix
  - Warnings on non-critical failures (e.g., PDF upload fails, poster upload fails)

**Firebase Logging:**
- Firebase Cloud Functions logs available via Firebase Console
- Handled by firebase-functions runtime

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting (automatic from `npm run deploy`)
- Config: `firebase.json` (public: dist/)
- Rewrites: `/api/analyze` → Cloud Function `analyzeScreenplay`
- Cache headers: JSON no-cache, JS 1 year

**CI Pipeline:**
- None detected - Manual deployment via `npm run deploy`

**Build Pipeline:**
```bash
npm run build          # tsc -b && vite build
npm run deploy         # build + firebase deploy --only hosting
```

**Cloud Functions Deployment:**
- `firebase deploy --only functions` (manual or via main deploy)
- Runtime: Node.js 20
- Source: `functions/src/` → `functions/lib/` (compiled TypeScript)

## Environment Configuration

**Required env vars:**
- User-provided (via Settings panel, stored in localStorage):
  - `ANTHROPIC_API_KEY` - For screenplay analysis
  - `GOOGLE_API_KEY` - For poster generation (optional)
  - `API_ENDPOINT` - Custom Anthropic endpoint (optional, defaults to https://api.anthropic.com/v1/messages)

**Optional runtime config:**
- `VITE_*` prefix env vars during build (read-only in code)
- `import.meta.env.DEV` - Detected at runtime to choose Vite proxy vs. direct API calls

**Secrets location:**
- All API keys stored in localStorage only (never env vars or .env files)
- Firebase config is public (hardcoded in `src/lib/firebase.ts`)
- Cloud Functions: API keys read from request body or environment (via Firebase Console)

**Firebase Config (hardcoded, public):**
```
projectId: "lemon-screenplay-dashboard"
apiKey: AIzaSyBN_JWOlHSeu5nbcqY47fkY-9NDd2lIA00
authDomain: lemon-screenplay-dashboard.firebaseapp.com
storageBucket: lemon-screenplay-dashboard.firebasestorage.app
```

## Webhooks & Callbacks

**Incoming:**
- `/api/analyze` - Cloud Function endpoint for screenplay analysis
  - Triggered by: Upload modal (direct fetch to Cloud Function or Vite proxy)
  - Request: POST JSON with PDF text, metadata, lenses, API key
  - Response: V6 analysis wrapper JSON

**Outgoing:**
- None - No external webhooks

## API Rate Limiting & Budget Controls

**Anthropic API:**
- Budget management via `apiConfigStore`:
  - `monthlyBudgetLimit` (default: $50)
  - `dailyRequestLimit` (default: 100)
  - Current tracking: `currentMonthSpend`, `currentDayRequests`
  - Resets: Daily at midnight UTC, monthly at 1st of month
  - Enforcement: `canMakeRequest()` checks before API call

**Google Gemini API:**
- No built-in rate limiting in UI
- Relies on Google quota limits

## PDF Processing

**PDF Parsing:**
- pdfjs-dist 5.4.624 - Client-side extraction
- Function: `parsePDF(file, onProgress)` in `src/lib/pdfParser.ts`
- Output: Text, metadata (title, page count, word count)
- Used for: Screenplay text extraction before API call

**PDF Upload:**
- Firebase Storage
- Automatic upload after successful analysis (non-blocking)
- Path: `screenplays/{category}/{sanitized_filename}.pdf`
- Re-analysis: PDFs fetched from Storage via `getBlob()` (bypasses CORS)

## Data Flow (End-to-End)

```
1. User uploads PDF → Parse via pdfjs-dist
2. Send parsed text to Anthropic API (dev: Vite proxy, prod: direct + CORS header)
3. Claude returns analysis JSON → Wrap in V6 format
4. Save to localStorage (instant) + Firestore (async)
5. Upload original PDF to Firebase Storage (background, non-blocking)
6. For posters: Generate via Gemini → Upload to Storage → Return URL
7. Firestore syncs to Cloud Functions for future re-analysis
```

---

*Integration audit: 2026-03-13*
