# Colonist — Checkered CTA A/B Variant

Take-home exercise for Colonist: a checkered 2×2 CTA layout to A/B test against
the current stacked homepage buttons.

**Live demo:** <https://elumixor.github.io/colonist-test-task/>

```
┌──────────┬──────────┐
│  orange  │          │
├──────────┼──────────┤
│          │  green   │
└──────────┴──────────┘
```

## What this is

Two buttons positioned diagonally (top-left + bottom-right), both locked to the
aspect ratio of the orange reference button, capped at 500 px wide, fully
responsive down to iPhone-SE widths. Built from the
[starter fiddle](https://jsfiddle.net/7wosc24n/) — see
[`docs/original-task-assignment.md`](docs/original-task-assignment.md) for the
full brief.

- **Primary (orange) — QUICK PLAY.** Navigates the clicker straight into a room
  via `https://colonist.io/#quickplay`.
- **Secondary (green) — JOIN A LOBBY.** Hits the Colonist lobby API, picks the
  busiest live game, and navigates there. Falls back to `/lobby` on any
  network/CORS/timeout failure so the click is never wasted.

Endpoints live in [`src/config.ts`](src/config.ts) so swapping to the real
Colonist lobby/spectate/leaderboards URL is a one-line change.

## Tech

- **TypeScript** (strict) + **Vite** for the build
- **SCSS** for styles
- **Biome** for lint + format
- **Bun** as the package manager and script runner
- **GitHub Pages** via GitHub Actions for hosting

Zero runtime dependencies. All third-party code is dev-only tooling.

## Running locally

```bash
bun install
bun run dev          # http://localhost:5173
```

```bash
bun run build        # tsc --noEmit + vite build -> dist/
bun run preview      # serve dist/ at :4173
bun run check        # biome lint + format check
bun run check:fix    # biome autofix
```

## Project layout

```
colonist-test-task/
├── index.html              # slot markup
├── src/
│   ├── main.ts             # entry
│   ├── buttons.ts          # CTA wiring + lobby API client
│   ├── config.ts           # URLs & timeouts
│   └── styles.scss         # all styles (container queries, aspect-locked)
├── docs/
│   └── original-task-assignment.md
├── .github/workflows/
│   └── deploy.yml          # builds + publishes to Pages on push to main
├── biome.json
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## Design notes

- **Checkered grid.** A 2×2 CSS grid with the primary in cell (1,1) and the
  secondary in cell (2,2). Empty cells stay empty — no absolute positioning,
  no JS measurement.
- **Container queries.** The slot declares `container-type: inline-size`, so
  button radius, padding, gap and type all scale with the slot width (not the
  viewport). Same component looks right at 240 px, 500 px, and 1000 px wide.
- **Aspect ratio.** `aspect-ratio: 3.5` locks both buttons to the proportions
  of the orange reference button and removes a class of layout bugs.
- **API resilience.** The lobby call has a 2 s abort timeout and always falls
  through to the public lobby page. The button exposes `aria-busy` during the
  request so the loading state is visible and announced.
- **Accessibility.** Native `<button>` elements, visible focus rings, `aria-live`
  status line, and a `prefers-reduced-motion` opt-out.

See the top of `src/styles.scss` and `src/buttons.ts` for inline rationale.

## CLAUDE.md

See [`CLAUDE.md`](CLAUDE.md) for the conventions Claude Code follows when
working in this repo.
