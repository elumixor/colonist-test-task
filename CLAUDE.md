# CLAUDE.md

Conventions Claude Code should follow when editing this repo.

## Project shape

- Static Vite + TypeScript (strict) site; SCSS for styles; Biome for lint/format.
- Bun is the package manager. Prefer `bun` over `npm`/`pnpm`/`yarn`.
- No runtime dependencies. Adding one is a real decision — flag it first.
- Hosted on GitHub Pages via `.github/workflows/deploy.yml`. The deployed URL
  is derived from `VITE_BASE` injected by that workflow.

## Commands

```bash
bun run dev          # vite dev server
bun run build        # tsc --noEmit then vite build (run this before committing)
bun run preview      # serve the production build
bun run check        # biome check .
bun run check:fix    # biome check --write .
```

`bun run build` and `bun run check` must both pass before any commit.

## Code style

- Double quotes, semicolons, 2-space indent, 120-column line width (all
  enforced by Biome — don't hand-tune).
- No `any`. No floating promises. Follow the rules already in `biome.json`.
- TypeScript `strict` + `noUncheckedIndexedAccess` are on; expect `T | undefined`
  from indexed access and handle it.
- Imports use explicit `.ts` extensions — `allowImportingTsExtensions` is on.
- Comments: only when the *why* is non-obvious. Don't narrate the *what*; the
  code does that. Don't leave TODOs for future work — either do it or open an
  issue.

## Styling

- SCSS lives in `src/styles.scss`. Keep design tokens at the top.
- Prefer container queries (`container-type: inline-size` + `cqi` units) over
  viewport media queries for the CTA component — it's embedded in a slot
  whose width is not the viewport.
- `aspect-ratio` for proportion locks, `clamp()` for responsive scalars.

## Component rules

- Both CTAs must stay diagonal (top-left / bottom-right) — the whole point of
  the A/B test.
- Both CTAs share the orange button's aspect ratio; changing one means
  changing both.
- Max button width is 500 px — hard requirement from the brief.
- The secondary CTA must always resolve to a navigation, even on API failure
  (CORS, offline, timeout). Don't add `alert()` or `throw` error paths.

## Endpoints & URLs

- All Colonist URLs live in `src/config.ts`. If the real lobby/spectate API
  endpoint differs from the current guess, update `config.ts` only.

## Git

- Main branch: `main`.
- Commit messages: imperative, short subject, body only if the *why* isn't
  obvious from the diff. No trailing Co-Authored-By unless the human asks.
- Do not push or force-push without explicit instruction.

## Testing

- No unit-test framework is set up — the surface is small. If tests become
  warranted, use Vitest (Vite's sibling) before reaching for anything else.
- UI changes should be sanity-checked via `bun run preview` and Playwright at
  the deployed URL before declaring done.
