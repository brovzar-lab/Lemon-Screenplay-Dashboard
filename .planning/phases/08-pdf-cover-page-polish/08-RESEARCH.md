# Phase 8: PDF Cover Page Polish - Research

**Researched:** 2026-03-18
**Domain:** @react-pdf/renderer flex layout — spacing between elements in a fixed-height column
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Gap size:** Target gap between score number and badge: ~16–20px (comfortable, clear breathing room)
- **Gap style:** Pure whitespace only — no divider line, border, or background variation to separate them
- **Group alignment:** Score number and badge centered together as a group within the column (not split to top/bottom halves)
- **Layout approach:** Replace current dual `flex: 1` halves structure with a single flex column — stack score number + fixed marginBottom + badge, centered as a group vertically in `scoreLeft`
- **Badge shape:** Badge stays as tight pill (hugs text + padding) — not stretched to column width
- **Badge color:** Badge background color (recommendation-based) unchanged
- **Score color:** Score color (score-based green/amber/red) unchanged
- **Must preserve:** `titleText.marginBottom: 8` (v6.8 fix) — do not regress
- **Must preserve:** `authorText.marginTop: 2` (v6.8 fix) — do not regress
- **Change scope:** Isolated to `scoreLeft` inner layout inside `scoreCard` — no other files, no scope expansion

### Claude's Discretion

- Minor badge text size/weight tweak if it improves readability after layout fix
- Score number size — keep at 28pt unless visual balance clearly benefits from adjustment
- Exact margin/padding values within the 16–20px gap target

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PDF-01 | User can download a coverage PDF whose cover page shows the score number and recommendation badge with visible vertical separation so the two elements do not appear merged (deferred spacing fix from v6.8) | Root cause confirmed (dual flex: 1 halves collapse in react-pdf); fix pattern documented with explicit marginTop replacing flex distribution |
</phase_requirements>

---

## Summary

The defect is a react-pdf flex rendering quirk in `CoverageDocument.tsx` lines 621–631. The current implementation uses two sibling `View` elements both styled `flex: 1`, with the score number anchored to the bottom of the first and the badge anchored to the top of the second. This "split-halves" pattern creates only ~10px of effective whitespace between them — and react-pdf's PDF layout engine can collapse it further than browser flex, because the PDF renderer does not implement the full CSS flexbox spec. The result is that the number and badge appear merged on the rendered PDF.

The fix replaces the two `flex: 1` Views with a single `View` styled `justifyContent: 'center', alignItems: 'center'` — keeping the score number and badge as a stacked group centered vertically in `scoreLeft`. An explicit `marginTop: 16` (or value in the 16–20px range) on a wrapping `View` around the badge creates the guaranteed gap. This explicit margin approach is immune to react-pdf's flex distribution collapse because it is a fixed layout property, not a distributed spacing property.

The outer `scoreLeft` container (`width: 120, paddingHorizontal: 8, paddingVertical: 10`) does not change. The v6.8 title/author spacing fix lives in an entirely separate part of the component (`titleBlock` > `titleText` / `authorText`, lines 125–136 stylesheet, lines 583–586 JSX) and is not touched.

**Primary recommendation:** Replace lines 621–631 with a single centered-group View using explicit `marginTop` on the badge wrapper. No other changes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | (project-pinned) | PDF generation from React JSX | Only complete React-to-PDF renderer; already in use |

### Relevant react-pdf Layout Rules (HIGH confidence — from official docs + known behavior)

| Property | Behavior in react-pdf |
|----------|----------------------|
| `flex: 1` on siblings | Distributes available space equally — but distribution algorithm can produce smaller-than-expected gaps when sibling content is small |
| `justifyContent: 'flex-end'` + `paddingBottom` | Anchors content to bottom; padding collapses in PDF context under certain conditions |
| `justifyContent: 'center'` | Centers content vertically — reliable in react-pdf, equivalent to CSS behavior |
| `marginTop: N` | Explicit fixed pixel gap — always reliable, not subject to flex distribution |
| `alignItems: 'center'` | Centers content horizontally — reliable |

**Key insight:** In react-pdf, `flex` distribution spacing (via `justifyContent: space-between`, or sibling `flex: 1` halves) is less predictable than explicit `margin`/`padding`. Explicit margin is the authoritative, reliable pattern for fixed gaps in PDF layouts.

---

## Architecture Patterns

### Recommended Fix Structure

The defective region is a ~10-line JSX block inside the render of `CoverageDocument` (lines 619–632):

