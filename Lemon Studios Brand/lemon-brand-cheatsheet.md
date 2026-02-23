# LEMON STUDIOS® — BRAND QUICK REFERENCE
### Direction D: Editorial Punk | v1.0 | February 2026

---

## COLORS

| Name | Hex | RGB | Role |
|------|-----|-----|------|
| Electric Cyan | `#00E5C8` | 0, 229, 200 | Primary accent — CTAs, links, emphasis |
| Signal Yellow | `#FFFF00` | 255, 255, 0 | Highlight — emphasis, titles |
| Coral Punch | `#FF6B6B` | 255, 107, 107 | Alert — contrast, energy |
| Crosshatch Dark | `#2A2A2A` | 42, 42, 42 | Primary background |
| Deep Black | `#0F0F0F` | 15, 15, 15 | Secondary background |
| Pure White | `#FFFFFF` | 255, 255, 255 | Text on dark, logos |
| Light Panel | `#F5F5F5` | 245, 245, 245 | Light mode background |

**Usage Ratio:** 50% Dark Ground / 20% White / 15% Cyan / 10% Yellow / 5% Coral

### Light Mode Adjustments
- Cyan → `#00B89E` (darkened 15%)
- Yellow → `#E8D500` (deepened for contrast)
- Coral → `#E84545` (saturated deeper)
- Background → `#F5F5F5` (not pure white)
- Body text → `#4A4A4A`

---

## TYPOGRAPHY

### Font Stack
```
Display:  Barlow Condensed (900, 800, 800i, 700)
Body:     Archivo (300–900)
Mono:     Space Mono (400, 700)
```

### Google Fonts Import
```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700;1,800;1,900&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Archivo:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
```

### Scale
| Level | Family | Weight | Size | Use |
|-------|--------|--------|------|-----|
| Hero/H1 | Barlow Condensed | 900 | clamp(3.5rem, 7vw, 6rem) | Page titles, hero |
| H2 | Barlow Condensed | 800 | 2.25rem | Section titles |
| H3 | Barlow Condensed | 700 | 1.4rem | Card titles |
| Body | Archivo | 400 | 1rem / 1.7 leading | Paragraphs |
| Label | Space Mono | 400 | 0.7rem / 0.15em tracking | Metadata, nav |

---

## LOGO

### Approved Variants
1. **White on Crosshatch** (#2A2A2A) — Primary, all digital
2. **Black on Cyan** (#00E5C8) — Digital accent
3. **Black on Yellow** (#FFFF00) — Highlight applications
4. **Cyan on Black** (#0F0F0F) — Secondary digital
5. **Black on Light** (#F5F5F5) — Print, email, documents

### Rules
- Clear space: 1x logo height on all sides
- Minimum: 50px height (digital) / 15mm (print)
- Always use transparent PNG files from the logos/ folder

---

## GRAPHIC DEVICES

1. **Highlighter Blocks** — Bold color behind key phrases. ONE color per headline max.
2. **Giant Watermark Type** — Oversized, near-transparent section titles bleeding off edges.
3. **Split-Screen Layout** — Hard vertical divide: bold statement left, detail right.
4. **Crosshatch Texture** — Fine grid on dark backgrounds. Never flat black.

---

## VOICE TRAITS

| Trait | Means | Example |
|-------|-------|---------|
| Provocative | Challenge conventions with wit, not aggression | "We'll tell you how many screens your story reached and what it earned." |
| Direct | Short sentences, active voice, no jargon | "20 films. Five years. Three genres. That's the fund." |
| Grounded | Every claim backed by a number or name | "Después de Lucía won Cannes and was seen by over a million people." |

---

## KEY RULES

| ✓ DO | ✗ DON'T |
|------|---------|
| Use crosshatch texture on dark backgrounds | Use more than one highlight color per headline |
| Let watermark type bleed off edges | Put highlight blocks on body text |
| Use B&W photography with color overlays | Use all three accents at equal weight |
| Use Space Mono for all metadata/labels | Use Barlow Condensed below weight 700 for headlines |

---

## FILES IN THIS PACKAGE

```
lemon-brand-package/
├── Lemon-Studios-Brand-Guide-Editorial-Punk.pdf   ← Full brand guide
├── lemon-brand-identity-editorial.html             ← Interactive artifact
├── lemon-brand-tokens.css                          ← CSS variables for devs
├── lemon-brand-tokens.json                         ← Design tokens (JSON)
├── lemon-brand-cheatsheet.md                       ← This file
└── logos/
    ├── lemon-logo-white-{size}.png                 ← Primary (on dark)
    ├── lemon-logo-black-{size}.png                 ← Print/light mode
    ├── lemon-logo-cyan-{size}.png                  ← Accent variant
    ├── lemon-logo-yellow-{size}.png                ← Highlight variant
    └── lemon-logo-coral-{size}.png                 ← Energy variant
    (Each in: 100x100, 200x200, 400x400, 800x800, fullres)
```
