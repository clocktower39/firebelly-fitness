---
name: Firebelly Fitness
description: A themeable, dark-first personal-training platform — emerald discipline, flame energy, on a calm slate stage.
colors:
  primary: "#10b981"
  primary-deep: "#047857"
  primary-bright: "#34d399"
  secondary: "#f59e0b"
  flame-orange: "#F6861F"
  flame-red: "#DF362C"
  surface-base: "#0f172a"
  surface-raised: "#1e293b"
  surface-card: "#334155"
  abyss: "#020617"
  ink: "#f8fafc"
  ink-muted: "#94a3b8"
  # Alternate built-in theme palettes — see "Theme Variants" in section 2.
  # The default/brand theme (moor) is the emerald + slate set above.
  forest-primary: "#2e7d32"
  forest-secondary: "#ff9800"
  forest-base: "#3a3a3a"
  forest-raised: "#232323"
  forest-card: "#282828"
  ember-primary: "#ef4444"
  ember-secondary: "#f87171"
  ember-base: "#000000"
  ember-raised: "#121212"
  ember-card: "#1f1f1f"
  light-base: "#f8fafc"
  light-raised: "#ffffff"
  light-accent-bg: "#f1f5f9"
  light-ink: "#0f172a"
  light-ink-muted: "#475569"
typography:
  display:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 2.5vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Roboto, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Roboto, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "Source Code Pro, source-code-pro, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 22px"
  card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  chip:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
---

# Design System: Firebelly Fitness

## 1. Overview

**Creative North Star: "The Coach's Fire"**

Firebelly is a dark-first training platform where a calm slate stage lets the work — the workout, the schedule, the numbers — burn forward. Emerald is the steady discipline that carries almost every primary action; flame-orange and amber are the spark of effort, used sparingly so they always read as energy, never as noise. The system feels professional and trustworthy enough to run a real training business (billing, client data, programs) while staying warm and inviting — a coach's gym, not a corporate console.

Depth is built from **tonal layering, not drop shadows**: surfaces stack from near-black (`#020617`) through slate-900, slate-800, and slate-700, so elevation reads as a quiet change in tone rather than a floating card. Components are **confident and tactile** — generously rounded (12–20px), solid emerald buttons with a faint same-hue sheen, inputs that warm to emerald on focus. The whole thing is **themeable by design**: emerald-on-slate is the brand default, but the app ships forest-green, ember-red, and light alternates, plus user-defined custom palettes, and every component must survive all of them at AA contrast.

This system explicitly rejects **corporate/enterprise sterility**, the **generic SaaS dashboard template** (interchangeable card grids, the hero-metric block, the eyebrow-above-every-section), **loud gamified consumer-fitness** chrome (neon, badge spam), and **clinical/medical** coldness.

**Key Characteristics:**
- Dark-first, with emerald as the working color and flame as the rare spark
- Tonal-layered depth; near-flat at rest, shadow only on interaction
- Confident, tactile, well-rounded components (12–20px radii)
- Themeable to its core — brand identity must hold across every theme and custom palette
- Built for live, mid-set, phone-in-hand use on the workout/schedule surfaces

## 2. Colors

A dark slate foundation carrying a single working green and a tightly-rationed flame accent — the literal palette of the Firebelly mark (emerald, fire, near-black).

### Primary
- **Emerald** (`#10b981`): The working color. Primary buttons, active states, focus rings, links, selected nav, chart series, the scrollbar thumb. This is the color the eye should associate with "the main action here."
- **Deep Emerald** (`#047857`): The pressed/hover anchor for emerald surfaces and the deeper end of the brand gradient. Also the mark's shadow green.
- **Bright Emerald** (`#34d399`): The light end of the primary button's subtle vertical sheen (`#10b981 → #34d399`). Never used as a flat fill on its own.

### Secondary
- **Amber Flame** (`#f59e0b`): The brand's energy accent — secondary buttons, highlights, "in progress" and attention states. The temperate, everyday face of the fire.
- **Flame Orange** (`#F6861F`): The hotter accent straight from the logo. Reserve for genuine emphasis (streaks, PRs, celebratory or energetic moments). Not a general-purpose button color.
- **Flame Red** (`#DF362C`): The hottest brand accent and the source of the `ember` theme. In the default emerald theme, treat as a special-occasion accent; do **not** conflate with the destructive/error red, which stays a desaturated MUI red.

### Neutral
- **Surface Base** (`#0f172a`, Slate 900): The default app background — the calm stage everything sits on.
- **Surface Raised** (`#1e293b`, Slate 800): Cards, dialogs, paper, nav drawer. One tonal step up from base.
- **Surface Card** (`#334155`, Slate 700): Inner panels, dashboard cards, hovered rows — the topmost everyday tonal layer.
- **Abyss** (`#020617`, Slate 950): The darkest tone — nav-drawer gradient origin, deep wells, the mark's black.
- **Ink** (`#f8fafc`, Slate 50): Primary text. ~15:1 on Surface Base.
- **Muted Ink** (`#94a3b8`, Slate 400): Secondary text, captions, placeholders. Verify ≥4.5:1 per surface — on `#0f172a` it passes; on the lighter `#334155` it does **not**, so step up to `#cbd5e1` for secondary text on raised cards.
- **Divider** (`rgba(148, 163, 184, 0.12)`): Hairline separators and card borders; a translucent slate that reads on any theme surface.

