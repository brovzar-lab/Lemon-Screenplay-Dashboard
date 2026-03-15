# Frontend Design Overhaul — Lemon Screenplay Dashboard

**Date:** 2026-03-15
**Branch:** `frontend-design-1`
**Scope:** 16 design changes across typography, color, components, animation, and interaction

---

## A. Typography System

### Current
- Display: Playfair Display
- Body/Headers: Inter
- Mono: JetBrains Mono

### New
| Layer | Font | Fallback |
|-------|------|----------|
| Hero ("LEMON" title only) | Playfair Display | Georgia, serif |
| Section headers, card titles | Barlow Condensed (already loaded) | system-ui, sans-serif |
| Body text | Satoshi | system-ui, sans-serif |
| Scores, data | JetBrains Mono | Fira Code, monospace |

### Details
- Load Satoshi via Google Fonts or Fontshare CDN in `index.html`
- Update `--font-body` in `@theme` block of `index.css`
- Update `--font-display` usage: Playfair for `.hero-text` only; Barlow Condensed for `h2`, `h3`, `h4`, card titles, section headers
- Add `letter-spacing: -0.01em` to Barlow Condensed headings for editorial tightness
- Preserve JetBrains Mono for all `font-mono` usage

### Files Modified
- `index.html` — add Satoshi font link
- `src/index.css` — update `@theme` font variables, heading styles
- `src/styles/typography.css` — update font references and heading classes

---

## B. Color Palette Expansion

### New Colors
| Name | Hex | CSS Variable | Purpose |
|------|-----|-------------|---------|
| Deep Rose / Burgundy | `#9F1239` | `--color-burgundy-*` | Secondary accent, cinema curtain warmth |
| Warm Ivory | `#FFFBEB` | `--color-ivory` | Light mode card tint |
| Midnight Teal | `#0F766E` | `--color-teal-*` | Tertiary accent, info states, chart variety |

### Burgundy Scale
- 50: `#FFF1F2`, 100: `#FFE4E6`, 200: `#FECDD3`, 300: `#FDA4AF`
- 400: `#FB7185`, 500: `#F43F5E`, 600: `#E11D48`, 700: `#BE123C`
- 800: `#9F1239`, 900: `#881337`, 950: `#4C0519`

### Usage
- Modal hero banner background: burgundy-900 with gold text
- Active tab underlines: burgundy-700
- Destructive action hover glows: burgundy-500
- Charts: replace violet with teal for better cohesion
- Light mode cards: ivory background instead of pure white

### Files Modified
- `src/index.css` — add color variables to `@theme`
- `src/styles/premium-theme.css` — integrate into theme variables
- Light mode overrides — ivory card backgrounds

---

## C. Card Visual Hierarchy by Tier

### FILM NOW — Hero Treatment
- Increased vertical padding in header area (2x: `py-6` instead of `py-3`)
- Logline fully visible (remove `line-clamp-2`)
- Pulsing gold border-glow (existing) + subtle gold gradient wash across top 30%
- Weighted score: large bold number outside the 2x2 grid
- CSS class: `.card-film-now` (extend existing)

### RECOMMEND — Emerald Accent
- 3px solid emerald-500 left border (`border-l-3 border-emerald-500`)
- Hover glow tinted emerald (`shadow-emerald-500/10`)
- CSS class: `.card-recommend`

### CONSIDER — Baseline
- No changes (current card styling)

### PASS — Quiet Treatment
- Opacity 0.65 at rest, 1.0 on hover
- No hover-lift animation (remove `translateY(-4px)`)
- Score text smaller (`text-xs` instead of `text-sm`)
- CSS class: `.card-pass`

### Files Modified
- `src/index.css` — add `.card-recommend`, `.card-pass` utility classes
- `src/components/screenplay/ScreenplayCard.tsx` — apply tier-based classes conditionally
- `src/styles/glassmorphism.css` — tier-specific glass variants if needed

---

## D. Modal Split-Panel Redesign