```
scoreCard (View, flexDirection: row)
└── scoreLeft (View, width: 120, paddingHorizontal: 8, paddingVertical: 10)
    ├── [OLD] View flex:1 justifyContent:flex-end  → score number
    └── [OLD] View flex:1 justifyContent:flex-start → badge
```

Replace the two inner Views with:

```
scoreCard (View, flexDirection: row)
└── scoreLeft (View, width: 120, paddingHorizontal: 8, paddingVertical: 10)
    └── [NEW] View flex:1 justifyContent:center alignItems:center
        ├── Text (score number, scoreNum style + color)
        └── View marginTop:16  ← explicit gap wrapper
            └── View (recBadge style + backgroundColor)
                └── Text (recBadgeText style)
```

### Pattern: Explicit Gap Wrapper

Source: react-pdf community best-practice — use `marginTop`/`marginBottom` on a wrapper `View` rather than flex distribution properties when a precise gap is required.

```tsx
// Reliable gap in react-pdf — use this pattern
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Text style={[s.scoreNum, { color: scoreColor(Number(screenplay.weightedScore) || 0) }]}>
    {(Number(screenplay.weightedScore) || 0).toFixed(1)}
  </Text>
  <View style={{ marginTop: 16 }}>
    <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
      <Text style={s.recBadgeText}>{recLabel(screenplay.recommendation)}</Text>
    </View>
  </View>
</View>
```

### Anti-Patterns to Avoid

- **Dual `flex: 1` siblings with `justifyContent: flex-end` / `flex-start`:** This is the root cause of the bug. The gap is implicit and collapses in the PDF renderer.
- **`justifyContent: 'space-between'` on the outer column:** Spreads items to edges, moves badge to the very bottom of `scoreLeft` — wrong visual outcome.
- **Removing `flex: 1` from the wrapper View:** Without `flex: 1`, the wrapper won't expand to fill `scoreLeft` height and centering won't work correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gap between PDF elements | Custom spacer component or calculated padding | Explicit `marginTop` on wrapper View | Explicit margin is the correct react-pdf primitive for fixed gaps |
| Badge centering | Absolute positioning | `alignItems: 'center'` on parent | react-pdf supports `alignItems` reliably |

---

## Common Pitfalls

### Pitfall 1: Forgetting `flex: 1` on the group wrapper
**What goes wrong:** The group wrapper collapses to minimum height, so `justifyContent: 'center'` has nothing to center within — score and badge appear at the top of the column.
**Why it happens:** `scoreLeft` has `paddingVertical: 10` but no intrinsic height beyond its content; without `flex: 1` on the group wrapper, there is no remaining space to center within.
**How to avoid:** The replacement View MUST keep `flex: 1` to absorb the available height of `scoreLeft`.

### Pitfall 2: Touching `titleBlock` / `titleText` / `authorText`
**What goes wrong:** Regresses the v6.8 fix (title/author overlap).
**Why it happens:** Those styles are adjacent in the stylesheet — easy to accidentally modify when scanning.
**How to avoid:** Change is 100% isolated to the inline style objects on lines 621–631 of the JSX. Stylesheet (`s.*`) entries are read-only for this phase.

### Pitfall 3: Over-wide badge
**What goes wrong:** Badge stretches to column width if `alignItems` is missing or set to `stretch`.
**Why it happens:** react-pdf default `alignItems` is `stretch`, which causes a child View to fill parent width.
**How to avoid:** Ensure the group wrapper has `alignItems: 'center'`, and do not add `width: '100%'` to the badge or its wrapper.

### Pitfall 4: marginTop value below 16px insufficient on some data
**What goes wrong:** Short score values (single digit "7.5") next to a long badge label ("FILM NOW") may still appear close.
**Why it happens:** react-pdf does not add sub-pixel anti-aliasing; 10px or less can look merged at 72dpi preview.
**How to avoid:** Use `marginTop: 16` as the floor; 18 or 20 are acceptable per user decision.

---

## Code Examples

### Current (broken) pattern — lines 621–631

```tsx
// Source: src/components/export/CoverageDocument.tsx lines 621–631
<View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 5 }}>
  <Text style={[s.scoreNum, { color: scoreColor(Number(screenplay.weightedScore) || 0) }]}>
    {(Number(screenplay.weightedScore) || 0).toFixed(1)}
  </Text>
</View>
<View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 5 }}>
  <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
    <Text style={s.recBadgeText}>{recLabel(screenplay.recommendation)}</Text>
  </View>
</View>
```

