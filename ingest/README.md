# Lemon Ingest V9 — CLI Upload Tool

Upload screenplay PDFs to the Lemon Studios analysis pipeline.

## Architecture

```
You run this CLI
      ↓
Firebase Storage: ingest-queue/{collection}/{uuid}_{filename}.pdf
      ↓
onScreenplayUploaded Cloud Function (creates Firestore job doc)
      ↓
VPS Daemon (execution/ingest_v9.py) picks up job, runs 5-reader analysis
      ↓
Firebase Firestore: uploaded_analyses/{id}  ← SOURCE OF TRUTH
      ↓
Dashboard auto-refreshes (useLiveScreenplaySync)
```

This CLI is a **pure uploader**. It does not call Claude, parse PDFs, or write analysis results. All analysis runs on the VPS.

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up Firebase credentials (one of three options)
#    Option A: Set environment variable pointing to service account JSON
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

#    Option B: Place the service account JSON in the project root
#    (lemon-screenplay-dashboard-firebase-adminsdk-*.json)

#    Option C: Pass it directly
python lemon_ingest.py --service-account /path/to/service-account.json
```

---

## Usage

### Interactive mode (recommended)
```bash
python lemon_ingest.py
```

The CLI will prompt you for:
- **Folder path** — drag & drop a folder into Terminal
- **Category** — collection label (LEMON, BLACK_LIST, ARCHIVE, TEST). Press Enter to use the folder name.
- **Model** — which Claude model the daemon will use (auto = triage-gated)

### Command-line flags
```bash
# Upload a specific folder
python lemon_ingest.py --folder /path/to/scripts --category LEMON

# Use a specific model
python lemon_ingest.py --folder /path/to/scripts --model sonnet

# Dry run (preview without uploading)
python lemon_ingest.py --folder /path/to/scripts --dry-run

# All flags
python lemon_ingest.py \
  --folder /path/to/scripts \
  --category LEMON \
  --model auto \
  --service-account ./service-account.json \
  --dry-run
```

---

## Models

| Model | Cost/Script | Speed | When to Use |
|---|---|---|---|
| `auto` | $0.06–$0.22 | ~2 min | Default. Triage runs first; only promising scripts get full analysis. |
| `haiku` | ~$0.06 | ~1 min | Large batches where speed matters. |
| `sonnet` | ~$0.22 | ~3 min | Best balance of quality and cost. |
| `opus` | ~$0.90 | ~5 min | Premium quality for priority scripts. |

---

## Valid Categories

| Category | Description |
|---|---|
| `LEMON` | Lemon Studios pipeline screenplays |
| `BLACK_LIST` | Black List submissions |
| `ARCHIVE` | Historical archive |
| `TEST` | Test/development uploads |

---

## What Happens After Upload

1. **Storage trigger fires** — `onScreenplayUploaded` Cloud Function creates a job doc in `ingest-queue/` Firestore collection with `status: "pending"`
2. **VPS daemon picks up the job** — `execution/ingest_v9.py` polls `ingest-queue` for pending jobs
3. **Analysis runs** — The daemon runs triage (Haiku, 60s), then if score ≥ 6.0, runs the full 5-reader archaeology analysis (~3–5 min)
4. **Results written to Firestore** — `uploaded_analyses/{id}` is created/updated with the full analysis result
5. **Dashboard refreshes** — `useLiveScreenplaySync` detects the new document and invalidates the React Query cache

---

## Troubleshooting

**"No credentials found"**
→ Set `GOOGLE_APPLICATION_CREDENTIALS` or use `--service-account`

**"Upload failed: 403"**
→ Storage rules require authentication. The service account must have Storage Writer role.

**Script uploaded but not appearing in dashboard after 10 minutes**
→ Check VPS daemon is running: `ssh user@vps "ps aux | grep ingest_v9"`
→ Check Firestore `ingest-queue` collection for the job doc and its status
→ See `VPS_DAEMON.md` for daemon restart instructions

**"not a standard collection" warning**
→ The category you typed isn't in VALID_COLLECTIONS. The upload still works but the daemon may reject it. Use one of: LEMON, BLACK_LIST, ARCHIVE, TEST.
