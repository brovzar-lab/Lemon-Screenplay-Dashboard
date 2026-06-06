# VPS Daemon — Operations Reference

The VPS daemon is the analysis engine of V9. It polls Firestore for queued
screenplay jobs and runs the 5-reader archaeology analysis via the Anthropic API.

**Source of truth:** Firebase Firestore `uploaded_analyses` collection.

---

## Daemon Location

| Item | Path |
|---|---|
| Script | `execution/ingest_v9.py` (on VPS) |
| VPS | Hostinger |
| Firestore project | `lemon-screenplay-dashboard` |

---

## How It Works

```
Firestore: ingest-queue/{jobId} { status: "pending" }
      ↓ daemon polls every 30s
VPS daemon picks up job
      ↓
Downloads PDF from Firebase Storage
      ↓
Runs triage (Haiku) — if score < 6.0, marks job "pass_triage_only"
      ↓
Runs 5-reader analysis in parallel (Structure, Character, Craft, Concept, Emotion)
      ↓
Runs synthesis roundtable
      ↓
Writes result to Firestore: uploaded_analyses/{newId}
      ↓
Updates job doc: ingest-queue/{jobId} { status: "complete" }
      ↓
Dashboard refreshes automatically
```

---

## Checking Daemon Status

```bash
# SSH to VPS
ssh user@vps.hostinger.com

# Check if daemon is running
ps aux | grep ingest_v9

# View live logs (if running with nohup)
tail -f /var/log/lemon-ingest.log

# Check daemon's Firestore connection
# (daemon logs will show "Polling for pending jobs..." every 30s)
```

---

## Restarting the Daemon

```bash
ssh user@vps.hostinger.com

# Find and kill existing process
pkill -f ingest_v9.py

# Restart (from the project directory)
cd /path/to/lemon-ingest
nohup python execution/ingest_v9.py >> /var/log/lemon-ingest.log 2>&1 &

# Verify it started
sleep 3 && ps aux | grep ingest_v9
```

---

## Firestore Collections

| Collection | Role |
|---|---|
| `ingest-queue` | Job queue. Daemon reads from here. Statuses: `pending → processing → complete | failed | budget_exceeded | pass_triage_only` |
| `uploaded_analyses` | Analysis results. This is the source of truth. Dashboard reads from here. |
| `system/budget` | Shared daily budget counter (prevents overages) |

---

## Analysis Versions

The daemon writes `analysis_version: "v9_archaeology"` (or `"v9_triage"` for triage-only passes).

The dashboard normalizer accepts:
- `v9_archaeology` — full 5-reader analysis (current)
- `v9_triage` — triage-only (below 6.0 threshold, current)
- `v8_archaeology` — intermediate test documents (backward compat)
- `v8_triage` — intermediate triage output (backward compat)
- `v7` — legacy browser inline output (backward compat)

---

## Troubleshooting

**Job stuck in "pending" for > 15 minutes**
→ Daemon may have crashed. Check logs and restart.

**Job stuck in "processing" for > 30 minutes**
→ Analysis may have timed out. Check Anthropic API status. Daemon will retry on restart.

**"budget_exceeded" status**
→ Daily budget cap hit. Check `system/budget` doc in Firestore. Cap resets at midnight UTC.

**"failed" status**
→ Check `ingest-queue/{jobId}.error_message` field for the specific error.
→ Common causes: corrupted PDF, PDF > 50MB, Anthropic API error.
