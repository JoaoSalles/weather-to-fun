---
name: Weather to Fun
description: A calm weather instrument that ranks a city's next seven days for four activities.
colors:
  ink: "oklch(24% 0.03 255)"
  ink-muted: "oklch(48% 0.02 255)"
  ink-subtle: "oklch(62% 0.015 255)"
  surface: "oklch(98.5% 0.004 255)"
  surface-sunken: "oklch(96.5% 0.006 255)"
  surface-raised: "oklch(99.5% 0.002 255)"
  border: "oklch(90% 0.008 255)"
  border-strong: "oklch(82% 0.012 255)"
  accent: "oklch(58% 0.11 196)"
  accent-deep: "oklch(50% 0.11 196)"
  accent-weak: "oklch(94% 0.04 196)"
  fav-excellent: "oklch(86% 0.105 196)"
  fav-good: "oklch(90% 0.08 196)"
  fav-fair: "oklch(93.5% 0.05 196)"
  fav-poor: "oklch(96.5% 0.022 196)"
  fav-none: "oklch(95% 0.004 255)"
  danger: "oklch(55% 0.15 25)"
  danger-weak: "oklch(95% 0.03 25)"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.04em"
  data:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  page: "24px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.surface}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input-search:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  matrix-cell:
    backgroundColor: "{colors.fav-good}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  matrix-cell-hover:
    backgroundColor: "{colors.fav-excellent}"
    textColor: "{colors.ink}"
---

# Design System: Weather to Fun

## 1. Overview

**Creative North Star: "The Weather Instrument"**

This interface is a calm gauge, not a weather portal. A trip planner reads it the way you
read a good instrument: the needle points somewhere and you believe it. Every surface is
quiet so the one thing that matters, the verdict for an activity on a day, can be loud
without shouting. The system is built on tinted near-whites and a deep navy ink, with a
single teal doing double duty as both the interactive accent and the language of the
verdict. Color is scarce on purpose; when teal appears, it means something.

The register is product. Familiarity is a feature here: standard search, a legible matrix,
predictable controls. Density serves comparison (seven days by four activities read side by
side) but never tips into the ad-stuffed noise of a consumer weather site. Atmosphere earns
its place only where it aids reading: a soft, forecast-derived tint on the result header and
small condition glyphs, nothing more.

This system explicitly rejects the generic Bootstrap/SaaS template (rounded blue buttons,
identical card grids, hero-metric blocks), skeuomorphic weather kitsch (3D clouds, glossy
sun icons, cartoon skies), and neon crypto/gamer darkness (high-chroma glow on black). It
is composed, atmospheric, and honest.

**Key Characteristics:**
- Light theme, navy-tinted near-whites, never pure white or black.
- One teal accent carries both interaction and verdict; it stays under ~10% of any screen.
- Verdict is never color alone: always paired with a word and a score.
- Flat at rest; shadow appears only in response to state.
- Inter throughout, tabular figures for scores.

## 2. Colors

A navy-tinted neutral field with a single teal accent that also encodes the activity verdict.

### Primary
- **Instrument Teal** (`oklch(58% 0.11 196)`): the one accent. Primary buttons, links, focus
  ring, current selection. Rare by rule; its scarcity is what makes it read as meaningful.
- **Instrument Teal Deep** (`oklch(50% 0.11 196)`): hover and active states of anything teal.
- **Teal Wash** (`oklch(94% 0.04 196)`): the faint selected/hover fill behind interactive
  rows and chips.

### Neutral
- **Navy Ink** (`oklch(24% 0.03 255)`): primary text, headings, the brand mark. This is the
  darkest value in the system and stands in for black.
- **Muted Ink** (`oklch(48% 0.02 255)`): secondary text, supporting numbers, reasoning copy.
- **Subtle Ink** (`oklch(62% 0.015 255)`): day labels, captions, the quietest metadata.
- **Page Surface** (`oklch(98.5% 0.004 255)`): the default page ground.
- **Sunken Surface** (`oklch(96.5% 0.006 255)`): the matrix ground and muted panels, one step
  back from the page.
- **Raised Surface** (`oklch(99.5% 0.002 255)`): row headers, the header bar, the expanded
  reasoning panel, one step toward the viewer.
- **Hairline Border** (`oklch(90% 0.008 255)`): dividers and cell gridlines.
- **Strong Border** (`oklch(82% 0.012 255)`): input strokes and stronger separation.

