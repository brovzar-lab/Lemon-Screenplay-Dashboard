# lemon-ingest — CLI Bulk Screenplay Analyzer

## Goal
A single-file Node.js CLI script that bulk-analyzes PDF screenplays through Anthropic's Claude API, saves results to Firestore + local JSON backup, supports pause/resume, and generates a markdown summary report.

## Usage
```bash
node scripts/lemon-ingest.mjs <folder> [options]

Options:
  --model <model>       sonnet (default), haiku, opus, hybrid
  --category <name>     Override all categories to this label (default: folder name)
  --api-key <key>       Anthropic API key (skips interactive prompt)
  --dry-run             Estimate cost/time without processing
  --resume              Resume interrupted run from saved state
  --concurrency <n>     Parallel requests (default: 1, max: 5)
```

## Architecture

Single file: `scripts/lemon-ingest.mjs`
- ES module, runs with `node` directly
- Imports from project: pdfjs-dist (PDF parsing), firebase SDK (Firestore + Storage)
- No additional dependencies beyond what's in package.json

## Flow

### 1. Startup
- Parse CLI args
- Resolve API key: `--api-key` flag > `ANTHROPIC_API_KEY` env var > interactive prompt (shows masked saved key, option to enter new one)
- Validate API key format (`sk-ant-*`)
- Scan folder recursively for `.pdf` files
- Build queue: each PDF gets `{ path, filename, category }` where category = subfolder name (uppercased) or `--category` override. Flat files use parent folder name.

### 2. Dry Run (always runs first)
- Parse each PDF: extract page count, word count (via pdfjs-dist, same as existing `parsePDF`)
- Truncate at 150,000 chars (matching existing limit)
- Calculate cost estimate per model:
  - haiku: ~$0.06/script
  - sonnet: ~$0.22/script
  - opus: ~$0.90/script
  - hybrid: $0.22–$1.12/script (depends on promotion rate, estimate 20% promotion)
- Display summary table: total scripts, total pages, estimated cost range, estimated time
- Prompt: "Proceed? (y/n)"
- If `--dry-run` flag, exit after showing estimate

### 3. Processing Queue
- Process scripts sequentially (one at a time)
- For each script:
  1. Parse PDF → extract text, page count, word count
  2. Call Anthropic API directly (same endpoint/headers as `analysisService.ts`)
  3. **Hybrid mode**: If verdict contains "recommend"/"film_now"/"film now" (case-insensitive), re-analyze with Opus
  4. Save to Firestore (`uploaded_analyses` collection, same format as browser)
  5. Save local JSON backup to `<folder>/output/<filename>.json`
  6. Upload PDF to Firebase Storage (`screenplays/<CATEGORY>/<TITLE>.pdf`)
  7. Print progress line: `[42/500] ✓ "Die Hard Remake" → RECOMMEND (87.5) — $0.22 — 2m31s`
  8. Hybrid promotion: `[42/500] ★ "Die Hard Remake" → RECOMMEND (92.1) — $1.12 [promoted to Opus] — 5m14s`

### 4. Error Handling & Retry
- On failure: retry up to 3 times with exponential backoff (5s, 15s, 45s)
- Retry triggers: HTTP 429 (rate limit), 500/502/503 (server error), network timeouts
- Do NOT retry: 400 (bad request), 401 (invalid key), 413 (too large)
- After 3 retries: log failure, skip script, continue queue
- All failures collected for summary report

### 5. Resume Support
- State file: `<folder>/.lemon-ingest-state.json`
- Contains: `{ completed: [filenames], failed: [filenames], apiKeyUsed: { "sk-***abc": [filenames] }, startedAt, model }`
- On `--resume`: skip already-completed scripts, retry failed ones
- State file updated after each script completes
- Supports switching API key on resume (tracked per-script for billing)

