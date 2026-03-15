# Frontend Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Lemon Screenplay Dashboard from a polished-but-generic dark UI into a distinctive, cinematic, memorable production tool through 16 coordinated design changes.

**Architecture:** CSS-first approach for theming/atmosphere (Phase 1), then component-level changes for cards and interactions (Phases 2-3), modal structural redesign (Phase 4), and chart animation polish (Phase 5). Each phase produces a working, visually coherent state.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS 4 (@theme), CSS animations/transitions, IntersectionObserver, requestAnimationFrame, @dnd-kit, Recharts 3

**Spec:** `docs/superpowers/specs/2026-03-15-frontend-design-overhaul.md`

---

## Chunk 1: Foundation (Tasks 1-5)

### Task 1: Typography — Load Satoshi Font

**Files:**
- Modify: `index.html:8-10`
- Modify: `src/styles/typography.css:6`

- [ ] **Step 1: Add Satoshi font to index.html**

In `index.html`, add the Satoshi font link alongside existing fonts. Satoshi is available via Fontshare CDN:

```html
<!-- After existing preconnect lines (line 8), add: -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update typography.css font import**

In `src/styles/typography.css:6`, replace the Inter import:

```css
/* Remove: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); */
/* The Inter import can stay as fallback, but add Satoshi as primary */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

- [ ] **Step 3: Verify font loads in browser**

Run: `npm run dev`
Open browser DevTools → Network tab → filter "font" → confirm Satoshi woff2 files load.

- [ ] **Step 4: Commit**

```bash
git add index.html src/styles/typography.css
git commit -m "feat: load Satoshi font via Fontshare CDN"
```

---

### Task 2: Typography — Wire Font Variables

**Files:**
- Modify: `src/index.css:44-46` (font variables in @theme)
- Modify: `src/index.css:90-103` (base body styles)
- Modify: `src/styles/typography.css:34` (body font-family)

- [ ] **Step 1: Update @theme font variables**

In `src/index.css`, find the font variables inside the `@theme` block (around lines 44-46) and update:

```css
--font-display: 'Playfair Display', Georgia, serif;
--font-heading: 'Barlow Condensed', system-ui, sans-serif;
--font-body: 'Satoshi', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

Note: `--font-heading` is a NEW variable for section headers and card titles.

- [ ] **Step 2: Update base body font-family**

In `src/index.css`, in the base layer html/body section (around line 90-103), ensure the body uses the variable:

```css
body {
  font-family: var(--font-body);
  /* ... rest unchanged */
}
```

- [ ] **Step 3: Update typography.css body font**

In `src/styles/typography.css:34`, update:

```css
body {
  font-family: var(--font-body);
}
```

- [ ] **Step 4: Add heading font rules**

In `src/styles/typography.css`, after the body rule, update heading selectors to use the new heading font:

```css
h2, h3, h4 {
  font-family: var(--font-heading);
  letter-spacing: -0.01em;
}

h1 {
  font-family: var(--font-display);
}
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`
Inspect body text — should be Satoshi. Inspect card titles — should be Barlow Condensed. Inspect "LEMON" hero — should be Playfair Display.

- [ ] **Step 6: Run build to verify no TS errors**

Run: `npm run build`
Expected: successful build, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/styles/typography.css
git commit -m "feat: wire Satoshi body + Barlow Condensed heading fonts"
```

---

### Task 3: Color Palette Expansion

**Files:**
- Modify: `src/index.css:9-81` (@theme block — add new colors)
- Modify: `src/index.css:641+` (light mode overrides)

- [ ] **Step 1: Add burgundy, ivory, and teal to @theme**

In `src/index.css`, inside the `@theme { }` block, after the existing gold/black/emerald colors, add:

```css
/* Burgundy (secondary accent — cinema curtain warmth) */
--color-burgundy-50: #FFF1F2;
--color-burgundy-100: #FFE4E6;
--color-burgundy-200: #FECDD3;
--color-burgundy-300: #FDA4AF;
--color-burgundy-400: #FB7185;
--color-burgundy-500: #F43F5E;
--color-burgundy-600: #E11D48;
--color-burgundy-700: #BE123C;
--color-burgundy-800: #9F1239;
--color-burgundy-900: #881337;
--color-burgundy-950: #4C0519;

/* Warm Ivory (light mode card tint) */
--color-ivory: #FFFBEB;

/* Midnight Teal (tertiary accent) */
--color-teal-50: #F0FDFA;
--color-teal-100: #CCFBF1;
--color-teal-200: #99F6E4;
--color-teal-300: #5EEAD4;
--color-teal-400: #2DD4BF;
--color-teal-500: #14B8A6;
--color-teal-600: #0D9488;
--color-teal-700: #0F766E;
--color-teal-800: #115E59;
--color-teal-900: #134E4A;
--color-teal-950: #042F2E;
```

- [ ] **Step 2: Add ivory to light mode card overrides**

In the `html.light` section (around line 641+), find card background overrides and change from pure white to ivory:

```css
html.light .card {
  background: var(--color-ivory);
  /* ... keep existing border/shadow overrides */
}
```

- [ ] **Step 3: Verify colors are available**

