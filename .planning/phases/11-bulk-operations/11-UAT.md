---
status: testing
phase: 11-bulk-operations
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md
started: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Test

number: 2
name: Re-analyze Selected — Eligibility Header
expected: |
  Filter to "Has PDF" screenplays using the new green chip in the filter bar.
  Select 2 screenplays — one that shows a green/storage badge (hasPdf) and one without (or just select 2 PDF-confirmed ones).
  Click Actions → Re-analyze Selected.
  BulkReanalyzeModal opens. Header reads "X of Y selected are eligible. Processing X..."
  Only the eligible screeplays appear in the queue; ineligible ones are absent.
awaiting: user response

## Tests

### 1. Generate Share Links
expected: Select 3 screenplays via the gold export checkboxes; click Actions button in FilterBar; click "Generate Share Links". BulkShareModal opens; all 3 screenplay titles appear as rows in pending state; each row fills with a share URL as tokens resolve; individual Copy buttons appear per row; Copy All button becomes active; clicking Copy All writes newline-separated URLs to clipboard.
result: pass

### 2. Re-analyze Selected — Eligibility Header
expected: Filter to "Has PDF" screenplays using the new green chip in the filter bar. Select a mix of screenplays (or select any 2+ where at least one has a confirmed PDF). Click Actions → Re-analyze Selected. BulkReanalyzeModal opens; header reads "X of Y selected are eligible. Processing X..."; only the eligible screenplay(s) appear in the queue; ineligible ones are absent.
result: [pending]

### 3. Cancel Button During Re-analysis
expected: Start re-analysis on 3+ screenplays; click Cancel after the first one completes. The in-flight item finishes; remaining items stay in queued state and stop processing; summary shows how many completed before cancellation.
result: [pending]

### 4. Export Scope Labels
expected: (a) Select 3 screenplays and open Export → header reads "Exporting 3 selected screenplays" and button reads "Export 3 Screenplays". (b) Apply a filter with no selection and open Export → header reads "Exporting X filtered screenplays". (c) Clear all filters and selection, open Export → "Exporting all X screenplays".
result: [pending]

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
