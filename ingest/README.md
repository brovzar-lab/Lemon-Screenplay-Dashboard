# Lemon Batch Ingest

This Mac tool queues a complete folder of screenplay PDFs for the production V9 pipeline.

It does not run AI locally. After upload, the production VPS controls V9 analysis, TMDB checks, budgets, retries, evidence checks, and poster generation.

## Recommended use

Double-click `Lemon Ingest.app` in the repository.

1. Choose a folder.
2. Choose the category and reading route.
3. A Terminal window shows duplicates, title conflicts, invalid files, and the estimated cost.
4. Approve the batch once.

After every accepted PDF says `queued`, you may close Terminal. The VPS will continue the work.

## Safety rules

- Searches the selected folder and all folders inside it.
- Accepts PDF files under 50 MB.
- Blocks exact copies before upload when possible. The VPS checks again before any AI call.
- Blocks same-name projects. Resolve those as revisions or separate projects in Dashboard Intake.
- Saves `.lemon_ingest_batch.json` inside the selected folder after every step.
- Reuses the same upload path after an interruption. It does not create a second paid job.
- Marks a file `queued` only after Firestore confirms the exact Storage object version.
- Keeps the original accented filename even though the Storage path is plain ASCII.
- Uses this Mac's Google Application Default Credential. It does not bundle a service-account key.

## Command-line use

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
ingest/.venv/bin/python ingest/lemon_ingest.py --folder "/path/to/screenplays" --category LEMON --model hybrid --dry-run
```

Remove `--dry-run` only when you are ready to approve paid analysis.

Use `--new-batch` to archive an earlier batch manifest before changing the category or reading route. The tool blocks this after any file may have uploaded.

## One-time setup

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
python3 -m venv ingest/.venv
ingest/.venv/bin/pip install -r ingest/requirements.txt
gcloud auth application-default login
```

The current production categories are `LEMON`, `SUBMISSION`, `BLKLST`, `CONTEST`, and `OTHER`.

The current reading routes are `haiku`, `sonnet`, `opus`, and `hybrid`.