### Layout
```
┌─────────────────────────────────────────────────┐
│  HERO BANNER (full-width)                        │
│  Title (Barlow Condensed, 2xl) + Badge + Score   │
│  Background: burgundy-900 gradient               │
├──────────────────────┬──────────────────────────┤
│  LEFT (sticky,       │  RIGHT (scrollable)       │
│   w-2/5, max-360px)  │  (w-3/5, flex-1)         │
│                      │                           │
│  • Radar chart       │  • Logline                │
│  • Score breakdown   │  • Comparable films       │
│  • Producer metrics  │  • Content details        │
│                      │  • Notes                  │
│                      │  • Feedback               │
├──────────────────────┴──────────────────────────┤
│  FLOATING ACTIONS BAR (sticky bottom)            │
│  [Compare] [Export] [Notes] [Delete]             │
└─────────────────────────────────────────────────┘
```

### Sticky Score Mini-Bar
- Appears when hero banner scrolls out of view (IntersectionObserver)
- Contains: title (truncated), recommendation badge, weighted score
- Glass background, 48px height, slides down from top of modal

### Mobile Behavior
- Single column: Hero → Scores → Content (sequential)
- Floating actions bar remains at bottom
- No sticky left panel

### Files Modified
- `src/components/screenplay/ScreenplayModal.tsx` — restructure to split-panel
- `src/components/screenplay/modal/ModalHeader.tsx` — hero banner redesign
- New: `src/components/screenplay/modal/ModalStickyBar.tsx` — sticky score bar
- New: `src/components/screenplay/modal/ModalActionsBar.tsx` — floating actions
- `src/components/screenplay/modal/ScoresPanel.tsx` — adapt for left panel
- `src/components/screenplay/modal/ContentDetails.tsx` — adapt for right panel

---

## E. Filter Bar Redesign