### Target (fixed) pattern

```tsx
// Source: CONTEXT.md target pattern, confirmed against react-pdf layout rules
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Text style={[s.scoreNum, { color: scoreColor(Number(screenplay.weightedScore) || 0) }]}>
    {(Number(screenplay.weightedScore) || 0).toFixed(1)}
  </Text>
  <View style={{ marginTop: 16 }}>
    <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
      <Text style={s.recBadgeText}>{recLabel(screenplay.recommendation)}</Text>
    </View>
  </View>
</View>
```

### Preserved v6.8 fixes (DO NOT TOUCH)

```tsx
// Source: src/components/export/CoverageDocument.tsx lines 125–136 (stylesheet)
titleText: {
  fontSize: 22,
  fontFamily: 'Helvetica-Bold',
  color: C.grey900,
  marginBottom: 8,   // ← v6.8 fix: was 3, do not change
},
authorText: {
  fontSize: 11,
  color: C.grey700,
  marginTop: 2,      // ← v6.8 fix, do not change
},
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Dual `flex: 1` siblings for spacing | Single centered group + explicit `marginTop` | Reliable gap that survives PDF renderer's flex distribution differences |

**Deprecated/outdated:**
- Split-halves flex pattern for PDF gaps: produces unreliable spacing in react-pdf; replaced by explicit margin approach.

---

## Open Questions

No unresolved questions. The root cause, fix pattern, constraints, and test infrastructure are all fully known.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test:run -- --reporter=verbose src/components/export/CoverageDocument.test.tsx` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | Score number and recommendation badge render in the document (both present) | unit (render smoke) | `npm run test:run -- src/components/export/CoverageDocument.test.tsx` | ✅ exists |
| PDF-01 | No regression: notes section absent when notes=[] | unit | `npm run test:run -- src/components/export/CoverageDocument.test.tsx` | ✅ exists |
| PDF-01 | No regression: `titleText.marginBottom` value preserved (checked via stylesheet object, not DOM) | unit (style object assertion) | Add to existing test file | ❌ Wave 0 gap |
| PDF-01 | TypeScript compiles without errors | build | `npm run build` | N/A — command |

**Note on PDF-01 visual gap:** The 16–20px visual gap on the cover page cannot be asserted in the jsdom test environment because @react-pdf/renderer is mocked as React stubs. The test approach for this requirement is:
1. Render smoke test confirms component renders without error after the layout change (existing tests cover this).
2. A new style-object test asserts the JSX produces the `marginTop: 16` (or chosen value) on the gap wrapper — verifiable by inspecting the rendered stub tree or by asserting against the style object directly.
3. Manual visual verification in the PDF output is the final gate (covered in success criteria).

### Sampling Rate

- **Per task commit:** `npm run test:run -- src/components/export/CoverageDocument.test.tsx`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green + `npm run build` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/export/CoverageDocument.test.tsx` — add a test asserting `marginBottom: 8` is present on the `titleText` style object (regression guard for v6.8 fix). File exists; one new `it()` block needed.
- [ ] Same file — add a test asserting the gap wrapper renders (presence of `marginTop` ≥ 16 on the badge wrapper stub) after the layout fix. Implementation-dependent; can be added in the same wave as the fix.

*(No new test files or framework installs required — existing infrastructure covers all needs.)*

---

## Sources

### Primary (HIGH confidence)
- `src/components/export/CoverageDocument.tsx` — direct source inspection, lines 69–447 (StyleSheet), 619–632 (broken pattern), 125–136 (v6.8 preserved styles)
- `src/components/export/CoverageDocument.test.tsx` — existing test infrastructure confirmed
- `.planning/phases/08-pdf-cover-page-polish/08-CONTEXT.md` — user decisions, target pattern, integration points

### Secondary (MEDIUM confidence)
- react-pdf official docs and community pattern: explicit `marginTop` preferred over flex distribution for reliable gaps in PDF context — consistent with the root-cause analysis in CONTEXT.md

### Tertiary (LOW confidence)
- None required. All findings are grounded in direct source inspection and locked decisions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct source inspection of installed, working project
- Architecture: HIGH — root cause and fix pattern provided in CONTEXT.md, confirmed against source
- Pitfalls: HIGH — derived from the exact broken code, react-pdf layout semantics, and v6.8 history in STATE.md

**Research date:** 2026-03-18
**Valid until:** Stable — react-pdf layout rules are version-stable; no external dependencies to watch
