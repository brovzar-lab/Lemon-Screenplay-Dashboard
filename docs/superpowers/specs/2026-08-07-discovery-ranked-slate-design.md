# Discovery Ranked Slate Design

**Status:** Approved design, pending written-spec review

**Date:** 2026-08-07

**Scope:** Discovery landing page only
**Primary question:** What are the best scripts in the current view?

## Outcome

Discovery becomes a compact, blue, decision-oriented slate browser. It presents one honest top result, the next three ranked scripts for context, and then continues directly into the searchable screenplay wall. Every promoted screenplay explains why it appears there.

The design does not change screenplay scores, verdicts, filters, sorting behavior, stores, services, or analysis data. It changes only how the existing information is organized and presented.

## Design Principles

1. **Ranking must be honest.** “Top result” means first under the active decision sort and current filters. It never implies a human editorial selection.
2. **The screenplay remains the object.** Visual screenplay covers retain the approved physical-document presentation and use the true 8.5 × 11 page proportion.
3. **The slate stays close.** Ranking context is compact. The searchable wall begins within the first desktop viewport when practical.
4. **Every promoted result explains itself.** The active sort and relevant filters appear beside the ranking label.
5. **Blue is the Discovery system color.** The header, active states, focus treatments, and primary actions use the approved cobalt-blue palette. Green is reserved for verdict and status semantics, not navigation chrome.
6. **Analytics remain secondary.** Slate-level charts are available on demand without pushing projects down the page.
7. **No duplicate inventory.** The top four are shown once. The wall continues from the fifth result under decision sorts.

## Page Hierarchy

### 1. Global Header

- Height target: approximately 56 px on desktop.
- Permanent midnight-blue background with cobalt-blue active state.
- Lemon Discovery brand, Discover navigation, Intake for authorized users, and existing account/theme/sync controls.
- Prominent search field for title, writer, logline, genre, and theme.
- The `/` keyboard shortcut continues to focus search.
- Saved Views and Favorites remain available without dominating the header.

### 2. Slate Statistics Strip

A single compact row shows:

- total scripts;
- visible scripts;
- average score for the current filtered view;
- Film Now and Recommend count;
- Producer Look count.

Counts always reflect the same dataset used by the current view. Hidden produced and non-screenplay inventory remains disclosed.

### 3. Search and Controls

The controls stay in one dense, scannable rail:

- genre;
- theme;
- active sort;
- Film Now, Recommend, Consider, and Pass filters;
- Filters popover for score ranges and inventory options;
- live “showing X of Y” count.

The existing `filterStore`, `sortStore`, saved lenses, and filter behavior remain the source of truth.

### 4. Slate Insights

Slate Insights appears as a slim collapsed row directly below the controls.

Collapsed state names the available information: score distribution, verdict mix, top genres, and budget tiers. Expanding the row reveals the existing analytics content in a compact grid. Collapsing it returns the user to the ranked slate without losing filters.

The analytics bundle should load only after expansion where the current component boundary permits it. An analytics failure must remain isolated so search, ranking, and the screenplay wall continue to work.

### 5. Best in the Current View

This section appears only for decision-oriented sorts:

- weighted/final score;
- market potential;
- commercial viability score.

The section contains:

1. **Top Result:** a compact leader card with the screenplay object, title, format, genre, writer, logline, verdict, score, percentile, and an “Open screenplay file” action.
2. **Ranking reason:** explicit language such as “Ranked first because Final score, highest first.”
3. **Next Three:** compact cards for positions two through four, each showing title, key metadata, score, and rank.

The ranking always follows the active filters and active sort. Changing search, genre, theme, verdict, score range, saved view, or produced visibility immediately recomputes the four results.

When fewer than four results exist, the section renders only the available results without empty placeholders.

### 6. Alphabetical Browsing Rule

When sorting by title, the entire Best in the Current View section disappears. “First alphabetically” is not presented as a quality judgment.

The alphabetical screenplay wall begins immediately below Slate Insights.

### 7. Searchable Screenplay Wall

Under decision sorts, the wall continues from rank five so the promoted top four are not repeated. Under title sorting, it begins with the first alphabetical result.

The wall retains:

- verdict-tinted screenplay stages;
- score and percentile;
- title and cleaned display title;
- writer;
- genre;
- format and source badges;
- trust/review status;
- Producer Look status;
- selection and bulk actions;
- pagination in groups of 50.

The section label should describe the behavior accurately. Under decision sorts it should use language such as “Continue through the slate,” rather than implying the promoted top four are repeated below.

## Screenplay Object Proportions

All screenplay objects use the physical screenplay page ratio:

```css
aspect-ratio: 8.5 / 11;
```