Run: `npm run dev`
In DevTools, inspect a card element → Computed styles → confirm `--color-burgundy-800` resolves to `#9F1239`.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: add burgundy, ivory, and teal color palette"
```

---

### Task 4: Film Grain + Atmospheric Background

**Files:**
- Modify: `src/index.css:90-103` (base body — add ::after grain overlay)
- Modify: `src/styles/mesh-gradients.css:7-65` (enhance gradients, add bokeh)

- [ ] **Step 1: Add film grain overlay to body**

In `src/index.css`, in the `@layer base` section, add a `::after` pseudo-element to the body:

```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.03;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

html.light body::after {
  opacity: 0.015;
}
```

- [ ] **Step 2: Enhance mesh gradient opacity**

In `src/styles/mesh-gradients.css`, find the `::before` and `::after` pseudo-elements of `.mesh-gradient-hero` (around lines 7-43). Increase the glow opacity:

Change any `opacity` values on the glow elements from `0.03` or similar to `0.07`.

- [ ] **Step 3: Add bokeh light leak keyframes**

In `src/styles/mesh-gradients.css`, add after the existing keyframes:

```css
@keyframes float-bokeh-1 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(30px, -20px); }
  66% { transform: translate(-20px, 15px); }
}

@keyframes float-bokeh-2 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(-25px, 30px); }
  66% { transform: translate(15px, -25px); }
}

@keyframes float-bokeh-3 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, 20px); }
}
```

- [ ] **Step 4: Add bokeh elements to mesh-gradient-dashboard**

In `src/styles/mesh-gradients.css`, find `.mesh-gradient-dashboard` (or the class applied to the main page background). Add bokeh elements using box-shadow on a dedicated pseudo-element or a new class:

```css
.bokeh-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bokeh-atmosphere::before {
  content: '';
  position: absolute;
  top: -10%;
  left: -5%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.04) 0%, transparent 70%);
  animation: float-bokeh-1 55s ease-in-out infinite;
}

.bokeh-atmosphere::after {
  content: '';
  position: absolute;
  bottom: -5%;
  right: -5%;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(15, 118, 110, 0.035) 0%, transparent 70%);
  animation: float-bokeh-2 65s ease-in-out infinite;
}
```

- [ ] **Step 5: Add bokeh container to App.tsx**

In `src/App.tsx`, add the bokeh atmosphere div as the first child inside the root container (before `<Header />`):

```tsx
<div className="bokeh-atmosphere" aria-hidden="true" />
```

- [ ] **Step 6: Enhance mesh gradient color drift**

In `src/styles/mesh-gradients.css`, modify the `float-ocean-1` keyframe (lines 46-55) to include color drift:

```css
@keyframes float-ocean-1 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    background: radial-gradient(circle, rgba(6, 182, 212, 0.07) 0%, transparent 70%);
  }
  50% {
    transform: translate(30px, -20px) scale(1.1);
    background: radial-gradient(circle, rgba(26, 26, 62, 0.09) 0%, transparent 70%);
  }
}
```

- [ ] **Step 7: Verify visually**

Run: `npm run dev`
Confirm: subtle grain texture visible on dark background, enhanced glowing orbs, bokeh dots drifting at corners.

- [ ] **Step 8: Commit**

```bash
git add src/index.css src/styles/mesh-gradients.css src/App.tsx
git commit -m "feat: add film grain overlay, bokeh light leaks, enhance mesh gradients"
```

---

### Task 5: Scrollbar Polish + Scroll Progress Indicator

**Files:**
- Modify: `src/index.css:152-169` (scrollbar styles)
- Create: `src/components/ui/ScrollProgress.tsx`
- Modify: `src/App.tsx` (render ScrollProgress)

- [ ] **Step 1: Refine scrollbar styles**

In `src/index.css`, replace the existing scrollbar styles (around lines 152-169) with:

```css
/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

::-webkit-scrollbar-thumb {
  background: rgba(245, 158, 11, 0.25);
  border-radius: 3px;
  transition: background 0.2s;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(245, 158, 11, 0.5);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(245, 158, 11, 0.25) transparent;
}

