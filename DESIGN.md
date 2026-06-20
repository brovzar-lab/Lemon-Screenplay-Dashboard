# Instrument Design System

The house design language for Lemon apps. Light by default, Midnight navy dark twin, one cobalt accent, tactile depth on controls only, Playfair on titles and Schibsted on everything else.

---

## Instructions for the AI agent

You have been asked to apply this design system to an app. This file is the complete brief. Do not ask the user to restate any of it. Execute the following procedure end to end.

Scope: change styling only. Do not touch data, logic, state, API calls, routing, or features. If you cannot tell whether something is styling, leave it and list it for the user at the end.

Procedure:
1. Add the Google Fonts import (Typography section) to the global stylesheet.
2. Add the `:root` and `.dark` color variables, plus the radius, spacing, and depth tokens (Color and Shape sections) to the global stylesheet.
3. If the project uses Tailwind, merge the Tailwind config (Tailwind section) into the existing config. If not, apply the tokens as plain CSS variables and utility classes.
4. Replace every existing color in the app with the matching token. Search the codebase for hardcoded hex values and swap each one. Any warm, brown, cream, terracotta, or amber/gold color is wrong and must be replaced. That warm look is the exact thing this system exists to remove.
5. Apply every rule in the Principles, Component rules, and Do-not sections exactly.
6. Add dark mode via a `.dark` class on the html element. Default to the system setting using `prefers-color-scheme`, and add a small light/dark toggle in the app header. Dark is Midnight navy, never pure black.
7. When done, run the dev server, give the user a short summary of what changed, and list anything you were unsure about. Do not commit until the user has reviewed it in the browser.

If any value, font, or shadow is ever left unspecified anywhere in the app, this file is the default. Never invent a warm, brown, cream, or amber/gold alternative.

How the user installs this file:
- Claude Code: place this file in the repo root, named `CLAUDE.md` or referenced from it. For all projects, place it at `~/.claude/CLAUDE.md`.
- Cursor: place the contents in `.cursorrules` or under `.cursor/rules`.
- Other chat LLMs: paste this file at the start of the session.

Then the user's entire prompt is one line: "Read this file and apply it to this app."

---

## Principles (the non-negotiables)

- Light is the default theme. Midnight navy is the dark twin, applied via a `.dark` class. Never pure black.
- Structure comes from filled surfaces and real elevation, never from hairline borders or thin colored stripes. A card is defined by its fill plus a visible shadow, not a 1px line. In light mode cards carry no border at all, only fill and shadow. The shadow must be genuinely visible, not a faint hint that vanishes on near-white.
- Never use a colored left-border accent (the 2px or 3px stripe down the side of a row). It reads fragile. Encode status and category with a filled leading icon tile or a solid soft-tint chip that has real mass.
- One accent does one job. Cobalt marks the primary action and active state only. Nothing else is cobalt.
- Depth lives on exactly two things: the primary button and cards. Inputs are inset. Everything else is flat. No drop shadows anywhere else.
- Playfair Display is for titles and one hero number per screen, large (24px and up) and rare. It never appears on labels, data, body, or anything small.
- Schibsted Grotesk runs everything else: body, labels, and all numbers, with tabular figures on.
- Calm shell, dense panels. The frame is quiet, the data is the loudest thing on screen.
- Saturated data colors (blue, violet, teal, coral) live in charts and status only. They never touch the chrome or an action.

---

## Color tokens (CSS variables)

```css
:root {
  /* surfaces */
  --bg:#EAECF1;
  --surface:#FFFFFF;
  --sunken:#EEF0F3;
  --line:#E6E8EC;
  /* text */
  --ink:#0B0D12;
  --ink-2:#585F6B;
  --ink-3:#9298A4;
  /* accent, the only action color */
  --accent:#2B54F0;
  --accent-press:#2042C2;
  --accent-soft:#EAEEFE;
  --on-soft:#2042C2;
  /* data, charts and status only */
  --data-blue:#2B54F0;
  --data-violet:#6E4BF0;
  --data-teal:#119C8B;
  --data-coral:#FF6B5C;
  /* semantic, full strength for icons/borders only */
  --success:#12A66B;
  --warning:#F5A524;
  --error:#FF5247;
  /* semantic soft pairs, for badges, tags, and inline alert text */
  --success-soft:#E2F4EC; --on-success:#0C7A4E;
  --warning-soft:#FBEDD6; --on-warning:#9A6406;
  --error-soft:#FCE7E7;   --on-error:#C42B2B;
}

.dark {
  --bg:#0E1426;
  --surface:#16203A;
  --sunken:#101A30;
  --line:#233152;
  --ink:#EDF1F9;
  --ink-2:#94A2BE;
  --ink-3:#73819E;
  --accent:#6E8BFF;
  --accent-press:#5E80FF;
  --accent-soft:#1B2747;
  --on-soft:#A9BEFF;
  --data-blue:#6E8BFF;
  --data-violet:#9F86FF;
  --data-teal:#2FC9B0;
  --data-coral:#FF8A78;
  --success:#34C98C;
  --warning:#FFBE57;
  --error:#FF7A72;
  --success-soft:#10301F; --on-success:#6FE0A8;
  --warning-soft:#33260F; --on-warning:#FFD37A;
  --error-soft:#3A1A1C;   --on-error:#FF9E96;
}
```

