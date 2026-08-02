# Q7 Project Workspace

Status: implemented locally on `codex/q7-project-workspace`. Nothing in Q7 is deployed.

## Producer outcome

Q7 turns each Cinema Browse screenplay into a full project destination. A producer
can move from slate triage into the complete decision record without working inside
a side drawer.

The workspace opens at `/projects/:projectId` and contains:

- the paper screenplay cover, title, writer, logline, score, and verdict;
- a Decision Spine that keeps the AI judgment, trust status, reader room,
  Producer Take, and analysis version in one line of sight;
- the executive read, strongest signals, and watch points;
- the existing score lineage and all five specialist-reader reports;
- the existing Story X-Ray details, Producer Take, private notes, sharing,
  favorites, source screenplay, coverage PDF, and pitch-deck PDF actions.

## Navigation contract

- Cinema Browse cards now open `/projects/:projectId`.
- Back returns to the prior Discovery view when the workspace was opened there.
- Direct links and browser refreshes resolve the same real screenplay by stable
  `projectId`, with legacy `id` compatibility.
- `/discover/:projectId` remains the preserved drawer fallback.
- `/discover?preview=drawer` keeps the fallback active while browsing, allowing
  the previous interaction model to be reviewed without reverting Q7.

## Reuse and safety

Q7 reuses the existing data and actions. It does not create a second analysis
shape or alternate persistence path.

- Data still comes from `useScreenplays` and `useLiveScreenplaySync`.
- Reader evidence, score lineage, notes, Producer Take, share, favorites, and PDF
  exports use their existing components and services.
- Source PDFs prefer the immutable version archive pointer, with the established
  legacy storage paths as compatibility fallbacks.
- Producer Take remains admin-only and bound to the exact analysis version.
- Loading, missing-project, and error states retain the full application chrome.

## Explicit exclusions

Q7 does not add Chat With the Room. That remains Q8 because it requires a new
conversation contract, model calls, cost controls, and a separate approval.

Q7 does not change Functions, Firestore rules, the VPS daemon, analysis behavior,
calibration activation, or stored screenplay data. It makes no paid model calls.

## Local review

1. Open `http://localhost:3000/discover`.
2. Select any screenplay card.
3. Confirm the full workspace opens and Back returns to the same Discovery view.
4. Refresh the project URL to confirm it is independently deep-linkable.
5. Review both themes and the existing project actions without starting analysis.

Production deployment requires a separate explicit approval after local review.