html.light ::-webkit-scrollbar-thumb {
  background: rgba(180, 83, 9, 0.2);
}
html.light ::-webkit-scrollbar-thumb:hover {
  background: rgba(180, 83, 9, 0.4);
}
```

- [ ] **Step 2: Create ScrollProgress component**

Create `src/components/ui/ScrollProgress.tsx`:

```tsx
import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number;

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = docHeight > 0 ? scrollTop / docHeight : 0;
      setProgress(scrolled);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateProgress);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-60 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-gold-400 to-gold-600 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
        style={{
          transform: `scaleX(${progress})`,
          transformOrigin: 'left',
          transition: 'transform 0.1s linear',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add z-60 to theme if needed**

In `src/index.css`, check if `z-60` is defined. If not, Tailwind 4 supports arbitrary values so `z-60` should work via `z-[60]`. Use `z-[60]` in the component instead if `z-60` is not in the theme.

- [ ] **Step 4: Render ScrollProgress in App.tsx**

In `src/App.tsx`, import and render before the Header:

```tsx
import { ScrollProgress } from './components/ui/ScrollProgress';

// Inside the return, as the first element:
<ScrollProgress />
```

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Scroll the page — confirm gold line grows at the top of viewport. Check scrollbar is thin and gold-tinted.

- [ ] **Step 6: Run build**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/ui/ScrollProgress.tsx src/App.tsx
git commit -m "feat: polish scrollbars + add scroll progress indicator"
```

---

## Chunk 2: Cards (Tasks 6-9)

### Task 6: Card Visual Hierarchy by Tier

**Files:**
- Modify: `src/index.css:358-381` (card classes)
- Modify: `src/components/screenplay/ScreenplayCard.tsx:87-116` (className assembly)

- [ ] **Step 1: Add tier-based card classes to index.css**

In `src/index.css`, after the existing `.card-film-now` class (around line 381), add:

```css
.card-recommend {
  border-left: 3px solid var(--color-emerald-500);
}

.card-recommend:hover {
  box-shadow: var(--shadow-md), 0 0 20px rgba(16, 185, 129, 0.1);
}

.card-pass {
  opacity: 0.65;
  transition: opacity 0.3s ease;
}

.card-pass:hover {
  opacity: 1;
}

/* Override hover-lift for pass cards */
.card-pass:hover {
  transform: none;
}
```

Also enhance `.card-film-now` with a gradient wash:

```css
.card-film-now {
  /* keep existing styles, add: */
  background-image: linear-gradient(
    180deg,
    rgba(245, 158, 11, 0.08) 0%,
    rgba(245, 158, 11, 0) 30%
  );
  padding-top: 1.5rem;
}
```

- [ ] **Step 2: Apply tier classes in ScreenplayCard.tsx**

In `src/components/screenplay/ScreenplayCard.tsx`, find the className assembly (around lines 87-116). Add conditional tier classes:

```tsx
const tierClass = (() => {
  switch (screenplay.recommendation) {
    case 'film_now': return 'card-film-now';
    case 'recommend': return 'card-recommend';
    case 'pass': return 'card-pass';
    default: return '';
  }
})();
```

Apply `tierClass` to the card's root className, ensuring it's added alongside the existing `card` class.

- [ ] **Step 3: Modify FILM NOW logline display**

In `ScreenplayCard.tsx`, find where the logline is rendered with `line-clamp-2`. For FILM NOW cards, remove the clamp:

```tsx
<p className={`text-sm text-black-300 ${
  screenplay.recommendation === 'film_now' ? '' : 'line-clamp-2'
}`}>
  {screenplay.logline}
</p>
```

- [ ] **Step 4: De-emphasize PASS card scores**

In `ScreenplayCard.tsx`, where scores are rendered (around lines 176-203), reduce font size for PASS:

```tsx
const scoreTextClass = screenplay.recommendation === 'pass' ? 'text-xs' : 'text-sm';
```

Apply this to score labels and values.

- [ ] **Step 5: Verify all four tiers visually**

Run: `npm run dev`
Confirm: FILM NOW has gold gradient wash + full logline. RECOMMEND has emerald left border. CONSIDER is unchanged. PASS is dimmed at 0.65 opacity, restores on hover.

- [ ] **Step 6: Run tests**

Run: `npm run test:run`
Expected: all existing tests pass (styling changes shouldn't break logic).

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/screenplay/ScreenplayCard.tsx
git commit -m "feat: add tier-based card visual hierarchy (FILM NOW/recommend/pass)"
```

---

### Task 7: Score Count-Up Animation

**Files:**
- Create: `src/hooks/useCountUp.ts`
- Modify: `src/components/ui/ScoreBar.tsx:24-40`
- Modify: `src/components/screenplay/ScreenplayCard.tsx` (trigger on reveal)

- [ ] **Step 1: Create useCountUp hook**

Create `src/hooks/useCountUp.ts`:

```tsx
import { useEffect, useRef, useState } from 'react';

export function useCountUp(
  target: number,
  duration: number = 600,
  trigger: boolean = true
): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!trigger || hasAnimated.current || target === 0) return;

    hasAnimated.current = true;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, trigger]);

  // If reduced motion is preferred, skip animation
  if (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return target;
  }

  return trigger ? value : 0;
}
```

- [ ] **Step 2: Integrate count-up into ScoreBar**

In `src/components/ui/ScoreBar.tsx`, add an optional `animate` prop:

```tsx
interface ScoreBarProps {
  // ... existing props
  animate?: boolean;
}
```

Use `useCountUp` for the bar width when `animate` is true:

```tsx
import { useCountUp } from '../../hooks/useCountUp';

// Inside the component:
const animatedScore = useCountUp(safeScore, 600, animate ?? true);
const displayWidth = `${(animatedScore / max) * 100}%`;
```

Apply `displayWidth` to the fill bar's `style.width`.

- [ ] **Step 3: Pass reveal state from ScreenplayCard to ScoreBar**

In `ScreenplayCard.tsx`, the card already uses `data-reveal` / `data-revealed` for scroll-reveal. Thread the revealed state to ScoreBar components:

```tsx
const [isRevealed, setIsRevealed] = useState(false);

// In the IntersectionObserver callback or via a ref:
// Set isRevealed to true when the card enters viewport

// Pass to ScoreBar:
<ScoreBar score={value} animate={isRevealed} />
```

- [ ] **Step 4: Verify animation**

Run: `npm run dev`
Scroll down — cards entering viewport should have scores counting up from 0 and bars filling from left. Already-visible cards should also animate on initial load.

- [ ] **Step 5: Run build + tests**

Run: `npm run build && npm run test:run`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCountUp.ts src/components/ui/ScoreBar.tsx src/components/screenplay/ScreenplayCard.tsx
git commit -m "feat: add score count-up animation on card viewport entry"
```

---

### Task 8: Hover Card Quick-Peek

**Files:**
- Modify: `src/components/screenplay/ScreenplayCard.tsx`

- [ ] **Step 1: Add peek state and timer logic**

In `ScreenplayCard.tsx`, add state for the quick-peek:

```tsx
const [isPeeking, setIsPeeking] = useState(false);
const peekTimerRef = useRef<ReturnType<typeof setTimeout>>();

const handleMouseEnter = () => {
  peekTimerRef.current = setTimeout(() => setIsPeeking(true), 500);
};

const handleMouseLeave = () => {
  clearTimeout(peekTimerRef.current);
  setIsPeeking(false);
};

useEffect(() => {
  return () => clearTimeout(peekTimerRef.current);
}, []);
```

- [ ] **Step 2: Apply hover handlers and peek styles**

On the card root element, add the handlers:

```tsx
onMouseEnter={handleMouseEnter}
onMouseLeave={handleMouseLeave}
```

Add peek transition classes:

```tsx
className={clsx(
  // ... existing classes
  isPeeking && 'scale-[1.02] shadow-lg shadow-gold-500/10',
  'transition-all duration-200 ease-out'
)}
```

- [ ] **Step 3: Add expanded content section**

After the existing logline, add the peek-expanded content:

```tsx
{/* Quick-peek expanded content */}
<div
  className={clsx(
    'overflow-hidden transition-all duration-200 ease-out',
    isPeeking ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'
  )}
>
  {/* Full logline (unclamped) */}
  <p className="text-sm text-black-300 mb-2">{screenplay.logline}</p>
  {/* Top 3 scores as pills */}
  <div className="flex gap-1.5 flex-wrap">
    {Object.entries(screenplay.scores || {})
      .slice(0, 3)
      .map(([key, val]) => (
        <span
          key={key}
          className="text-xs font-mono px-2 py-0.5 rounded-full bg-black-800 text-black-200"
        >
          {key}: {typeof val === 'number' ? val.toFixed(1) : val}
        </span>
      ))}
  </div>
</div>
```

- [ ] **Step 4: Scope to desktop only**

Wrap the handlers in a media query check or use CSS `@media (hover: hover)` to ensure this only triggers on hover-capable devices. The simplest approach:

```tsx
const supportsHover = typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover)').matches;

// Only attach handlers if hover is supported:
onMouseEnter={supportsHover ? handleMouseEnter : undefined}
onMouseLeave={supportsHover ? handleMouseLeave : undefined}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`
Hover over a card for 500ms — it should expand to show full logline and score pills. Move away — it contracts.

- [ ] **Step 6: Commit**

```bash
git add src/components/screenplay/ScreenplayCard.tsx
git commit -m "feat: add hover quick-peek with expanded logline and score pills"
```

---

### Task 9: Card Drag Interaction Polish

**Files:**
- Modify: `src/index.css` (add drag utility classes)
- Modify: `src/components/screenplay/ScreenplayGrid.tsx` (DnD overlay styling)

- [ ] **Step 1: Add drag interaction CSS classes**

In `src/index.css`, in the utilities layer, add:

```css
.card-dragging {
  transform: rotate(2deg) scale(1.05);
  box-shadow: 0 20px 40px rgba(245, 158, 11, 0.2);
  z-index: 50;
  cursor: grabbing;
}

.card-drag-ghost {
  opacity: 0.3;
}

.card-drop-zone {
  border: 2px dashed var(--color-gold-400);
  background: rgba(245, 158, 11, 0.05);
  animation: pulse-drop-zone 0.5s ease-in-out infinite alternate;
}

@keyframes pulse-drop-zone {
  from { border-color: rgba(245, 158, 11, 0.3); }
  to { border-color: rgba(245, 158, 11, 0.8); }
}

.card-drop-bounce {
  animation: drop-bounce 300ms ease;
}

@keyframes drop-bounce {
  0% { transform: scale(1.05); }
  50% { transform: scale(0.98); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 2: Apply classes to DnD Kit overlay**

In `src/components/screenplay/ScreenplayGrid.tsx`, find where `@dnd-kit` drag overlay is rendered. Apply the `card-dragging` class to the overlay element and `card-drag-ghost` to the original card position during drag.

This depends on the existing DnD implementation. Look for `DragOverlay`, `useSortable`, or similar. Apply classes accordingly:

```tsx
// On DragOverlay child:
className="card-dragging"

// On the original item while active:
className={clsx('card', isActive && 'card-drag-ghost')}
```

- [ ] **Step 3: Verify drag behavior**

Run: `npm run dev`
Drag a card — it should tilt, scale up, and get a gold shadow. The original position should ghost out. Drop zone should pulse.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/screenplay/ScreenplayGrid.tsx
git commit -m "feat: polish card drag interactions (tilt, glow, bounce)"
```

---

## Chunk 3: Interaction (Tasks 10-14)

### Task 10: Filter Bar — Sliding Active Indicator

**Files:**
- Modify: `src/components/layout/FilterBar.tsx:247-258` (filter chips)

- [ ] **Step 1: Add refs to measure chip positions**

In `FilterBar.tsx`, create refs for measuring chip positions:

```tsx
const chipsContainerRef = useRef<HTMLDivElement>(null);
const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

useEffect(() => {
  const container = chipsContainerRef.current;
  if (!container) return;

  const activeChip = container.querySelector('[data-active="true"]') as HTMLElement;
  if (activeChip) {
    setIndicatorStyle({
      left: activeChip.offsetLeft,
      width: activeChip.offsetWidth,
    });
  }
}, [activeFilter]); // activeFilter = whatever state drives the current filter
```

- [ ] **Step 2: Add sliding indicator element**

Inside the chips container div, add the indicator:

```tsx
<div ref={chipsContainerRef} className="relative flex gap-2">
  {/* Sliding indicator */}
  <div
    className="absolute bottom-0 h-[3px] rounded-full bg-gold-500 transition-all duration-250"
    style={{
      left: indicatorStyle.left,
      width: indicatorStyle.width,
      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}
  />

  {/* Existing filter chips */}
  {FILTER_CHIPS.map((chip) => (
    <button
      key={chip.key}
      data-active={chip.key === activeFilter}
      // ... existing chip props
    >
      {chip.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Add data-active attribute to chips**

Ensure each filter chip button has `data-active={isActive}` so the ref measurement can find the active one.

- [ ] **Step 4: Verify animation**

Run: `npm run dev`
Click between filter chips — gold bar should slide smoothly between them with a spring-like overshoot.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/FilterBar.tsx
git commit -m "feat: add sliding active indicator to filter chips"
```

---

### Task 11: Filter Bar — Search Expand + Count Animation

**Files:**
- Modify: `src/components/layout/FilterBar.tsx:122-161` (search + results count)

- [ ] **Step 1: Add focus state for search expand**

In `FilterBar.tsx`, add state for search focus:

```tsx
const [isSearchFocused, setIsSearchFocused] = useState(false);
```

On the search input:

```tsx
<input
  className={clsx(
    'input transition-all duration-300 ease-out',
    isSearchFocused ? 'w-[360px]' : 'w-52'
  )}
  onFocus={() => setIsSearchFocused(true)}
  onBlur={() => setIsSearchFocused(false)}
  // ... existing props
/>
```

- [ ] **Step 2: Add count fade animation**

For the results count display (around lines 153-161), wrap in a transition container:

```tsx
<span
  key={filteredCount} // key change forces re-render → triggers animation
  className="animate-fade-in font-mono text-sm text-black-400"
>
  Showing {filteredCount} of {totalCount} screenplays
</span>
```

The existing `fade-in` animation in `animations.css` handles the entrance.

- [ ] **Step 3: Verify**

Run: `npm run dev`
Click search — input expands. Filter changes — count fades in with new number.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/FilterBar.tsx
git commit -m "feat: search expand on focus + count fade animation"
```

---

### Task 12: Page Load Orchestration

**Files:**
- Modify: `src/styles/animations.css` (add page entrance keyframes)
- Modify: `src/App.tsx` (add entrance classes)
- Modify: `src/components/layout/Header.tsx:47` (entrance class)

- [ ] **Step 1: Add page entrance keyframes**

In `src/styles/animations.css`, add:

```css
@keyframes page-enter-slide-down {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes page-enter-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.page-enter-header {
  animation: page-enter-slide-down 350ms ease-out both;
  animation-delay: 100ms;
}

.page-enter-filters {
  animation: page-enter-fade 300ms ease-out both;
  animation-delay: 250ms;
}

.page-enter-content {
  animation: page-enter-fade 400ms ease-out both;
  animation-delay: 400ms;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-header,
  .page-enter-filters,
  .page-enter-content {
    animation: none;
  }
}
```

- [ ] **Step 2: Apply entrance classes in App.tsx**

In `src/App.tsx`, add entrance classes to the main layout sections:

On the Header wrapper or Header component itself:
```tsx
<div className="page-enter-header">
  <Header />
</div>
```

On the FilterBar area:
```tsx
<div className="page-enter-filters">
  <FilterBar ... />
</div>
```

On the content area (grid + analytics):
```tsx
<div className="page-enter-content">
  <AnalyticsDashboard />
  <ScreenplayGrid ... />
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
Hard refresh the page — header should slide down first, then filter bar fades in, then content appears. Total sequence ~800ms.

- [ ] **Step 4: Commit**

```bash
git add src/styles/animations.css src/App.tsx
git commit -m "feat: orchestrated page load entrance sequence"
```

---

### Task 13: Cinematic Empty States

**Files:**
- Create: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/screenplay/ScreenplayGrid.tsx:74-128` (replace empty state)

- [ ] **Step 1: Create EmptyState component**

Create `src/components/ui/EmptyState.tsx`:

```tsx
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 animate-fade-in">
      <div className="text-gold-500/40 mb-6">
        {icon}
      </div>
      <h3 className="font-heading text-xl text-black-200 mb-2 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-black-400 max-w-xs text-center mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create inline SVG icons**

In the same file or a separate file, add context-specific icons as SVG components:

```tsx
export function SpotlightIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M32 8L20 48h24L32 8z" opacity="0.3" />
      <circle cx="32" cy="52" r="8" opacity="0.5" />
      <line x1="32" y1="4" x2="32" y2="12" />
      <line x1="24" y1="6" x2="28" y2="13" />
      <line x1="40" y1="6" x2="36" y2="13" />
    </svg>
  );
}

export function DimmedStarIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M32 8l6 18h18l-14 10 5 18-15-11-15 11 5-18L8 26h18z" opacity="0.4" />
    </svg>
  );
}

export function FilmReelIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="32" cy="32" r="24" opacity="0.3" />
      <circle cx="32" cy="32" r="8" opacity="0.5" />
      <circle cx="32" cy="12" r="3" opacity="0.4" />
      <circle cx="32" cy="52" r="3" opacity="0.4" />
      <circle cx="12" cy="32" r="3" opacity="0.4" />
      <circle cx="52" cy="32" r="3" opacity="0.4" />
    </svg>
  );
}

export function SearchEmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="28" cy="28" r="16" opacity="0.4" />
      <line x1="40" y1="40" x2="54" y2="54" opacity="0.5" strokeWidth="2" />
      <path d="M20 28h16M28 20v16" opacity="0.2" />
    </svg>
  );
}
```

- [ ] **Step 3: Replace ScreenplayGrid empty state**

In `src/components/screenplay/ScreenplayGrid.tsx`, replace the existing empty state block (lines 74-128) with context-aware empty states:

```tsx
import { EmptyState, SpotlightIcon, DimmedStarIcon, FilmReelIcon, SearchEmptyIcon } from '../ui/EmptyState';