### Verdict Scale (single-hue favorability, teal 196)
Deeper teal reads better, paler reads worse. All steps stay light so Navy Ink text and the
score remain legible on top. Intensity is carried by chroma, not darkness.
- **Excellent** (`oklch(86% 0.105 196)`): the strongest favorable tint.
- **Good** (`oklch(90% 0.08 196)`).
- **Fair** (`oklch(93.5% 0.05 196)`).
- **Poor** (`oklch(96.5% 0.022 196)`): nearly neutral, barely tinted.
- **Not Viable** (`oklch(95% 0.004 255)`): neutral gray, no favorability. Used when an
  activity cannot happen at all this week (skiing in a tropical city), distinct from a low
  score.

### Semantic
- **Danger** (`oklch(55% 0.15 25)`): error text and icons (city not found, forecast failure).
- **Danger Wash** (`oklch(95% 0.03 25)`): error banner background.

### Named Rules
**The Scarce Teal Rule.** Teal covers at most ~10% of any screen. It is reserved for
interaction and verdict. It is never a decorative fill, never a header background, never a
divider. If teal is everywhere, nothing reads as the answer.

**The Never-Pure Rule.** No `#000`, no `#fff`. Every neutral is tinted toward navy (hue 255,
chroma 0.004 to 0.03). Pure values look like a template; the tint is the instrument's finish.

**The Two-Signal Rule.** A verdict tint never travels alone. It always ships with a word
(Excellent / Good / Fair / Poor / Not viable) and a numeric score, so the verdict survives
grayscale and color blindness.

## 3. Typography

**Display Font:** Inter (with `system-ui, -apple-system, Segoe UI, sans-serif`)
**Body Font:** Inter (same stack)
**Label/Data Font:** Inter, tabular figures for numerics

**Character:** One family, tuned across weight and size rather than mixed with a display
face. Inter is the right kind of neutral for an instrument: it disappears into the reading
and holds up at small sizes in a dense matrix. Numerics use tabular figures so scores align
in a column.

### Hierarchy
- **Display** (700, 2rem/32px, line-height 1.15, tracking -0.02em): the verdict headline,
  the single loudest line on the results screen. One per screen.
- **Headline** (600, 1.5rem/24px, line-height 1.2): the city name and section headers.
- **Title** (600, 1.125rem/18px, line-height 1.3): activity row headers in the matrix.
- **Body** (400, 1rem/16px, line-height 1.55): reasoning copy and prose, capped at 65 to
  75ch.
- **Label** (500, 0.8125rem/13px, tracking 0.04em, uppercase): day headers, tags, button
  text, the quiet structural furniture.
- **Data** (600, 1rem, tabular figures): scores and any aligned numeric readout.

### Named Rules
**The Tabular Score Rule.** Every score and aligned number uses tabular figures (`'tnum'`).
In a seven-column matrix, proportional digits jitter the grid; tabular digits hold the line.

**The One Voice Rule.** No display or script face. The hierarchy is scale and weight, not a
second typeface. A serif or a display font in this UI is a wrong note.

## 4. Elevation

Flat by default with tonal layering. Depth is normally conveyed by the three-step neutral
ramp (Sunken, Page, Raised), not by shadow. The matrix ground sits on Sunken; row headers
and the header bar lift to Raised; cells rest flat. Shadow is a response to state, never a
resting decoration.

### Shadow Vocabulary
- **Hover Lift** (`box-shadow: 0 1px 2px oklch(30% 0.04 255 / 0.06), 0 4px 12px oklch(30% 0.04 255 / 0.08)`):
  appears when a matrix cell or button is hovered or focused.
- **Panel Float** (`box-shadow: 0 8px 24px oklch(30% 0.04 255 / 0.12)`): the expanded
  reasoning panel and any popover. The only structural shadow in the system.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If a shadow is visible without the
user hovering, focusing, or expanding something, it is wrong. Depth at rest comes from the
tonal ramp, not from a drop shadow.

**The Navy-Shadow Rule.** Shadows are tinted navy (`oklch(30% 0.04 255)`), never neutral
black. A pure-black shadow on a tinted-white ground reads muddy and cheap.

## 5. Components

### Buttons
- **Shape:** gently squared (8px radius, `{rounded.md}`).
- **Primary:** Instrument Teal background, Page Surface text, Label typography, 10px 18px
  padding. Used for the search submit and the single primary action on a screen.
- **Hover / Focus:** background shifts to Instrument Teal Deep over 180ms ease-out; focus adds
  a 2px Instrument Teal ring offset 2px. No transform on primary.
