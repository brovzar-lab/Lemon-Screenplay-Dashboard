# Phase 8: PDF Cover Page Polish - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the deferred v6.8 defect: weighted score number and recommendation badge on the coverage PDF cover page are visually merged. Change is isolated to `src/components/export/CoverageDocument.tsx` — specifically the `scoreLeft` column layout inside `scoreCard`. No other files, no scope expansion.

</domain>

<decisions>
## Implementation Decisions

### Gap size
- Target gap between score number and badge: ~16–20px (comfortable, clear breathing room)
- Pure whitespace only — no divider line, border, or background variation to separate them
- The score number and badge should be centered together as a group within the column (not split to top/bottom halves)

### Layout approach
- Replace the current dual `flex: 1` halves structure with a simple single flex column
- Stack score number + fixed marginBottom + badge, centered as a group vertically in `scoreLeft`
- The dual-flex-half approach is unreliable in react-pdf and is the root cause of the merge bug

### Badge appearance
- Badge stays as tight pill (hugs text + padding) — not stretched to column width
- Badge text style (8pt bold uppercase, 1.2 letter spacing): Claude's discretion to adjust slightly if it improves readability after spacing fix
- Badge background color (recommendation-based) unchanged

### Score number
- Score number font size (28pt bold): Claude's discretion — can adjust slightly if it improves visual balance with the badge after layout change, but no major resizing
- Score color (score-based green/amber/red): unchanged

### Constraints — must preserve
- `titleText.marginBottom: 8` — v6.8 fix, do not regress
- `authorText.marginTop: 2` — v6.8 fix, do not regress
- All code outside `scoreLeft` inner layout: no constraint, but changes should be minimal and intentional

### Claude's Discretion
- Minor badge text size/weight tweak if it improves readability after layout fix
- Score number size — keep at 28pt unless balance clearly benefits from adjustment
- Exact margin/padding values within the 16–20px gap target

</decisions>

<specifics>
## Specific Ideas

- The fix should be reliable across react-pdf renders — prefer explicit margin/padding over flex distribution tricks
- The group-centered approach (score + gap + badge as a unit, centered in scoreLeft) is the target visual

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scoreLeft` style: `width: 120, alignItems: 'stretch', paddingHorizontal: 8, paddingVertical: 10` — outer container stays
- `scoreNum` style: `fontSize: 28, fontFamily: 'Helvetica-Bold'` — inherited by score Text
- `recBadge` style: `paddingVertical: 4, paddingHorizontal: 12, borderRadius: 2` — badge container
- `recBadgeText` style: `fontSize: 8, fontFamily: 'Helvetica-Bold', color: white, letterSpacing: 1.2`

### Current Broken Pattern (lines 621–631)
```jsx
<View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 5 }}>
  <Text style={[s.scoreNum, { color: ... }]}>...</Text>
</View>
<View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 5 }}>
  <View style={[s.recBadge, { backgroundColor: ... }]}>...</View>
</View>
```
Only ~10px effective gap, and react-pdf flex rendering can collapse it further.

### Target Pattern
Replace with a single flex column centered as a group:
```jsx
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Text style={[s.scoreNum, { color: ... }]}>...</Text>
  <View style={{ marginTop: 16 }}>  {/* ~16–20px gap */}
    <View style={[s.recBadge, { backgroundColor: ... }]}>...</View>
  </View>
</View>
```

### Integration Points
- `scoreCard` > `scoreLeft` > inline View structure (lines 619–632)
- v6.8 fix lives in `titleBlock` > `titleText` / `authorText` (lines 125–136 of stylesheet, lines 583–586 of JSX) — do not touch

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-pdf-cover-page-polish*
*Context gathered: 2026-03-18*
