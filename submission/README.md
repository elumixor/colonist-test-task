# JSFiddle submission bundle

Three files, one per JSFiddle panel. Paste each into the matching box.

| File | JSFiddle panel | Notes |
| ---- | -------------- | ----- |
| `jsfiddle.html` | HTML | Already contains the thought-process comment the brief requires at the top. |
| `jsfiddle.scss` | CSS (set language = SCSS) | Flattened from `src/styles.scss`; uses legacy `darken()` / `lighten()` instead of `@use "sass:color"` so JSFiddle's SCSS preprocessor accepts it. |
| `jsfiddle.js` | JavaScript | Plain JS equivalent of `src/buttons.ts` + `src/config.ts`, inlined since JSFiddle doesn't bundle TS imports. |

The repo version (Vite + TS + SCSS) is the source of truth; these files are
derived. When iterating, edit `src/` first, then resync this folder.
