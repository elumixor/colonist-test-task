// Cloudflare Worker — minimal CORS proxy in front of a tiny allowlist of
// public Colonist endpoints. Exists for one reason: the take-home demo is
// served from github.io, and colonist.io's API doesn't set any
// `access-control-*` headers, so a direct browser fetch is blocked.
//
// Scope is intentionally small. Only GETs, only the four read-only routes
// the CTAs actually need. Anything else 404s.

const UPSTREAM = "https://colonist.io";

// path → cache TTL (seconds). Tuned per-route:
//   * room-list / game-list change every few seconds; keep TTL short so the
//     button feels live without hammering upstream.
//   * leaderboards-tabs is geo-personalized but stable for a given region;
//     5 min is plenty.
//   * regions.json is effectively static.
const ALLOW = new Map([
	["/api/room-list.json", { ttl: 15 }],
	["/api/game-list.json", { ttl: 15 }],
	["/api/leaderboards-tabs/", { ttl: 300 }],
	["/api/regions.json", { ttl: 3600 }],
]);

function corsHeaders(origin) {
	return {
		"access-control-allow-origin": origin || "*",
		"access-control-allow-methods": "GET, OPTIONS",
		"access-control-allow-headers": "accept, content-type",
		"access-control-max-age": "86400",
		vary: "origin",
	};
}

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const origin = request.headers.get("origin") || "*";

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders(origin) });
		}
		if (request.method !== "GET") {
			return new Response("method not allowed", {
				status: 405,
				headers: corsHeaders(origin),
			});
		}

		const route = ALLOW.get(url.pathname);
		if (!route) {
			return new Response("not found", {
				status: 404,
				headers: corsHeaders(origin),
			});
		}

		// We don't forward the user's IP. Cloudflare's edge already runs near
		// the user, so upstream sees a regional CF address — close enough that
		// Colonist's geo-personalization (continent / country) lands on the
		// right region for our purposes.
		let upstreamRes;
		try {
			upstreamRes = await fetch(`${UPSTREAM}${url.pathname}`, {
				cf: { cacheTtl: route.ttl, cacheEverything: true },
				headers: { accept: "application/json" },
			});
		} catch {
			return new Response(JSON.stringify({ error: "upstream_unreachable" }), {
				status: 502,
				headers: {
					...corsHeaders(origin),
					"content-type": "application/json",
				},
			});
		}

		const body = await upstreamRes.arrayBuffer();
		const headers = new Headers(corsHeaders(origin));
		headers.set(
			"content-type",
			upstreamRes.headers.get("content-type") || "application/json",
		);
		headers.set("cache-control", `public, max-age=${route.ttl}`);
		headers.set("x-proxied-by", "colonist-cta-proxy");
		return new Response(body, { status: upstreamRes.status, headers });
	},
};
