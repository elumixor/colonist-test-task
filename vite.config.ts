import { defineConfig } from "vite";

// GitHub Pages serves the site under /<repo>/.
// The env var is injected by the deploy workflow; falls back to "/" for local dev.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
