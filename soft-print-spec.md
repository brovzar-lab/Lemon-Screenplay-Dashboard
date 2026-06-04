# Soft Print — Design System Brief

> Hand this file to a design/coding tool with: *"Redesign this app using the Soft Print
> design system below. Light is the primary theme; support dark as a warm-charcoal
> counterpart."* Pair it with `soft-print.css` (drop-in tokens + components).

---

## 1. The idea in one paragraph

Soft Print is a **calm, warm, low-contrast** system for reading-heavy products (dashboards,
coverage tools, editors). It feels like good paper: warm neutrals, hairline borders, soft
diffuse shadows, generous radii, a single humanist grotesk. **One brand hue — rose — carries
identity and actions. Three desaturated semantic hues — sage, sand, clay — carry status.
The brand hue and the status hues never overlap in role.** Light mode is primary; dark mode
is a warm charcoal, never a cold blue-slate.

## 2. Principles (apply these when in doubt)

1. **Quiet by default.** The content is the loudest thing on screen. Low contrast, hairline
   borders (`--sp-border`), soft shadows used sparingly (hover + overlays only).
2. **One brand, three signals.** `--sp-rose` = brand + the single primary action.
   `--sp-sage / --sp-sand / --sp-clay` = status only. No hue ever does two jobs. (If you find
   yourself using rose for a status, or a semantic hue for a button, stop.)
3. **Warm, not grey.** Every neutral is warmed toward paper. There is no pure black, no pure
   white, no cold grey. Dark mode warms toward charcoal (`#1A1714`), not slate.
4. **Round & roomy.** Generous radii (14–18px on cards, full pills on badges) and a strict
   4px spacing scale create an unhurried, tactile calm.
5. **Never color-only.** Status is always carried by a **label or number** in addition to hue,
   for accessibility and for colorblind users.

## 3. Color tokens

| Token | Role | Light | Dark |
|---|---|---|---|
| `--sp-bg` | App background | `#F1EBE0` | `#1A1714` |
| `--sp-surface` | Raised card / panel | `#FBF8F2` | `#232019` |
| `--sp-surface-2` | Nested surface | `#F5F0E7` | `#1F1B16` |
| `--sp-sunken` | Wells, input rest, bar tracks | `#E9E2D4` | `#15120F` |
| `--sp-border` | Hairline divider / card border | `#E4DCCD` | `#322C25` |
| `--sp-border-strong` | Emphasized border | `#D5CBB7` | `#443C32` |
| `--sp-text` | Primary text | `#2F2B25` | `#EDE7DB` |
| `--sp-text-2` | Secondary text | `#645C50` | `#B2A998` |
| `--sp-text-3` | Muted / captions / placeholder | `#8A8273` | `#7D7464` |
| `--sp-rose` | **Brand + primary action** | `#BC6A77` | `#DE939D` |
| `--sp-rose-strong` | Rose text/hover-press | `#A1505D` | `#E9AEB6` |
| `--sp-rose-tint` | Soft fill behind rose | `#F3E2E1` | `rgba(222,147,157,.15)` |
| `--sp-sage` | Success · **Recommend** | `#5E8C63` | `#95BC8A` |
| `--sp-sand` | Warning · **Consider** | `#B07F2E` | `#D9B36B` |
| `--sp-clay` | Danger · **Pass / critical** | `#B0543F` | `#DD8870` |

Each semantic hue has a matching `*-tint` for soft fills (e.g. `--sp-sage-tint`).
Text/icon on a filled rose surface = `--sp-on-rose` (`#FFFFFF` light, `#2A1A1D` dark).

## 4. Typography

- **Family:** `"Hanken Grotesk"` for all UI and body. `"Spline Sans Mono"` for numerals,
  labels, eyebrows, and code. **No display serif** — single-grotesk is intentional.
  (Both are free on Google Fonts. Substitute any soft humanist grotesk + any mono if needed.)
- **Scale (px):** 12 / 13 / 15 (base) / 17 / 20 / 26 / 33 / 42.
- **Weights:** 400 body · 500 UI labels & buttons · 600 headings & emphasis · 700 big numerals.
- **Letter-spacing:** tighten headings (−1.2% to −2.2%); body normal; mono uppercase labels +14%.
- **Line-height:** 1.55 body, 1.06–1.3 headings.

## 5. Spacing, radii, elevation

- **Spacing (4px base):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. Use only these.
- **Radii:** 6 / 10 / 14 / 18 / 24 / 999. **Default card = 18px.** Badges = full pill.
- **Shadows:** low, diffuse, warm-tinted. Three steps (`sm` / `md` / `lg`). Rest state of a
  card uses `sm` or just a border; elevate to `md` on hover, `lg` for popovers/modals.
  Never a hard, high-opacity drop shadow.

## 6. Component anatomy

- **Button** — radius 10px, padding 9×15. *Primary* = filled `--sp-rose` / `--sp-on-rose`.
  *Secondary* = `--sp-surface` + `--sp-border-strong`. *Ghost* = transparent, tints on hover.
  States: hover (darken/tint), active (translateY 1px), focus-visible (`--sp-ring`: 2px bg +
  2px rose). One primary action per view.
- **Badge / status pill** — full radius, semantic tint background + semantic text + a 6px
  leading dot. Recommend=sage, Consider=sand, Pass=clay, neutral=`--sp-surface-2`.
- **Input** — `--sp-sunken` fill, hairline border; on focus → surface fill + rose border + ring.
- **Tabs / segmented** — sunken track, active tab = surface chip with `sm` shadow.
- **Card** — surface + hairline border + `sm` shadow, 18px radius, 20px padding. Interactive
  variant lifts 2px to `md` shadow on hover.
- **Score bar** — 5px track in `--sp-sunken`, fill in the row's semantic hue, always beside
  the numeric value.
- **List row** — grid, 12×16 padding, 14px radius, hover = `--sp-surface-2`. Use for dense
  triage tables.

## 7. Do / Don't

**Do**
- Use rose for the single primary action and brand marks.
- Use sage/sand/clay only for status, always paired with a label or number.
- Default to surface-on-bg with a hairline; add shadow only on hover/overlay.
- Hold body text at ≥ 4.5:1 contrast even though the palette is gentle.
- Round generously (14–18px cards, full-pill badges).

**Don't**
- Don't tint a primary button rose *and* a status element rose in the same view.
- Don't introduce cold grey or pure black/white — warm every neutral.
- Don't use heavy shadows or high-contrast borders; they break the calm.
- Don't add a display serif.
- Don't rely on color alone to communicate verdict/status.

## 8. How to apply to an existing app

1. Drop in `soft-print.css` (or paste the `:root` + `[data-theme="dark"]` token blocks).
2. Set `data-theme="light"` on `<html>`; wire a toggle that swaps to `"dark"` and persists.
3. Replace hard-coded colors with tokens: backgrounds→`--sp-bg/--sp-surface/--sp-sunken`,
   text→`--sp-text/-2/-3`, borders→`--sp-border`.
4. Re-map any existing accent/CTA color to `--sp-rose`. Re-map success/warning/error to
   `--sp-sage/--sp-sand/--sp-clay`. **Audit for collisions** — if brand and status currently
   share a color, split them now.
5. Round corners up to the radius scale, soften shadows, and switch the type stack to
   Hanken Grotesk + Spline Sans Mono.
6. Sweep for contrast and color-only signals before shipping.
