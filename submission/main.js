// ---------------------------------------------------------------------------
// Colonist CTAs — live API wiring
// ---------------------------------------------------------------------------
// Iteration 2 (2026-04-29): both buttons are now backed by real Colonist
// data. Primary deep-links into a specific live room (not the generic
// `#quickplay` queue) so the click drops you into a game that already has
// players waiting. Secondary surfaces the active season + your region —
// `/api/leaderboards-tabs/` is geo-personalized at the upstream, so a
// reviewer in NA sees their continent, a reviewer in EU sees theirs.
//
// Why a proxy: colonist.io's API doesn't set CORS headers, so the browser
// can't call it directly from github.io. The /proxy folder ships a 70-line
// Cloudflare Worker that allowlists exactly the four GETs we need and adds
// `access-control-allow-origin: *`. See proxy/README.md.
// ---------------------------------------------------------------------------

// Cloudflare Worker base URL. Set after `cd proxy && wrangler deploy`;
// wrangler prints a `*.workers.dev` URL — paste it here. Empty string
// disables the live layer and the page falls back to static navigation
// (#quickplay / /leaderboards), so the demo never breaks if the proxy
// is down or hasn't been deployed yet.
const PROXY_BASE = "";

const COLONIST = {
  quickPlayFallback: "https://colonist.io/#quickplay",
  roomUrl: (id) => `https://colonist.io/${id}`,
  leaderboardsUrl: "https://colonist.io/leaderboards",
};

const ENDPOINTS = {
  rooms: "/api/room-list.json",
  leaderboards: "/api/leaderboards-tabs/",
};

// Room list refresh cadence. The button shows live counts, so a few-second
// stale window is fine; the proxy already caches at 15 s, so this never
// translates to upstream traffic 1:1.
const REFRESH_MS = 25_000;
const FETCH_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// State + DOM
// ---------------------------------------------------------------------------
let bestRoomId = null;

const primary = document.querySelector('[data-cta="primary"]');
const secondary = document.querySelector('[data-cta="secondary"]');
const primaryPill = primary.querySelector(".cta__pill");
const secondaryPill = secondary.querySelector(".cta__pill");
const primarySubtitle = primary.querySelector(".cta__subtitle");
const secondarySubtitle = secondary.querySelector(".cta__subtitle");

// ---------------------------------------------------------------------------
// Click handlers
// ---------------------------------------------------------------------------
primary.addEventListener("click", () => {
  // If we found a live joinable room, deep-link there. Otherwise fall back
  // to the generic quick-play hash so the click is never wasted.
  const url = bestRoomId
    ? COLONIST.roomUrl(bestRoomId)
    : COLONIST.quickPlayFallback;
  window.location.assign(url);
});

secondary.addEventListener("click", () => {
  window.location.assign(COLONIST.leaderboardsUrl);
});

// ---------------------------------------------------------------------------
// Live data
// ---------------------------------------------------------------------------
if (PROXY_BASE) {
  hydrate();
  // Re-poll rooms only — leaderboards-tabs barely changes mid-session.
  setInterval(refreshRooms, REFRESH_MS);
}

async function hydrate() {
  await Promise.all([refreshRooms(), refreshLeaderboards()]);
}

async function refreshRooms() {
  const data = await fetchJson(ENDPOINTS.rooms);
  if (!data?.rooms) return;

  const joinable = data.rooms.filter(isJoinable).sort(byMostFull);
  if (joinable.length === 0) {
    bestRoomId = null;
    setPill(primaryPill, null);
    return;
  }

  bestRoomId = joinable[0].id;
  setPill(primaryPill, `${joinable.length} live`);
  // Subtitle gets the specific room we'll drop the user into. The original
  // copy ("One click, straight into a live game") is now literally true.
  primarySubtitle.textContent = roomSubtitle(joinable[0]);
}

function isJoinable(room) {
  if (!room.visible || !room.mapPlayable || !room.modePlayable) return false;

  const filled = room.players?.length ?? 0;
  if (filled === 0 || filled >= room.maxPlayers) return false;

  // Skip rooms that are entirely bots — "QUICK PLAY" is meant to feel like
  // landing in a real game, not a sandbox.
  return room.players.some((p) => !p.isBot);
}

function byMostFull(a, b) {
  // Prefer rooms closer to starting; the wait between click and first
  // dice roll is the bit that feels vanilla today.
  return (b.players?.length ?? 0) - (a.players?.length ?? 0);
}

function roomSubtitle(room) {
  const filled = room.players?.length ?? 0;
  const seats = room.maxPlayers;
  const seatsLeft = seats - filled;
  if (seatsLeft === 1) return `Joining ${filled}/${seats} · last seat`;
  return `Joining ${filled}/${seats} · ${seatsLeft} seats open`;
}

async function refreshLeaderboards() {
  const data = await fetchJson(ENDPOINTS.leaderboards);
  if (!data) return;

  const season = data.activeSeasonData?.name?.options?.seasonNumber;
  const region = pickRegionLabel(data.tableTabs);

  const parts = [];
  if (season != null) parts.push(`S${season}`);
  if (region) parts.push(region);
  if (parts.length === 0) return;

  setPill(secondaryPill, parts.join(" · "));
  if (region) {
    secondarySubtitle.textContent = `Top players in ${region} this season`;
  }
}

function pickRegionLabel(tabs) {
  if (!Array.isArray(tabs)) return null;
  // Tabs come back ordered roughly Friends, Global, Continent, Country,
  // Region. Continent is the most legible label that's still personalised
  // (a 2-letter code like EU / NA / SA), so we surface that first and fall
  // back to the country tab's plain-string label if no continent is shown.
  const continent = tabs.find((t) => /^Continent\/[A-Z]{2}$/.test(t.leaderboardUrl ?? ""));
  if (continent) return continent.leaderboardUrl.split("/")[1];

  const country = tabs.find((t) => /^Country\/[A-Z]{2}$/.test(t.leaderboardUrl ?? ""));
  if (country && typeof country.label === "string") return country.label;

  return null;
}

async function fetchJson(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PROXY_BASE + path, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function setPill(pill, text) {
  if (!pill) return;
  if (!text) {
    pill.removeAttribute("data-active");
    pill.textContent = "";
    return;
  }
  pill.textContent = text;
  pill.setAttribute("data-active", "true");
}