// Determine which empty state to show based on active filters:
const renderEmptyState = () => {
  if (searchQuery) {
    return (
      <EmptyState
        icon={<SearchEmptyIcon />}
        title="No scripts match that search"
        description="Try adjusting your search terms or clearing filters"
      />
    );
  }
  if (activeFilter === 'film_now') {
    return (
      <EmptyState
        icon={<DimmedStarIcon />}
        title="No FILM NOW contenders yet"
        description="None of the current screenplays have earned top-tier status"
      />
    );
  }
  if (activeCollection) {
    return (
      <EmptyState
        icon={<FilmReelIcon />}
        title="This collection is waiting for its first script"
        description="Drag screenplays here or assign them from the card menu"
      />
    );
  }
  return (
    <EmptyState
      icon={<SpotlightIcon />}
      title="Nothing made the cut"
      description="Try adjusting your filters to see more screenplays"
    />
  );
};
```

- [ ] **Step 4: Add `font-heading` utility class**

If Tailwind 4 doesn't auto-generate `font-heading` from the CSS variable, add to `src/index.css` utilities:

```css
.font-heading {
  font-family: var(--font-heading);
}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`
Apply a filter that returns 0 results — confirm cinematic empty state with appropriate icon and copy.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/EmptyState.tsx src/components/screenplay/ScreenplayGrid.tsx src/index.css
git commit -m "feat: cinematic context-aware empty states"
```

