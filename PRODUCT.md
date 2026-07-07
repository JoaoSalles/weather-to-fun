# Product

## Register

product

## Users

Trip planners deciding where and when to go in the next seven days. They arrive with a
place in mind (or a shortlist) and one question: is this a good week for skiing, surfing,
outdoor sightseeing, or indoor sightseeing here? They are skimming and comparing, not
studying. The moment is a quick decision, often on the way to booking something, so the
verdict has to land in seconds and hold up to a second glance.

## Product Purpose

A web app that ranks how desirable a city will be to visit over the next seven days for
four activities (skiing, surfing, outdoor sightseeing, indoor sightseeing), derived from
Open-Meteo weather data. It turns raw forecast numbers into a clear per-day, per-activity
verdict so a planner can pick a destination and a window without reading a forecast table.
Success looks like: type a city, and within one screen know which activities are worth it,
which days are best, and why.

## Brand Personality

Calm, confident, legible. The voice of a trusted local who knows the conditions and tells
you plainly. Three words: composed, atmospheric, honest. Emotionally it should feel like
reassurance, the relief of a clear answer, not the buzz of a deal site. It borrows Apple
Weather's DNA (surfaces that reflect real conditions, big readable numbers, a sense of sky
and place) but keeps it disciplined: atmosphere serves legibility, never the reverse.

## Anti-references

- **Generic Bootstrap / SaaS template**: rounded blue buttons, identical card grids,
  hero-metric blocks, the default "AI made that" look.
- **Skeuomorphic weather**: literal 3D clouds, glossy sun icons, cartoon skies. Kitsch
  over clarity.
- **Neon crypto / gamer dark**: high-chroma neon on pure black, glowing gradients,
  overstimulation.

## Design Principles

- **Verdict first.** The ranking answer is the loudest thing on screen. Supporting numbers
  (temperature, wind, precipitation) are available but subordinate; a planner reads the
  conclusion before the evidence.
- **Atmosphere earns its place.** Condition-reflective surfaces evoke the week's weather
  and the activity, but every atmospheric choice must also improve reading. If it only
  decorates, it goes.
- **Trust through restraint.** Tinted neutrals and one confident accent. The interface
  should feel like a reliable instrument, quiet enough that the data is believed.
- **Built for comparison.** Seven days and four activities scan cleanly side by side.
  Rhythm and alignment do the work so the eye can move across time and options without
  friction.
- **Honest about why.** A score shows its reasoning on request. Never imply more certainty
  than a seven-day forecast supports.

## Accessibility & Inclusion

Target WCAG 2.2 AA: AA contrast on text and meaningful UI, full keyboard navigation, a
visible focus style, and honored `prefers-reduced-motion`. Because rankings are encoded
with color, color is never the sole signal: pair it with a number, label, or icon so the
verdict survives color blindness and grayscale.
