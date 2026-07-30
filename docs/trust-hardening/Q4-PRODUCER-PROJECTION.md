# Q4: Producer-Facing Analysis Truth

Date: 2026-07-29

Status: implemented on `codex/q4-app-projection`, awaiting local producer review

## Producer guarantee

The slate now ranks and presents a screenplay by the score that remains after
the analysis engine's stored penalties and gates. The app does not silently
substitute the higher raw score.

For a current analysis, the producer can see:

1. the raw five-reader score;
2. the stored critical-failure deduction;
3. the final score used for ranking;
4. any verdict gates that affected the outcome;
5. the actual five specialist pillar scores;
6. analysis-quality, truncation, disagreement, and stability warnings; and
7. the underlying specialist evidence when the screenplay is opened.

## Score precedence

The producer projection uses the following order:

1. stored `weighted_score_adjusted`;
2. stored triage score when the trusted pipeline provides one;
3. raw weighted score for older records that have no stored adjustment.

The app never fabricates a deduction for a legacy record. It labels that record
as legacy instead.

Only records explicitly marked incomplete or truncated are removed from ranked
featured positions. They remain visible in the browse grid for human review.
Disagreement and boundary instability remain rankable, but receive visible
warnings.

## Critical-failure contract

Q4 normalizes critical failures using the canonical schema rather than trusting
an arbitrary model-supplied numeric penalty:

| Severity | Deduction |
| --- | ---: |
| Minor | 0.30 |
| Moderate | 0.50 |
| Major | 0.80 |
| Critical | 1.20 |

The display distinguishes the reported deduction from the applied deduction
when both are available.

## Five-pillar evidence

Current V9 analysis is represented by its real specialist readers:

- Structure
- Character
- Craft and Scene
- Concept
- Emotion

The older seven-field dashboard dimensions remain in the normalized data only
for backward compatibility. Producer-facing V9 surfaces no longer describe
those approximations as real V9 analysis. A legacy fallback is labeled
explicitly as a legacy estimate.

## Deferred specialist reports

New analysis writes preserve the complete sealed evidence in the immutable
version document and omit heavy reader reports from the latest-parent slate
projection. The slate listener therefore receives only the summary required to
browse and rank projects. When a producer opens a screenplay, the app requests
the exact immutable analysis version and reveals its specialist reports,
sub-scores, justifications, page citations, red flags, and recorded
disagreements.

Older records without an immutable version continue to use the existing parent
document as a compatibility fallback. Firestore cannot field-mask a document
snapshot, so records whose parent document physically contains reader reports
may still transfer those bytes during the existing live collection read. The
app immediately strips them from list state and does not render or retain them
until the screenplay is opened. Completing wire-level deferral for those
historical documents requires a separately approved one-time parent-projection
migration or the already-authorized replacement of the disposable test slate.

## Compatibility

All new producer-projection, quality, pillar, and reader-evidence fields are
additive and optional. Existing dashboard records, share links, exports, and
old UI paths continue to load. Existing shared links without Q4 fields use a
clearly labeled legacy fallback.

## Production-shaped proof

A read-only census of current production metadata confirmed that the app now
projects the stored values rather than recalculating them:

| Screenplay | Raw | Deduction | Final |
| --- | ---: | ---: | ---: |
| WILL 2010 | 5.22 | 0.50 | 4.72 |
| Sola | 5.21 | 1.30 | 3.91 |
| Matadero | 7.38 | 0.30 | 7.08 |
| Oro de Acapulco | 6.76 | 0.50 | 6.26 |
| HERMANOSMARQUEZCASTILLO | 6.25 | 0.00 | 6.25 |

HERMANOS remains the Q3.2 trusted contract specimen with five completed readers,
trust manifest v3, and publication-ready status.

## Deployment boundary

Q4 changes the app projection and the VPS writer's latest-parent projection. It
makes no paid model calls and does not deploy hosting, Functions, rules, or the
VPS. Production requires Billy's separate approval for a coordinated hosting
and VPS deployment after local review. Removing embedded reports from
historical parents is a separate data mutation and also requires explicit
approval.