---

### Task 14: Keyboard Shortcut Hints + Transition Refinements

**Files:**
- Create: `src/hooks/useShortcutHint.ts`
- Create: `src/components/ui/ShortcutHint.tsx`
- Modify: `src/components/layout/FilterBar.tsx` (search hint)
- Modify: `src/styles/animations.css` (theme transition, modal close)
- Modify: `src/index.css` (html transition for theme switch)

- [ ] **Step 1: Create useShortcutHint hook**

Create `src/hooks/useShortcutHint.ts`:

```tsx
import { useEffect, useRef, useState } from 'react';

const SHOWN_KEY = 'lemon-hints-shown';

function getShownHints(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markShown(id: string) {
  const shown = getShownHints();
  shown.add(id);
  localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]));
}

export function useShortcutHint(id: string, delayMs: number = 2000): boolean {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (getShownHints().has(id)) return;

    const startTimer = () => {
      timerRef.current = setTimeout(() => setVisible(true), delayMs);
    };

    const dismiss = () => {
      clearTimeout(timerRef.current);
      if (visible) {
        setVisible(false);
        markShown(id);
      }
    };

    startTimer();

    window.addEventListener('keydown', dismiss);
    window.addEventListener('mousemove', dismiss, { once: true });

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('mousemove', dismiss);
    };
  }, [id, delayMs, visible]);

  return visible;
}
```