- **Ghost:** Page Surface background, Navy Ink text, Hairline Border. For secondary actions
  (example-city chips, retry). Hover fills with Teal Wash.

### Chips
- **Style:** Sunken or Raised Surface fill, Subtle Ink text, Label typography, 4px radius
  (`{rounded.sm}`), Hairline Border. Day labels and category tags.
- **State:** a selected chip fills Teal Wash with Instrument Teal Deep text. Unselected is
  neutral. Never a saturated fill on an inactive chip.

### Cards / Containers
- **Corner Style:** 12px radius (`{rounded.lg}`) for panels, 8px for smaller containers.
- **Background:** Raised Surface for lifted panels, Sunken for grounds. Avoid stacking cards;
  nested cards are forbidden.
- **Shadow Strategy:** none at rest (see Elevation). Panel Float only when a panel is a
  transient overlay.
- **Border:** Hairline Border where a container needs definition without a shadow.
- **Internal Padding:** `{spacing.md}` to `{spacing.lg}` depending on density.

### Inputs / Fields
- **Style:** Raised Surface background, Strong Border stroke, 8px radius, Body typography,
  12px 14px padding. The city search is the primary instance and reads roomy on the empty
  state, compact in the results header.
- **Focus:** border shifts to Instrument Teal and a 2px Instrument Teal ring appears, 180ms
  ease-out. No glow.
- **Error / Disabled:** error border uses Danger; disabled drops to Muted Ink text on Sunken
  Surface, no border shift.

### Navigation
- **Style:** a slim top bar on Raised Surface with a Hairline Border underline. Brand mark and
  links in Navy Ink, Label typography.
- **States:** default Navy Ink; hover shifts to Instrument Teal Deep; the active link carries
  Instrument Teal text with a 2px Instrument Teal underline. Focus shows the teal ring.
- **Mobile:** links collapse into a single menu control; the bar stays slim.

### Verdict Cell (signature component)
The heart of the matrix. One cell = one activity on one day.
- **Structure:** a favorability tint background (Verdict Scale), Navy Ink verdict word (Label
  typography), a tabular score (Data typography), and a small condition glyph. Reading order
  is word, then score, then glyph.
- **Not Viable:** uses the neutral Not Viable gray, the word "Not viable," and no score, so it
  never masquerades as a low reading.
- **Hover / Focus:** Hover Lift shadow plus pointer; focus adds the teal ring. Activating the
  cell expands an inline reasoning panel below it (temperature, wind, precipitation, and the
  rule that set the score), Panel Float shadow, 180ms ease-out. Never a modal.

### Loading
- **Style:** skeleton placeholders shaped like the matrix (row headers plus cells) on Sunken
  Surface, a slow opacity pulse. No center spinner.

## 6. Do's and Don'ts

### Do:
- **Do** keep teal scarce: interaction and verdict only, at most ~10% of a screen (The Scarce
  Teal Rule).
- **Do** pair every verdict tint with a word and a score (The Two-Signal Rule), so it survives
  grayscale and color blindness.
- **Do** tint every neutral toward navy (hue 255, chroma 0.004 to 0.03) and use Navy Ink where
  you would reach for black.
- **Do** convey resting depth with the three-step tonal ramp (Sunken, Page, Raised); reserve
  shadow for hover, focus, and transient overlays.
- **Do** use tabular figures for every score and aligned number.
- **Do** label an impossible activity "Not viable this week" in neutral gray, distinct from a
  low score. Be honest about why.

### Don't:
- **Don't** ship the generic Bootstrap/SaaS template: rounded blue buttons, identical card
  grids, or hero-metric blocks (big number, small label, supporting stats, gradient accent).
- **Don't** go skeuomorphic: no 3D clouds, glossy sun icons, or cartoon skies. Condition sense
  comes from small glyphs and a soft header tint, nothing literal.
- **Don't** use neon crypto/gamer darkness: no high-chroma glow, no gradients on black, no dark
  theme here at all.
- **Don't** use `#000` or `#fff` anywhere (The Never-Pure Rule).
- **Don't** paint the verdict with a rainbow of hues; favorability is one teal, varied by
  chroma.
- **Don't** stack cards or nest a card inside a card.
- **Don't** use a `border-left` or `border-right` greater than 1px as a colored accent stripe.
- **Don't** introduce a second typeface; scale and weight carry the hierarchy (The One Voice
  Rule).
- **Don't** open a modal for the verdict reasoning; expand it inline.