### Sliding Active Indicator
- Gold bar (3px height) positioned absolutely below filter chips container
- Animates `transform: translateX()` and `width` to match active chip position
- Spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`, 250ms duration
- Implemented via `useRef` measuring chip positions + CSS transform

### Search Expand
- Default width: `w-52` (208px)
- On focus: `w-[360px]` with `transition-all duration-300 ease-out`
- Placeholder text fades and changes on focus

### Real-Time Count Animation
- Result count uses CSS `transition` on opacity for fade effect
- Number change: brief fade-out (100ms) → update → fade-in (150ms)

### Grid Reflow (stretch goal)
- Use `View Transition API` if browser supports it
- Fallback: cards fade out (150ms) → rerender → fade in (250ms)

### Files Modified
- `src/components/layout/FilterBar.tsx` — add sliding indicator, search animation
- `src/index.css` — add indicator positioning styles
- `src/components/screenplay/ScreenplayGrid.tsx` — grid reflow animation

---

## F. Film Grain + Atmospheric Background

### Film Grain Overlay
- CSS `::after` pseudo-element on `body` or root container
- `background-image`: inline SVG noise pattern (data-URI)
- `opacity: 0.03`, `pointer-events: none`, `position: fixed`, `inset: 0`
- `z-index: 1` (below all interactive content)
- `mix-blend-mode: overlay`

### Mesh Gradient Enhancement
- Increase floating glow opacity from 0.03 → 0.06-0.08
- Add slow color drift: navy (#0F172A) ↔ midnight blue (#1a1a3e) on 60s cycle
- Modify existing `float-ocean-*` keyframes

### Bokeh Light Leaks
- 3-4 large radial gradients (300-500px diameter)
- Opacity: 0.03-0.05
- Colors: gold, teal, rose (from new palette)
- Positioned at corners, drift on 50-70s translate animations
- CSS-only, `pointer-events: none`

### Files Modified
- `src/styles/mesh-gradients.css` — enhance gradients, add bokeh
- `src/index.css` — film grain pseudo-element on base layer

---

## G. Page Load Orchestration

### Sequence
| Time | Element | Animation |
|------|---------|-----------|
| 0ms | Background mesh | `opacity 0→1`, 400ms |
| 100ms | Header | `translateY(-20px)→0` + `opacity 0→1`, 350ms ease-out |
| 250ms | Filter bar | `opacity 0→1`, 300ms |
| 400ms | Analytics (if open) | Height expand from 0, 400ms |
| 500ms+ | Cards | Staggered cascade, 50ms delay each, existing `slide-up-fade` |

### Implementation
- CSS classes: `.page-enter-header`, `.page-enter-filters`, `.page-enter-content`
- Applied on mount, removed after animation completes
- `useEffect` with sequential `setTimeout` or CSS `animation-delay`
- Respect `prefers-reduced-motion`: skip to final state

### Files Modified
- `src/App.tsx` — add entrance orchestration state
- `src/styles/animations.css` — add page entrance keyframes
- `src/components/layout/Header.tsx` — entrance class
- `src/components/layout/FilterBar.tsx` — entrance class

---

## H. Score Count-Up Animation

### Behavior
- When card enters viewport (IntersectionObserver, threshold 0.3):
  - Numeric scores animate 0 → final value over 600ms, ease-out
  - Score bars fill from 0% → final width (coordinate with count-up)
  - Weighted score gets brief gold opacity pulse on completion
- Only triggers once per card (track with `data-counted` attribute)

### Implementation
- Custom hook: `useCountUp(target: number, duration: number, trigger: boolean)`
- Returns interpolated value via `requestAnimationFrame`
- Apply to ScoreBar fill width and numeric display

### Files Modified
- New: `src/hooks/useCountUp.ts`
- `src/components/ui/ScoreBar.tsx` — integrate count-up
- `src/components/screenplay/ScreenplayCard.tsx` — trigger on reveal

---

## I. Cinematic Empty States

### Context-Specific States
| Context | Icon/Visual | Copy |
|---------|-------------|------|
| No filter results | Spotlight cone SVG | "Nothing made the cut" |
| No FILM NOW | Dimmed star | "No FILM NOW contenders yet" |
| Empty collection | Film reel outline | "This collection is waiting for its first script" |
| Search no match | Magnifying glass + faded script | "No scripts match that search" |
| Error | Broken film strip | "Something snapped — try refreshing" |

### Styling
- Muted gold accents
- Barlow Condensed heading
- Subtle `fade-in` entrance animation (400ms)
- Centered, max-width 320px
- SVG icons inline, 64x64px, `stroke-gold-500/40`

### Files Modified
- `src/components/screenplay/ScreenplayGrid.tsx` — replace current empty state
- New: `src/components/ui/EmptyState.tsx` — reusable empty state component
- New: `src/components/ui/empty-state-icons.tsx` — SVG icon components

---

## J. Hover Card Quick-Peek

### Behavior (Desktop Only)
- After 500ms hover dwell time:
  - Card height expands ~80px with smooth transition
  - Reveals: unclamped logline + top 3 scores as inline pills
  - `transform: scale(1.02)` + elevated shadow
- Mouse-leave: contracts back, 200ms ease
- Disabled on touch devices (`@media (hover: hover)`)

### Implementation
- `useState` with `setTimeout` for dwell detection
- `onMouseEnter` starts timer, `onMouseLeave` clears and collapses
- Expanded content rendered but hidden (`max-height: 0; overflow: hidden`)
- Transition on `max-height` and `transform`

### Files Modified
- `src/components/screenplay/ScreenplayCard.tsx` — add peek state and expanded content

---

## K. Analytics Dashboard Entrance

### Animations on Panel Open
- Container: `max-height` transition from 0 → measured height, 400ms ease-out
- Bar charts: bars grow from 0 height, 300ms staggered (50ms delay each)
- Pie/donut: slices sweep clockwise, 400ms
- Quick-stat numbers: count up from 0, 600ms (reuse `useCountUp`)
- Content crossfade: `opacity` transition on inner content

### On Panel Close
- Reverse: content fades (150ms) → height collapses (300ms)

### Files Modified
- `src/components/charts/AnalyticsDashboard.tsx` — add open/close animation state
- Chart components — add entrance animation props

---

## L. Custom Scrollbar Polish

### Styling
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
::-webkit-scrollbar-thumb {
  background: rgba(245,158,11,0.3);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(245,158,11,0.5); }
```

### Scoping
- Global: page scrollbar
- Modal: `.modal-content::-webkit-scrollbar` same treatment
- Firefox: `scrollbar-width: thin; scrollbar-color: rgba(245,158,11,0.3) transparent;`