- [ ] **Step 2: Create ShortcutHint component**

Create `src/components/ui/ShortcutHint.tsx`:

```tsx
import { useShortcutHint } from '../../hooks/useShortcutHint';

interface ShortcutHintProps {
  id: string;
  label: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function ShortcutHint({ id, label, position = 'bottom' }: ShortcutHintProps) {
  const visible = useShortcutHint(id);

  if (!visible) return null;

  const positionClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
    left: 'right-full mr-1',
    right: 'left-full ml-1',
  };

  return (
    <span
      className={`absolute ${positionClasses[position]} z-50 px-2 py-0.5 rounded glass
        font-mono text-[10px] text-black-300 opacity-60 animate-fade-in whitespace-nowrap
        pointer-events-none`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Add hint to search input**

In `src/components/layout/FilterBar.tsx`, wrap the search input area in a `relative` container and add:

```tsx
<div className="relative">
  <input ... />
  <ShortcutHint id="search" label="/ to search" position="bottom" />
</div>
```

- [ ] **Step 4: Add theme switch transition**

In `src/index.css`, add to the base html rule:

```css
html {
  transition: background-color 300ms ease, color 300ms ease;
}
```

- [ ] **Step 5: Add modal close animation**

In `src/styles/animations.css`, add:

```css
@keyframes scale-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.animate-scale-out {
  animation: scale-out 150ms ease-in forwards;
}
```

- [ ] **Step 6: Verify**

Run: `npm run dev`
Wait 2s without interacting — "/ to search" hint should appear near the search bar. Theme toggle should transition smoothly.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useShortcutHint.ts src/components/ui/ShortcutHint.tsx src/components/layout/FilterBar.tsx src/styles/animations.css src/index.css
git commit -m "feat: keyboard shortcut hints + theme/modal transition polish"
```

