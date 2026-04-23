# Submission bundle

This folder is **both** the GitHub Pages deploy root and the JSFiddle
submission source. No separate `src/` — edit files here directly.

| File          | Purpose                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `index.html`  | Full HTML doc for Pages; body-only markup is what you paste to JSFiddle. |
| `styles.scss` | **Only stylesheet source.** Paste into JSFiddle's CSS box (language = SCSS). |
| `styles.css`  | Generated from `styles.scss` by `bun run build`. Gitignored. Served by Pages. |
| `main.js`     | Plain JS — no compile step. Paste into JSFiddle's JS box.              |

## JSFiddle paste recipe

1. **HTML box** → everything inside `<body>` of `index.html` (the
   `<!-- design decisions -->` comment and the `<main>`). JSFiddle wraps
   the doc for you; you don't need the `<link>`/`<script>` tags.
2. **CSS box** (language dropdown = **SCSS**) → full contents of
   `styles.scss`.
3. **JS box** → full contents of `main.js`.

The `@font-face` rules + Colonist CDN preconnect live in `index.html`'s
`<head>` — also paste those into a JSFiddle `<style>` block if you want
the brand typography in the fiddle preview.