### Named Rules
**The Rationed Flame Rule.** Emerald does the work; flame (amber/orange/red) is the spark. Across any single screen, the warm flame accents occupy ≤10% of the colored surface. Their scarcity is what makes them mean "energy." A screen that's half-orange has lost the plot.

**The Theme-Resilience Rule.** No component hard-codes a brand hex for meaning. Use the theme's semantic role (`primary`, `secondary`, `text.secondary`, `background.paper`). A component is only done when it stays legible and AA-contrast in dark, moor, ember, light, **and** an arbitrary user custom palette.

### Theme Variants

The palette above is the **moor** theme — the emerald-on-slate brand default. Firebelly ships four built-in themes plus user custom palettes (defined in `firebelly-client/src/theme.jsx`). All share the Montserrat/Roboto type, the 12–20px radii, and the tonal-first elevation; only the palette changes. Every variant must clear WCAG AA per the Theme-Resilience Rule.

- **Moor** *(default, brand)* — Emerald `#10b981` + Amber `#f59e0b` on slate (`#0f172a` → `#1e293b` → `#334155`). The canonical palette documented above; the brand-aligned face of "The Coach's Fire."
- **Dark (Forest)** — Forest green `#2e7d32` + Orange `#ff9800` on warm graphite (`#3a3a3a` base, `#232323` drawer, `#282828` cards). The original, earthier dark theme.
- **Ember** — Red `#ef4444` (deep `#b91c1c`) + soft red `#f87171` on true black (`#000000` base, `#121212` paper, `#1f1f1f` cards). The hottest, highest-drama theme — pure flame on black.
- **Light** — Emerald `#10b981` + Amber `#f59e0b` on near-white (`#f8fafc` base, `#ffffff` paper, `#f1f5f9` accent surfaces); ink `#0f172a`, muted ink `#475569`. The daytime face of the brand palette.
- **Custom** — User-defined palettes built from primary, secondary, background, paper, and text colors via `buildCustomTheme`. The user owns contrast here; the app should still default to AA-safe seed values.

**The Moor-Is-Canonical Rule.** When a new component or screen is designed, design it against **moor** first — it's the brand default and the reference these docs describe. The other themes are recolorings of the same structure, never different layouts.

## 3. Typography

**Display Font:** Montserrat (with system-ui, sans-serif)
**Body Font:** Roboto (with Inter, system-ui, sans-serif)
**Label/Mono Font:** Source Code Pro (monospace, for codes/IDs/numeric tabular data only)

**Character:** Montserrat's geometric, slightly architectural caps give headings a confident, athletic structure; Roboto's neutral, highly legible neo-grotesque carries the dense functional text (tables, forms, logs) without fatigue. The pairing works because the two fonts are separated by *role and weight*, not asked to sit side by side at the same size.

