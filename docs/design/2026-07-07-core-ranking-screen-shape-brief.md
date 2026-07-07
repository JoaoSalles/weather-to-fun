# Design Brief: Core Ranking Screen

> Impeccable `shape` output. Register: **product**. Reference cue: Collinson Group insights
> page (restrained corporate editorial). Status: **confirmed**, ready to hand to
> `/impeccable craft`. Not yet implemented.

## 1. Feature Summary

The single screen that defines the app. A trip planner enters a city and immediately learns
how good the next seven days are for skiing, surfing, outdoor sightseeing, and indoor
sightseeing there, plus which days are best and why. It converts an Open-Meteo forecast into
a plain per-day, per-activity verdict.

## 2. Primary User Action

Read the verdict. Within one screen the planner should know: which activities are worth it
here this week, the best day window for each, and enough "why" to trust it.

## 3. Design Direction

- **Color strategy: Restrained.** Navy/charcoal text on tinted-white grounds (neutrals
  tinted toward the brand navy, never pure white or black), one calm accent for actions and
  selection. This is the Collinson base and matches PRODUCT.md's "trust through restraint."
- **Verdict encoding (the one place color carries data):** a single-hue *favorability*
  scale, deeper = better, paler = worse, expressed in OKLCH with restrained chroma. Never
  the sole signal: every cell also carries a word (Excellent / Good / Fair / Poor / Not
  viable) and a compact score. Keeps it color-blind safe and avoids a rainbow matrix.
- **Atmosphere as accent, not wallpaper:** condition sense shows up in small day glyphs and
  a soft, forecast-derived tint on the result header only. Per-activity identity comes from
  label plus icon, not hue, so a day column stays comparable. Honors "atmosphere earns its
  place."
- **Theme: light.** Scene sentence: "A trip planner at a laptop in daytime, mid-planning,
  comparing two or three destinations before they book." Daytime, decision mode, scanning:
  that forces light.
- **Anchor references:** Collinson insights page (editorial-corporate restraint, generous
  whitespace, photographic calm), Apple Weather (verdict legibility, big readable numbers,
  condition-as-accent), Stripe Dashboard (status-color discipline and data legibility in a
  product surface).

## 4. Scope

Production-ready brief for one surface: the search-to-results core screen. Interactive and
shippable on the existing React Router 7 plus Tailwind v4 stack. Single screen, not the full
multi-page flow.

## 5. Layout Strategy

**Chosen structure: matrix over cards (confirmed).**

- **Empty state leads with search.** Before a query, the city search is the hero: centered,
  roomy, with a one-line promise and two or three example cities. Not a marketing hero, just
  a clear entry.
- **After search, the verdict headline is the loudest element.** One sentence at the top:
  e.g. "This week in Chamonix: best for skiing, Wednesday to Friday." Search collapses into a
  compact header input.
- **Body is an activity-by-day matrix, not a card grid.** Four activity rows; seven day
  columns. Each row header (left, sticky) holds the activity icon, name, and its best-window
  summary. Each cell is a compact verdict: favorability tint plus word plus score plus a tiny
  condition glyph. Reading across a row scans a week for one activity; reading down a column
  compares activities for one day.
- **Rhythm over uniformity:** the row-header column is wider and quieter; day cells are
  tighter and rhythmic. Avoids the banned identical-card-grid and hero-metric templates.
- **Progressive "why":** activating a cell expands its reasoning inline (temperature, wind,
  precipitation, and the rule that drove the score). No modal.

## 6. Key States

- **Empty (pre-search):** teaching state. Promise line plus example cities that run a real
  query on click.
- **Loading:** skeleton of the matrix (row/cell placeholders), not a center spinner.
- **Success:** headline verdict plus full matrix.
- **Cell expanded:** inline reasoning panel under the activated cell.
- **Error, city not found:** inline message on the search with a suggestion to try a nearby
  larger city.
- **Error, forecast API failure:** non-destructive banner with retry; keep the last good
  result if any.
- **Edge, activity not viable:** honest label (e.g. skiing in a tropical city reads "Not
  viable this week," not a misleading low number). Core to "honest about why."

## 7. Interaction Model

Type a city, submit (Enter or button), matrix renders. Hover a cell: subtle raise and
pointer. Activate a cell (click or keyboard): inline reasoning expands, 150 to 250 ms,
ease-out, respects `prefers-reduced-motion`. Full keyboard navigation across the matrix with
a visible focus ring. Changing the city re-runs the query and re-renders in place.

## 8. Content Requirements

- Verdict headline (dynamic, derived from top-scoring activity plus best window).
- Activity labels: Skiing, Surfing, Outdoor sightseeing, Indoor sightseeing (plus icons).
- Day labels: Today, then weekday plus date (Mon 8).
- Verdict words: Excellent / Good / Fair / Poor / Not viable.
- Reason microcopy, short and honest: "Fresh snow, light wind," "Heavy rain, strong gusts,"
  "Warm and dry, clear skies."
- Empty-state promise plus example cities.
- Error copy for not-found and API-failure.
- Realistic ranges: 7 days fixed, 4 activities fixed; scores continuous but bucketed into the
  five words.

## 9. Component Vocabulary

**shadcn/ui is planned for later adoption.** Build with shadcn-compatible primitives now so
the migration is mechanical, not a rewrite:

- Use the same token surface shadcn expects (CSS variables for background/foreground, muted,
  accent, border, ring), aliasable from the existing `theme.css` semantic tokens.
- Favor composable primitives (button, input, tooltip/popover for the inline "why", skeleton)
  over bespoke one-off components.
- Keep component state vocabulary standard (default, hover, focus, active, disabled, loading,
  error, expanded) so shadcn equivalents drop in cleanly.

## 10. Recommended References (for build)

spatial-design (the matrix and its responsive collapse), interaction-design (progressive
disclosure, keyboard navigation), motion-design (state transitions), and the product register
reference (full component state vocabulary).

## 11. Open Questions and Defaults

- **Mobile collapse (default decided):** the 7-column matrix will not fit narrow screens. On
  mobile, switch to per-activity sections, each showing a horizontally scrollable day strip or
  a "best window" summary with expandable days. Not blocking.