### 6. Summary Report
- Saved to `<folder>/lemon-ingest-report.md` on completion
- Contents:
  - Run metadata (date, model, folder, duration)
  - Totals: processed / failed / skipped
  - Verdict breakdown: FILM NOW, RECOMMEND, CONSIDER, PASS (with counts and percentages)
  - Cost breakdown per API key (for split billing)
  - Hybrid promotions list (which scripts got Opus re-analysis)
  - Top 10 scripts by weighted score
  - Failures with error reasons
  - Per-category breakdown

## API Integration

### Anthropic API (Direct)
```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <key>
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
  model: claude-sonnet-4-5-20250929 | claude-haiku-4-5-20251001 | claude-opus-4-6
  max_tokens: 16000
  messages: [{ role: "user", content: <prompt> }]
```

### Prompt
Reuse the exact prompt from `functions/src/prompts.ts` — the `buildAnalysisPrompt(text, metadata, lenses)` function. Import or inline it.

### Model IDs
```
sonnet → claude-sonnet-4-5-20250929
haiku  → claude-haiku-4-5-20251001
opus   → claude-opus-4-6
```

### Hybrid Logic
```
1. Analyze with Sonnet
2. Parse response JSON
3. If analysis.core_quality.verdict contains "recommend" or "film_now" or "film now":
   → Re-analyze same text with Opus
   → Use Opus result as final
4. Track both costs
```

## Firestore Integration

### Save Analysis
- Collection: `uploaded_analyses`
- Doc ID: sanitized source_file (same as `toDocId()` in analysisStore)
- Document format: matches existing V6 format exactly
- Include: `analysis_model`, `analysis_version: "v6_unified"`, `source_file`, `metadata`, `analysis`, `usage`
- Use Firebase Admin SDK or client SDK with anonymous auth (same as browser)

### Upload PDF
- Path: `screenplays/<CATEGORY>/<SANITIZED_TITLE>.pdf`
- Non-blocking: don't fail analysis if storage upload fails

## Output

### Progress (stdout)
```
🍋 lemon-ingest — Bulk Screenplay Analyzer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Model: hybrid | Scripts: 500 | Est. cost: $110–$340 | Est. time: ~25h
API Key: sk-ant-****...abc123
Proceed? (y/n): y

[  1/500] ✓ "The Last Frontier"        → CONSIDER  (72.3) — $0.22 — 2m14s
[  2/500] ★ "Midnight in Lagos"        → RECOMMEND (89.1) — $1.12 [promoted] — 5m31s
[  3/500] ✗ "Untitled Drama"           → FAILED (retry 3/3: timeout) — skipped
[  4/500] ✓ "Fast & Furious 15"        → PASS      (45.2) — $0.22 — 1m58s
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Complete: 497/500 | ✗ Failed: 3 | Cost: $156.42 | Time: 22h 14m
Report saved: ~/Downloads/new-scripts/lemon-ingest-report.md
```

### Local JSON backup
```
<folder>/output/
  the-last-frontier.json
  midnight-in-lagos.json
  ...
```

### Report (markdown)
```markdown
# Lemon Ingest Report
**Date:** 2026-03-24 | **Model:** hybrid | **Duration:** 22h 14m

## Summary
| Metric | Value |
|--------|-------|
| Total scripts | 500 |
| Processed | 497 |
| Failed | 3 |
| Total cost | $156.42 |

## Verdicts
| Verdict | Count | % |
|---------|-------|---|
| FILM NOW | 2 | 0.4% |
| RECOMMEND | 48 | 9.7% |
| CONSIDER | 189 | 38.0% |
| PASS | 258 | 51.9% |

## Cost by API Key
| Key | Scripts | Cost |
|-----|---------|------|
| sk-***abc123 | 300 | $89.40 |
| sk-***xyz789 | 197 | $67.02 |

## Hybrid Promotions (12 scripts)
| # | Title | Sonnet Score | Opus Score | Verdict |
|---|-------|-------------|------------|---------|
| 1 | Midnight in Lagos | 85.2 | 89.1 | RECOMMEND |
...

## Top 10 by Score
...

## Failures (3)
| Title | Error | Retries |
|-------|-------|---------|
| Untitled Drama | Timeout after 540s | 3 |
...
```