---

## Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap');

:root {
  --font-display:'Playfair Display', Georgia, serif;   /* titles, one hero number, 24px+ only */
  --font-body:'Schibsted Grotesk', system-ui, sans-serif; /* everything else */
}

/* all numbers use tabular figures */
.num { font-variant-numeric: tabular-nums; font-feature-settings:'tnum'; }
```

Scale: titles 28 to 56px (Playfair), section headers 20 to 24px (Schibsted 600), body 15 to 16px (Schibsted 400), labels 11px uppercase with 0.05em tracking (Schibsted 500), data numbers 24 to 34px (Schibsted 600, tabular). Make the jumps dramatic, not timid. Mono is retired except for literal IDs.

---

## Shape, depth, spacing

```css
:root {
  --radius-sm:8px;   /* inputs, tags */
  --radius-md:12px;  /* buttons */
  --radius-lg:16px;  /* cards */

  --space-1:4px; --space-2:8px; --space-3:12px;
  --space-4:16px; --space-6:24px; --space-8:32px;

  /* depth, light mode */
  --shadow-card:0 1px 2px rgba(16,20,30,.10), 0 2px 4px rgba(16,20,30,.06), 0 12px 30px rgba(16,20,30,.11);
  --highlight-top:inset 0 1px 0 rgba(255,255,255,.9);
  --shadow-pop:0 2px 4px rgba(16,20,30,.12), 0 4px 8px rgba(16,20,30,.08), 0 20px 44px rgba(16,20,30,.14);
  --shadow-hover:0 2px 4px rgba(16,20,30,.12), 0 6px 12px rgba(16,20,30,.10), 0 24px 50px rgba(16,20,30,.16);
  --shadow-btn:inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(11,13,18,.12), 0 6px 16px rgba(43,84,240,.26);
  --inset-input:inset 0 1px 2px rgba(11,13,18,.06);
}