Requirements:

- Width determines height; content must not crop the cover.
- The cover must read as a full screenplay page, not a narrow notebook.
- The blue binding spine occupies approximately 7–9% of the cover width.
- Brass fasteners remain inset from the page edge.
- Titles use adaptive sizing and line limits, but the cover itself never stretches to accommodate unusually long text.
- Leader, next-three, and wall variants share the same proportion at different sizes.

## Density and Typography

The new page should feel approximately 15–20% denser than the current screenplay presentation.

- Reduce the current 500 px leader height to approximately 180–220 px on desktop.
- Reduce supporting display headings while retaining editorial serif typography for screenplay titles.
- Use compact sans-serif text for metadata, controls, counts, and status.
- Reduce large vertical paddings and gaps before reducing readable line-height.
- Preserve clear separation between search, ranking, and archive zones.
- Optimize first for desktop and tablet. Phone support remains functional but is not the primary visual target.

## Color System

- **Chrome:** midnight navy and cobalt blue.
- **Film Now:** bright gold.
- **Recommend:** green.
- **Consider:** light/cobalt blue.
- **Pass:** red.
- **Paper:** warm off-white.
- **Body canvas:** dark navy in the Discovery presentation.

Verdict colors remain semantic accents. They must not recolor the global header or replace the blue navigation system.

## Interaction and Navigation

- Clicking any leader, runner-up, or wall card opens its Screenplay File workspace.
- Existing drawer fallback remains available through its current preview path.
- Search and filters update the ranking and wall together.
- Back/forward navigation and deep links remain unchanged.
- Closing any fallback drawer restores focus to its originating card.
- Expand/collapse state for Slate Insights is local presentation state and does not modify filters.

## States and Failure Handling

- **Loading:** compact skeletons for header counts, ranking, and wall.
- **No data:** explain that analyzed screenplays will appear automatically.
- **No results:** show a clear-filters action; do not render empty ranking slots.
- **Title sort:** ranking is intentionally absent, not shown as an error.
- **Analytics failure:** show a contained Slate Insights error while keeping the rest of Discovery usable.
- **Incomplete metrics:** preserve “Not assessed” rather than converting missing data to zero.

## Component Boundaries

The implementation should stay additive and presentation-focused:

- `HybridHeader` remains the shared header/search boundary.
- `HybridCommandRail` remains the filter/sort boundary.
- `ScreenplayDiscoverShell` composes the page and decides whether ranking is eligible.
- The current large `ScreenplayFeature` should become a compact top-result unit.
- A separate next-three component should render positions two through four.
- `ScreenplayGrid` continues the remaining ordered results.
- Existing analytics components are reused inside a new compact Slate Insights disclosure.
- `BlueSpineScript` remains the single screenplay-object primitive and owns the 8.5 × 11 proportion.

No service, store, scoring, daemon, function, or rule changes are part of this design.

## Accessibility

- Search has a persistent accessible label.
- Ranking reason is available as text, not conveyed by position alone.
- Slate Insights uses a button with `aria-expanded` and a controlled region.
- Cards retain descriptive accessible names.
- All actions remain keyboard reachable with visible cobalt focus treatment.
- Status and verdict meaning is never conveyed by color alone.
- Reduced-motion preferences disable nonessential transitions.

## Verification

Required automated checks:

1. Weighted score sorting produces the correct top result and next three.
2. Market potential and CVS sorts reorder the leader, next three, and wall consistently.
3. Search and filters recompute all ranked surfaces.
4. Title sorting removes the ranking section and starts the wall at the first result.
5. The top four do not repeat in the wall under decision sorts.
6. Fewer than four results render without placeholders.
7. Slate Insights expands, collapses, and preserves active filters.
8. Analytics failure does not remove the screenplay wall.
9. Search remains keyboard focusable with `/`.
10. Existing selection, favorites, sharing, Producer Look, pagination, and fallback routes remain green.

Required visual checks:

- blue header and active states in both themes;
- 8.5 × 11 screenplay proportions in leader, next-three, and wall cards;
- first desktop viewport contains search, ranking context, and the start of the slate;
- tablet layout remains readable without cropped screenplay objects;
- no green navigation chrome;
- no oversized “accessibility zoom” typography or excessive whitespace.

## Preserved Fallbacks

- `/discover?ui=classic` remains unchanged.
- The current drawer fallback remains available through its existing preview route.
- The current Screenplay File workspace and all project tabs remain unchanged.

## Out of Scope

- scoring or verdict changes;
- calibration activation;
- new analytics metrics;
- backend, Functions, VPS, rules, or service behavior;
- deployment;
- paid model calls;
- changes to the Screenplay File workspace.
