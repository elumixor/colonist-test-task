# CLAUDE.md

Conventions Claude Code should follow when editing this repo.

## Project shape

- Plain static site: HTML + SCSS + JS. No framework, no bundler, no TypeScript.
- Everything served by GitHub Pages lives under `submission/`. There is no
  separate `src/` — edit `submission/` directly.
- Only build step is `sass submission/styles.scss submission/styles.css`.
  Bun runs it; `submission/styles.css` is gitignored and produced both
  locally (`bun run build`) and in CI before the Pages upload.
- No runtime dependencies. One dev-dep (`sass`). Adding another is a real
  decision — flag it first.

## Commands

```bash
bun install
bun run build        # compile submission/styles.scss → submission/styles.css
bun run watch        # sass --watch
bun run serve        # browser-sync at :4173 (hot-reloads on submission/ changes)
bun run dev          # one-shot build + `watch` + `serve` concurrently (Ctrl+C kills both)
```

`bun run build` must succeed before any commit (CI runs the same command).

## Code style

- HTML + CSS: 2-space indent, double-quoted attributes, lowercase tags.
- SCSS: tokens at the top of `submission/styles.scss`, nesting depth ≤ 3,
  prefer container queries (`cqi` units) over viewport media queries.
- JS: plain ES2022, double quotes, semicolons, 2-space indent. No frameworks.
  Keep `submission/main.js` dependency-free.
- Comments: only when the *why* is non-obvious. Don't narrate the *what*;
  the code does that. No TODOs — either do it or open an issue.

## Component rules

- Both CTAs must stay diagonal (top-left / bottom-right) — the whole point
  of the A/B test.
- Both CTAs share the orange button's aspect ratio (3.5). Changing one
  means changing both.
- Max button width is 500 px — hard requirement from the brief.
- The secondary CTA must always resolve to a navigation, even on API
  failure (CORS, offline, timeout). Don't add `alert()` or `throw` paths.

## Endpoints & URLs

- Colonist URLs live in the `COLONIST` const at the top of
  `submission/main.js`. Changing endpoints is a one-block edit there.

## Git

- Main branch: `main`.
- Commit messages: imperative, short subject, body only if the *why* isn't
  obvious from the diff. No trailing Co-Authored-By unless asked.
- Do not push or force-push without explicit instruction.
- Never commit `submission/styles.css` — it's generated.

## Testing

- No unit tests. Surface is small (1 HTML file, ~170 lines of SCSS,
  ~90 lines of JS).
- UI changes should be sanity-checked with `bun run dev` and Playwright at
  the deployed URL before declaring done.