.dark {
  --shadow-card:0 1px 2px rgba(0,0,0,.35), 0 8px 22px rgba(0,0,0,.40);
  --highlight-top:inset 0 1px 0 rgba(255,255,255,.05);
  --shadow-btn:inset 0 1px 0 rgba(255,255,255,.25), 0 1px 2px rgba(0,0,0,.40), 0 6px 18px rgba(110,139,255,.45);
}
```

The press feel: the primary button uses `transform: scale(0.97)` on `:active` with the shadow tightening, transition under 120ms with `cubic-bezier(0.16,1,0.3,1)`. It compresses toward the finger. No hard colored ledge under the button.

---

## Component rules

- Primary button: `--accent` fill, white text, `--shadow-btn`, `--radius-md`. Hover lightens, active scales to 0.97. One per screen.
- Ghost button: `--surface` fill, 1px `--line` border, soft lift, active scales to 0.98.
- Input: `--sunken` fill, 1px `--line` border, `--inset-input`, `--radius-sm`. Focus ring is a 2px `--accent` outline.
- Card: `--surface` fill, `--radius-lg`, `--shadow-card` plus `--highlight-top`. In light mode NO border, the fill and shadow define it. In dark mode add a 1px `--line` border, since navy-on-navy contrast is lower. Numbers in tabular Schibsted.
- Icon tile: a 40 to 44px rounded square (`--radius-md`) with a `*-soft` fill and the matching `--on-*` colored icon, plus an inset top highlight. This is the standard way to anchor a row or alert with weight. Use it instead of a colored side stripe.
- List row: a card with a leading icon tile, a title, and supporting text. The status or category lives in the icon tile color plus a soft-tint chip. Rows are solid cards with shadow, never outlined rectangles, never side-striped.
- Alert: the whole card takes the `*-soft` fill (e.g. `--error-soft`), with a leading icon tile and `--on-*` text. No stripe. The fill carries the meaning.
- Stat tile: a card. Label is 11px uppercase `--ink-3`. Number is large tabular `--ink`. A trend line may use `--success` or `--error`.
- Badge: soft tint, not solid. Fill with a `*-soft` token, text with the matching `--on-*` token. CONSIDER uses `--accent-soft` with `--on-soft`. Status carries the only color.
- Inline alert text (e.g. "billing anomaly", "overdue", "post cancel charge"): never raw saturated semantic color as small text, it fails contrast on the dark navy surface. Use the soft pairing: `--error-soft` background with `--on-error` text for warnings and alerts, or `--ink` text with a small full-strength `--error` icon or 2px left border. Full-strength `--success` / `--warning` / `--error` are for icons, dots, and borders only, never for small text.
- Category tag (e.g. "unused", "pricey", priority chips): a soft tint from the DATA set, not the semantic set, unless the tag literally means a warning. Map categories across `--data-blue`, `--data-violet`, `--data-teal`, `--data-coral` softs. Never amber or gold.
- Number font: every number is Schibsted with tabular figures and `--ink` color. The display serif (Playfair) goes on titles and at most ONE hero number per screen. Stat-card numbers, table figures, prices, and counts are never serif and never colored.
- Skeleton: `--surface` blocks, slow shimmer, matched to the final layout.
- Empty state: one muted line plus a ghost button. No illustration.

---

## Solidity rules (what makes it feel built, not drawn)

These are not optional polish. They are the difference between a robust app and a fragile one.

- Weight in the type. Titles and key labels are 600, body is 400. Push the contrast. Thin gray 400 text everywhere is the main cause of the fragile, pencil-drawn feeling. Body text is `--ink-2` at minimum, never lighter, and primary labels are `--ink`.
- Two-layer shadows. Every card uses `--shadow-card`, which has a tight dark contact layer plus a wide soft ambient layer. The contact layer is what makes the card sit on the surface instead of floating. Never replace it with a single faint shadow.
- Numbers have presence. Stat and metric numbers are large, 600 weight, tight tracking (-0.02em), tabular, `--ink` colored. Thin numbers make a dashboard feel flimsy.
- Nest the radii. A child element inside a card uses a smaller radius than the card. Icon tile (`--radius-md`) inside a card (`--radius-lg`) so the corners read as concentric and machined. Never the same radius nested in itself.
- Snap to the grid. All spacing is multiples of 4px, ideally 8px. Related elements sit close, unrelated elements get real space. Confident, consistent spacing is a structural cue. Uneven floaty air reads as fragile.
- React with weight. On hover, cards lift to `--shadow-hover` over 150ms. Buttons press with `scale(0.97)`. Interactive elements respond physically, so the UI feels solid under the hand.
- Solid rail, never a hairline. When a row needs a color-coded edge without an icon tile, use a solid full-height bar 4 to 6px wide flush to the card's left edge, in a `*-soft` or data color, with the card's left corners squared to meet it. A solid bar reads welded. A 1px or 2px line reads drawn. Never the thin line.

---

```js
// tailwind.config.js
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:'var(--bg)', surface:'var(--surface)', sunken:'var(--sunken)', line:'var(--line)',
        ink:'var(--ink)', 'ink-2':'var(--ink-2)', 'ink-3':'var(--ink-3)',
        accent:'var(--accent)', 'accent-press':'var(--accent-press)',
        'accent-soft':'var(--accent-soft)', 'on-soft':'var(--on-soft)',
        'data-blue':'var(--data-blue)', 'data-violet':'var(--data-violet)',
        'data-teal':'var(--data-teal)', 'data-coral':'var(--data-coral)',
        success:'var(--success)', warning:'var(--warning)', error:'var(--error)',
        'success-soft':'var(--success-soft)', 'on-success':'var(--on-success)',
        'warning-soft':'var(--warning-soft)', 'on-warning':'var(--on-warning)',
        'error-soft':'var(--error-soft)', 'on-error':'var(--on-error)',
      },
      fontFamily: {
        display:['Playfair Display','Georgia','serif'],
        sans:['Schibsted Grotesk','system-ui','sans-serif'],
      },
      borderRadius: { sm:'8px', md:'12px', lg:'16px' },
      boxShadow: {
        card:'var(--shadow-card)',
        pop:'var(--shadow-pop)',
        hover:'var(--shadow-hover)',
        btn:'var(--shadow-btn)',
        'inset-input':'var(--inset-input)',
      },
    },
  },
}
```

Set `font-variant-numeric: tabular-nums` globally on the body so every number aligns.

---

## Do not

- Do not use a warm, brown, cream, or amber/gold look. If a palette is unspecified, this system is the default. That warm default is the exact thing this system replaces.
- Do not let the accent appear on more than the primary action and active state per screen.
- Do not put depth on anything but the primary button and cards. No shadows on labels, chips, rows, or panels.
- Do not use Playfair below 24px, or on labels, data, or body. It is display only.
- Do not set numbers in the display serif. Playfair is for titles and at most ONE hero number per screen. Every other number is Schibsted, tabular, `--ink` colored.
- Do not render semantic colors (success, warning, error) as small text. Use the `*-soft` plus `--on-*` pairing for readable alerts and badges. Raw red text on the navy dark surface is unreadable.
- Do not use amber, gold, or the warning color as a category or status color unless it literally means a warning. Categories use the data set.
- Do not let saturated data colors touch the chrome, the nav, or an action.
- Do not ship dark mode as pure black. Dark is Midnight navy at `#0E1426`.
- Do not build UI out of hairline borders. No border-only cards, no thin dividers doing structural work, no card defined by a 1px line. Use fill plus a visible shadow.
- Do not use colored left-border stripes on rows or alerts. Replace them with a filled icon tile or a full soft-tint fill.
- Do not ship a card shadow so faint it disappears on the near-white page. Cards must read as solid, lifted objects.
- Do not animate a button press longer than 120ms, and do not animate table rows on scroll or chart redraws on filter change.