### Files Modified
- `src/index.css` — update existing scrollbar styles

---

## M. Card Drag Interaction Polish

### Drag State
- Active card: `rotate(2deg)` toward drag direction, `scale(1.05)`
- Shadow: `0 20px 40px rgba(245,158,11,0.2)`
- Opacity of original position: 0.3 (ghost)

### Drop Zone
- Pulsing gold dashed outline: `border: 2px dashed gold-400`, opacity pulses 0.3→0.8 on 500ms cycle
- Background: `rgba(245,158,11,0.05)`

### On Drop
- Scale bounce: `1.05 → 0.98 → 1.0`, 300ms ease

### Files Modified
- `src/components/screenplay/ScreenplayGrid.tsx` — DnD Kit overlay styling
- `src/index.css` — drag/drop utility classes

---

## N. Keyboard Shortcut Hints

### Hints
| Location | Hint | Shortcut |
|----------|------|----------|
| Search bar | "/ to search" | `/` |
| Modal | "Esc to close" | `Escape` |
| Card grid | "Arrow keys to navigate" | `← → ↑ ↓` |

### Behavior
- Appear after 2s of inactivity near the relevant element
- Disappear instantly on any keypress or mouse movement
- Show max once per session per hint (localStorage: `lemon-hints-shown`)
- Styled: glass background, 10px JetBrains Mono, 0.6 opacity, fade-in 300ms

### Files Modified
- New: `src/components/ui/ShortcutHint.tsx` — hint component
- New: `src/hooks/useShortcutHint.ts` — inactivity timer + localStorage logic
- `src/components/layout/FilterBar.tsx` — search hint
- `src/components/screenplay/ScreenplayModal.tsx` — modal hint

---

## O. Scroll Progress Indicator

### Implementation
- Fixed `div` at `top: 0`, full viewport width, `height: 2px`, `z-index: 60`
- Gold gradient background
- `transform: scaleX(0)` → `scaleX(1)` mapped to `scrollY / (docHeight - viewportHeight)`
- `transform-origin: left`
- Updated via `requestAnimationFrame` on scroll listener (passive)
- Subtle glow: `box-shadow: 0 0 8px rgba(245,158,11,0.3)`

### Files Modified
- New: `src/components/ui/ScrollProgress.tsx`
- `src/App.tsx` — render ScrollProgress

---

## P. Transition & Animation Refinements

### Filter Switch Reflow
- Remaining cards: `transition: transform 300ms ease`
- Exiting cards: `opacity 1→0`, 150ms, then remove
- Entering cards: `opacity 0→1`, 250ms, after reflow

### Analytics Toggle
- `max-height` transition + `overflow: hidden`
- Content opacity crossfade: 200ms

### Modal Close
- Reverse `scale-in`: `scale(1) → scale(0.95)` + `opacity 1→0`, 150ms

### Theme Switch
- Add to `html`: `transition: background-color 300ms, color 300ms, border-color 300ms`
- Smooth dark↔light transition instead of hard cut

### Files Modified
- `src/styles/animations.css` — modal close keyframe, theme transition
- `src/components/charts/AnalyticsDashboard.tsx` — toggle animation
- `src/index.css` — html transition properties

---

## Execution Phases

| Phase | Items | Est. Files Changed |
|-------|-------|--------------------|
| 1 — Foundation | A, B, F, L, O | ~8 files |
| 2 — Cards | C, H, J, M | ~6 files |
| 3 — Interaction | E, G, I, N, P | ~12 files |
| 4 — Modal | D | ~7 files |
| 5 — Analytics | K | ~3 files |

## New Files Created
- `src/hooks/useCountUp.ts`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/empty-state-icons.tsx`
- `src/components/ui/ShortcutHint.tsx`
- `src/components/ui/ScrollProgress.tsx`
- `src/hooks/useShortcutHint.ts`
- `src/components/screenplay/modal/ModalStickyBar.tsx`
- `src/components/screenplay/modal/ModalActionsBar.tsx`

## Dependencies Added
- Satoshi font (CDN link, no npm package)
