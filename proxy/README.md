# colonist-cta-proxy

A 70-line Cloudflare Worker that sits in front of four public Colonist
endpoints and adds CORS headers, so the static demo on github.io can call
them from a browser without being blocked.

```
browser (github.io)
  └─→ <worker>.workers.dev
        └─→ colonist.io/api/{room-list.json, game-list.json,
                              leaderboards-tabs/, regions.json}
```

The allowlist is hard-coded; any other path 404s. GETs only. Per-route
edge cache TTLs (15s for room/game lists, 5 min for leaderboard tabs,
1 h for regions) keep upstream load low and latency tight.

## Deploy

One-time:

```bash
bun install
bunx wrangler login         # opens a browser tab for OAuth
bunx wrangler deploy
```

Wrangler prints a `*.workers.dev` URL — copy it into `PROXY_BASE` at the
top of `submission/main.js`.

## Local dev

```bash
bun install
bun run dev                 # http://localhost:8787
```

Test it:

```bash
curl -i http://localhost:8787/api/room-list.json | head -20
```

You should see `access-control-allow-origin: *` in the response.
