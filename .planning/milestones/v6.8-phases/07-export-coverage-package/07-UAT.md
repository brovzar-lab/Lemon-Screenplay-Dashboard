---
status: diagnosed
phase: 07-export-coverage-package
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md]
started: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:01:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Coverage button visible in modal action bar
expected: Open any screenplay detail modal. In the action bar at the top, you should see a "Coverage" button between the Share button and the Re-analyze button. It should be visible alongside the existing Share, PDF, and Delete buttons.
result: pass

### 2. PDF downloads with correct filename
expected: Click the "Coverage" button. The browser should download a PDF file. The filename should be based on the screenplay's title (spaces replaced with hyphens, special characters removed), ending in .pdf — e.g. "My-Screenplay-Title-coverage.pdf" or similar.
result: pass

### 3. Loading state during generation
expected: When you click "Coverage", the button should briefly show a loading spinner while the PDF is being generated. It should not stay in loading state indefinitely — once the download triggers, it returns to normal.
result: pass

### 4. PDF has all four sections
expected: Open the downloaded PDF. It should have: (1) a cover page with the screenplay title, overall score, and a verdict/recommendation; (2) a scores page showing dimension score bars; (3) an analysis page with synopsis, strengths, weaknesses, and/or development notes; (4) a details page with comparable films, characters, target audience, etc. Each page should have a confidentiality footer and page numbers.
result: issue
reported: "we just need to modify or take care of the formatting better with a PDF skill because some text is overlapping like the title is overlapping with the authors name"
severity: major

### 5. Notes section: omitted when empty, shown when present
expected: For a screenplay with NO producer notes: the PDF should not show any notes section — no empty placeholder, no blank section. For a screenplay that HAS notes: the PDF should show a notes section with the note content and dates. (Test whichever scenario is easiest with your current data — or both if you have examples of each.)
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Cover page shows screenplay title and author name without text overlap"
  status: failed
  reason: "User reported: we just need to modify or take care of the formatting better with a PDF skill because some text is overlapping like the title is overlapping with the authors name"
  severity: major
  test: 4
  root_cause: "titleText.marginBottom is 3pt — far too small for a 22pt heading. The 22pt title with lineHeight 1.4 renders ~30.8pt tall, and only 3pt separates it from the 11pt author line below, causing descenders to visually overlap with the author text."
  artifacts:
    - path: "src/components/export/CoverageDocument.tsx"
      issue: "titleText.marginBottom: 3 is insufficient separation between 22pt title and 11pt author text"
      line_numbers: [126, 127, 128, 129, 130, 131]
    - path: "src/components/export/CoverageDocument.tsx"
      issue: "authorText has no marginTop — entire gap is solely the 3pt marginBottom on titleText"
      line_numbers: [132, 133, 134, 135]
  missing:
    - "Change marginBottom on titleText from 3 to 8 for comfortable separation between 22pt heading and 11pt body text"
    - "Optionally add marginTop: 2 to authorText as defensive secondary gap"
  debug_session: ""