---

## Chunk 4: Modal Redesign (Tasks 15-16)

### Task 15: Modal Split-Panel Layout

**Files:**
- Modify: `src/components/screenplay/ScreenplayModal.tsx:85-144`
- Modify: `src/components/screenplay/modal/ModalHeader.tsx`
- Create: `src/components/screenplay/modal/ModalStickyBar.tsx`
- Create: `src/components/screenplay/modal/ModalActionsBar.tsx`

- [ ] **Step 1: Create ModalStickyBar**

Create `src/components/screenplay/modal/ModalStickyBar.tsx`:

```tsx
import { RecommendationBadge } from '../../ui/RecommendationBadge';
import type { Screenplay } from '../../../types/screenplay';

interface ModalStickyBarProps {
  screenplay: Screenplay;
  visible: boolean;
}

export function ModalStickyBar({ screenplay, visible }: ModalStickyBarProps) {
  return (
    <div
      className={`sticky top-0 z-10 glass-dark h-12 flex items-center justify-between px-4
        border-b border-gold-500/10 transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RecommendationBadge recommendation={screenplay.recommendation} size="sm" />
        <h4 className="font-heading text-sm text-black-100 truncate">
          {screenplay.title}
        </h4>
      </div>
      <span className="font-mono text-sm font-bold text-gold-400">
        {screenplay.weightedScore?.toFixed(1) ?? '—'}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create ModalActionsBar**

Create `src/components/screenplay/modal/ModalActionsBar.tsx`:

```tsx
interface ModalActionsBarProps {
  onCompare?: () => void;
  onExport?: () => void;
  onNotes?: () => void;
  onDelete?: () => void;
  isCompared?: boolean;
}

export function ModalActionsBar({
  onCompare,
  onExport,
  onNotes,
  onDelete,
  isCompared,
}: ModalActionsBarProps) {
  return (
    <div className="sticky bottom-0 z-10 glass-dark border-t border-gold-500/10 px-4 py-2
      flex items-center gap-2">
      {onCompare && (
        <button
          onClick={onCompare}
          className={`btn-ghost text-xs ${isCompared ? 'text-gold-400' : ''}`}
        >
          Compare
        </button>
      )}
      {onExport && (
        <button onClick={onExport} className="btn-ghost text-xs">
          Export
        </button>
      )}
      {onNotes && (
        <button onClick={onNotes} className="btn-ghost text-xs">
          Notes
        </button>
      )}
      <div className="flex-1" />
      {onDelete && (
        <button onClick={onDelete} className="btn-ghost text-xs text-red-400 hover:text-red-300">
          Delete
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Redesign ModalHeader as hero banner**

In `src/components/screenplay/modal/ModalHeader.tsx`, transform the header into a hero banner:

```tsx
// The hero banner should have:
// - Full-width background: bg-gradient-to-br from-burgundy-950 to-black-950
// - Large title: font-heading text-2xl
// - Recommendation badge prominently displayed
// - Weighted score as large number on the right
// - Close button (X) top-right corner
// - Author name below title in text-black-400
```

Keep the existing action buttons but move them to the new ModalActionsBar instead.

- [ ] **Step 4: Restructure ScreenplayModal to split-panel**

In `src/components/screenplay/ScreenplayModal.tsx`, change the modal content from single-column to split-panel:

```tsx
{/* Hero Banner */}
<ModalHeader screenplay={screenplay} onClose={onClose} />

{/* Sticky score bar (appears when hero scrolls away) */}
<ModalStickyBar screenplay={screenplay} visible={isHeroBannerHidden} />

{/* Split Panel */}
<div className="flex flex-col md:flex-row flex-1 overflow-hidden">
  {/* Left: Sticky scores panel */}
  <div className="md:w-2/5 md:max-w-[360px] md:sticky md:top-0 md:self-start
    overflow-y-auto p-6 border-r border-gold-500/10">
    <ScoresPanel screenplay={screenplay} />
    <ProducerMetricsPanel screenplay={screenplay} />
  </div>

  {/* Right: Scrollable content */}
  <div className="flex-1 overflow-y-auto p-6 space-y-8">
    <ContentDetails screenplay={screenplay} />
    <NotesSection screenplay={screenplay} />
    <FeedbackSection screenplay={screenplay} />
  </div>
