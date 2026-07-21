# Product

## Register

product

## Product Definition

Lemon Screenplay Dashboard is a screenplay intelligence and discovery engine for Lemon Studios. It is not a project-management, development-tracking, assignment, meeting, or follow-up system. It ingests and deeply analyzes thousands of screenplays so producers can retrieve the small number that fit a specific creative or commercial need.

The defining promise is simple: put 5,000 screenplays into Lemon and surface the one-in-a-million project that otherwise would remain buried.

## Users

The primary user is Billy Rovzar, alongside trusted Lemon Studios producers and readers. They search a growing archive on desktop, often beginning with a creative brief such as "a highly scored horror movie about fatherhood" or precise constraints such as recommended comedies above a score threshold.

## Jobs To Be Done

1. Describe a creative need in plain language and retrieve semantically relevant screenplays, even when the exact search terms do not appear in the title or logline.
2. Combine meaning-based discovery with visible, editable filters for verdict, score, genre, budget, format, and analysis dimensions.
3. Understand why each project matched before opening it, then access the complete V9 analysis without losing search context.
4. Reduce large result sets to a trustworthy AI-curated shortlist with explicit reasons.
5. Save searches and named result sets, compare promising projects, and identify new matches as the archive grows.
6. Surface exceptional and overlooked material, especially the rare FILM NOW verdict, without diluting that verdict or presenting weaker projects as equivalent.

## Verdicts

- **Pass:** Lemon does not currently recommend pursuing the screenplay.
- **Consider:** The screenplay has meaningful potential worth examining.
- **Recommend:** The screenplay is strong enough to merit serious producer attention.
- **FILM NOW:** An exceptionally rare, one-in-two-hundred-level project. This is a protected verdict, not a generic browsing category.

## Primary Information Architecture

- **Discover:** Natural-language search, interpreted filter chips, visible core filters, ranked visual results, shortlist action, and complete V9 detail access.
- **Exceptional Finds:** A useful destination for true FILM NOW projects, strongest Recommend candidates, unusual new discoveries, and overlooked matches. True FILM NOW projects always receive the strongest presentation and remain accurately labeled.
- **Saved:** Live saved searches, named result sets, new-match indicators, comparisons, exports, and sharing.
- **Insights:** Archive-level and current-result analytics. Charts support discovery but do not dominate it.
- **Ingest:** Upload status, processing health, failures, duplicates, and actions that resolve ingestion problems.

## Confirmed Experience

- Plain-language discovery plus visible interpreted filters.
- Semantic understanding of themes, emotional meaning, character dynamics, and story concepts.
- Ranking balances creative relevance with V9 quality.
- Cards lead with title and match reason, followed by logline, verdict, and score.
- Match evidence is expandable.
- Desktop defaults to three substantial cards across, with the strongest matching project featured on the left.
- The Shortlist action returns the ten strongest candidates with reasons.
- The complete V9 analysis opens in a side panel using roughly two-thirds of the viewport.
- Revised drafts and duplicates group under one project.
- Saved searches refresh and mark newly matching screenplays.
- Empty searches explain the constraint conflict, ask a clarifying question, and offer controlled alternatives.

## Visual Direction

Studio Archive: a refined cinematic catalogue combined with a serious research instrument. The Discover experience uses the Vault Spotlight composition with visible filtering mechanics. Exceptional Finds uses a more curated Finding Room composition. Both share one component, typography, spacing, and color system.

Color communicates verdicts, matching evidence, active filters, selection, and system state. It is not decoration. The interface supports light and dark preferences without tying a product mode to a theme.

## Anti-References

- Workflow software with stages, owners, meetings, tasks, or development progress.
- Generic analytics dashboards where charts occupy the main viewport.
- Streaming-service clones dominated by posters instead of screenplay evidence.
- AI interfaces that hide why results were selected.
- Tiny chart labels, compressed metadata, hover-only evidence, or unreadable card details.
- Decorative gradients, glassmorphism, atmospheric blobs, novelty motion, or nested cards.
- Interfaces that dilute FILM NOW by presenting ordinary strong projects as equivalent.

## Design Principles

1. Discovery before analytics: search, evidence, and results dominate the working surface.
2. Meaning plus control: AI interprets intent, and every interpretation remains visible and editable.
3. Trust through evidence: show why a screenplay matched and why it ranked where it did.
4. Rare means rare: protect FILM NOW while keeping Exceptional Finds useful when no FILM NOW project exists.
5. Large-library ergonomics: every pattern must remain effective with 5,000 or more analyzed screenplays.
6. Context survives depth: opening V9 analysis must not destroy the current search or result position.
7. Human judgment remains primary: AI narrows the archive and explains evidence; producers decide what matters.

## Accessibility

Target WCAG 2.2 AA. Use visible focus states, keyboard-operable search and filters, 44px minimum touch targets, readable 14–16px UI text, non-color status labels, reduced-motion support, and structural mobile adaptation. Essential evidence must never depend on hover alone.