### Hierarchy
- **Display** (Montserrat, 700, `clamp(1.75rem, 4vw, 3rem)`, line-height 1.15): Page titles and the few hero moments. Capped well below a shouting scale — this is an app, not a billboard.
- **Headline** (Montserrat, 600, `clamp(1.375rem, 2.5vw, 1.875rem)`, line-height 1.2): Section headers, dialog titles, card-group headings.
- **Title** (Montserrat, 600, `1.1rem`, line-height 1.3): Card titles, list-group labels, the `subtitle1` role.
- **Body** (Roboto, 400, `1rem`, line-height 1.6): All running text, table cells, form values. Cap prose measure at 65–75ch.
- **Label** (Roboto, 600, `0.875rem`): Buttons (`text-transform: none` — buttons don't shout), field labels, chips, captions.

### Named Rules
**The Role-Separation Rule.** Montserrat is for structure (headings, titles); Roboto is for substance (everything you read or fill in). Never set body copy in Montserrat or run a data table in it. Keep the two fonts apart by role so the near-identical-sans trap never triggers.

**The Quiet Button Rule.** Button text is sentence case, weight 600, never ALL CAPS. Confidence comes from color and shape, not from shouting.

## 4. Elevation

Firebelly is **near-flat by tonal layering**. Depth is communicated by stacking slate tones (`#020617` → `#0f172a` → `#1e293b` → `#334155`), not by floating shadows. At rest, cards and panels distinguish themselves with a one-step tonal lift and an optional hairline border (`rgba(148,163,184,0.12)`), not a drop shadow. Shadows are reserved as a **response to interaction** — they appear on hover/elevation/focus and recede again.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`): Barely-there separation on raised cards; most of the work is still tonal.
- **Hover lift** (`box-shadow: 0 4px 12px rgba(0,0,0,0.2)`): The interactive feedback shadow on buttons and actionable cards. This is where shadow earns its place.
- **Focus ring**: A 2px emerald (`#10b981`) border/outline, never a glow alone — must be visible and not color-only.

### Named Rules
**The Tonal-First Rule.** If you reach for a shadow to separate two surfaces, try a tonal step first (raise from slate-800 to slate-700, or add the hairline divider). Shadows are for *motion and state*, not for static stacking. If a panel needs a heavy shadow to read at rest, the tonal hierarchy is wrong.

## 5. Components

### Buttons
- **Shape:** Generously rounded (12px / `{rounded.md}`).
- **Primary:** Solid emerald with a subtle same-hue vertical sheen (`linear-gradient(45deg, #10b981 30%, #34d399 90%)`), white text, weight 600, sentence case, no resting shadow. Padding `8px 22px`.
- **Hover / Focus:** Lifts with the hover-lift shadow; emerald deepens toward `#047857`. Focus shows the 2px emerald ring.
- **Secondary:** Amber-flame (`#f59e0b`) fill, same shape and weight — for the second-most-important action only.
- **Ghost / Text:** Transparent, emerald label, used for tertiary/cancel actions.

### Chips
- **Style:** Rounded 8px (`{rounded.sm}`), weight 500, slate-card background (`#334155`) with ink text. Tonal, not loud.
- **State:** Selected/filter chips fill with emerald; status chips pair color with a label or icon (never color alone) so status survives color blindness and theme swaps.

### Cards / Containers
- **Corner Style:** 16px (`{rounded.lg}`).
- **Background:** Surface Raised (`#1e293b`); inner panels step to Surface Card (`#334155`).
- **Shadow Strategy:** Near-flat at rest (see Elevation). Hairline border `1px rgba(148,163,184,0.12)` does the separating.
- **Border:** Optional hairline only. **Never** a thick colored side-stripe.
- **Internal Padding:** `{spacing.lg}` (24px), tightening to `{spacing.md}` (16px) on dense/mobile cards.

### Inputs / Fields
- **Style:** Outlined, 12px radius, faint translucent fill (`rgba(255,255,255,0.02)` on dark), slate border.
- **Focus:** Border shifts to emerald (`#10b981`); no heavy glow. Placeholder text holds ≥4.5:1.
- **Error / Disabled:** Error uses a desaturated red distinct from brand flame-red, paired with a message; disabled drops to muted ink with reduced fill.

### Navigation
- **Style:** Dark nav drawer with a slate gradient origin (`#020617 → #0f172a → #1e293b`), Montserrat-titled sections, Roboto items. Active item carries emerald (fill or left indicator + label weight, not color alone). On mobile the drawer collapses; the workout/schedule surfaces keep large, thumb-friendly targets.

### Signature: The Live Workout Surface
The in-workout screen is the product's sacred space — used live, mid-set, one-handed, on a phone. Prioritize large touch targets, high-contrast set/rep numbers (tabular, Source Code Pro for figures), minimal chrome, and instant feedback on logging. Decoration yields to clarity and speed here.

## 6. Do's and Don'ts

### Do:
- **Do** drive every primary action with **Emerald `#10b981`**, and keep flame (amber/orange/red) to ≤10% of any screen — the Rationed Flame Rule.
- **Do** build depth from **tonal slate steps** (`#020617`/`#0f172a`/`#1e293b`/`#334155`) and reserve shadows for hover/focus.
- **Do** reference **semantic theme roles** (`primary`, `background.paper`, `text.secondary`), never hard-coded brand hexes, so components survive dark, moor, ember, light, and custom themes.
- **Do** verify **AA contrast (≥4.5:1 body)** on every theme — step muted ink up to `#cbd5e1` on the lighter `#334155` surface.
- **Do** keep headings in **Montserrat**, body and data in **Roboto**, and pair status color with a label or icon.
- **Do** keep buttons **sentence case, weight 600**; let color and shape carry confidence.
- **Do** give the **live workout/schedule surfaces** large touch targets and high-contrast numerics.

### Don't:
- **Don't** make it feel **corporate or enterprise-sterile** — warmth is the brand.
- **Don't** ship the **generic SaaS dashboard template**: no interchangeable icon+heading+text card grids, no big-number hero-metric block, no tiny tracked uppercase eyebrow above every section.
- **Don't** go **loud, gamified consumer-fitness** — no neon gradients, badge spam, or shouting motivation.
- **Don't** drift **clinical/medical** — this is a coaching product, not a chart.
- **Don't** use a **colored side-stripe border** (`border-left`/`border-right` > 1px) on cards, alerts, or list items — full hairline borders or tonal fills instead.
- **Don't** use **gradient text** (`background-clip: text`) anywhere; the emerald button's *fill* sheen is the only sanctioned gradient.
- **Don't** add **decorative glassmorphism**; blur is rare and purposeful or absent.
- **Don't** convey status (booked, paid, approved) by **color alone**.
- **Don't** rely on shadows to separate **static** surfaces — if it needs a heavy shadow at rest, the tonal hierarchy is wrong.