</div>

{/* Floating Actions */}
<ModalActionsBar onCompare={...} onExport={...} onNotes={...} onDelete={...} />
```

- [ ] **Step 5: Add IntersectionObserver for sticky bar**

Track whether the hero banner is visible:

```tsx
const heroBannerRef = useRef<HTMLDivElement>(null);
const [isHeroBannerHidden, setIsHeroBannerHidden] = useState(false);

useEffect(() => {
  const el = heroBannerRef.current;
  if (!el) return;

  const observer = new IntersectionObserver(
    ([entry]) => setIsHeroBannerHidden(!entry.isIntersecting),
    { threshold: 0 }
  );

  observer.observe(el);
  return () => observer.disconnect();
}, []);
```

Pass `heroBannerRef` to the ModalHeader component.

- [ ] **Step 6: Handle mobile layout**

The split-panel uses `flex-col md:flex-row`. On mobile:
- Left panel is not sticky (just stacks above)
- Full width for both panels
- Actions bar still sticky at bottom

- [ ] **Step 7: Verify**

Run: `npm run dev`
Open a screenplay modal — confirm hero banner with burgundy gradient, split-panel layout on desktop, sticky bar appears when scrolling past hero, floating actions at bottom.

- [ ] **Step 8: Run build + tests**

Run: `npm run build && npm run test:run`
Expected: success.

- [ ] **Step 9: Commit**

```bash
git add src/components/screenplay/ScreenplayModal.tsx src/components/screenplay/modal/ModalHeader.tsx src/components/screenplay/modal/ModalStickyBar.tsx src/components/screenplay/modal/ModalActionsBar.tsx
git commit -m "feat: modal split-panel redesign with hero banner and sticky actions"
```

---

### Task 16: Modal Close Animation

**Files:**
- Modify: `src/components/screenplay/ScreenplayModal.tsx`

- [ ] **Step 1: Add close animation state**

In `ScreenplayModal.tsx`, add a closing state:

```tsx
const [isClosing, setIsClosing] = useState(false);

const handleClose = () => {
  setIsClosing(true);
  setTimeout(() => {
    setIsClosing(false);
    onClose(); // original close handler
  }, 150);
};
```

- [ ] **Step 2: Apply close animation class**

On the modal content div:

```tsx
className={clsx(
  'max-w-4xl rounded-2xl',
  isClosing ? 'animate-scale-out' : 'animate-scale-in'
)}
```

On the backdrop overlay:

```tsx
className={clsx(
  'fixed inset-0 bg-black-950/80 backdrop-blur-sm transition-opacity duration-150',
  isClosing ? 'opacity-0' : 'opacity-100'
)}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`
Open then close a modal — it should scale down and fade out smoothly (150ms) instead of vanishing.

- [ ] **Step 4: Commit**

```bash
git add src/components/screenplay/ScreenplayModal.tsx
git commit -m "feat: smooth modal close animation"
```

---

## Chunk 5: Analytics Polish (Task 17)

### Task 17: Analytics Dashboard Entrance Animation

**Files:**
- Modify: `src/components/charts/AnalyticsDashboard.tsx:30-159`

- [ ] **Step 1: Add height transition for panel toggle**

In `AnalyticsDashboard.tsx`, wrap the charts grid in an animated container:

```tsx
const contentRef = useRef<HTMLDivElement>(null);

<div
  ref={contentRef}
  className={clsx(
    'overflow-hidden transition-all duration-400 ease-out',
    isExpanded ? 'opacity-100' : 'max-h-0 opacity-0'
  )}
  style={isExpanded ? { maxHeight: contentRef.current?.scrollHeight ?? 'none' } : undefined}
>
  {/* chart grid content */}
</div>
```

- [ ] **Step 2: Add chart entrance animation classes**

Add staggered entrance for each chart container:

```tsx
{isExpanded && charts.map((chart, i) => (
  <div
    key={chart.id}
    className="animate-fade-in"
    style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
  >
    {chart.component}
  </div>
))}
```

- [ ] **Step 3: Add stat count-up on expand**

Import and use `useCountUp` for the quick-stats numbers:

```tsx
import { useCountUp } from '../../hooks/useCountUp';

// For each stat:
const animatedTotal = useCountUp(totalScreenplays, 600, isExpanded);
const animatedAvg = useCountUp(avgScore, 600, isExpanded);
```

Display `animatedTotal.toFixed(0)` and `animatedAvg.toFixed(1)`.

- [ ] **Step 4: Verify**

Run: `npm run dev`
Toggle analytics open — panel should expand smoothly, charts fade in staggered, stat numbers count up. Toggle closed — smooth collapse.

- [ ] **Step 5: Run full test suite**

Run: `npm run build && npm run test:run`
Expected: all tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/AnalyticsDashboard.tsx
git commit -m "feat: analytics dashboard entrance animation with count-up stats"
```

---

## Final Verification

- [ ] **Full build**: `npm run build` — zero errors
- [ ] **Test suite**: `npm run test:run` — all pass
- [ ] **Visual QA**: Check dark mode, light mode, mobile viewport, reduced motion
- [ ] **Performance**: Lighthouse check — animations shouldn't impact LCP/CLS significantly
