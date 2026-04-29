// ---------------------------------------------------------------------------
// Colonist CTAs — live API wiring
// ---------------------------------------------------------------------------
// Iteration 2 (2026-04-29): both buttons are now backed by real Colonist
// data, with a live activity bar above them that reads like a stadium
// ticker. Primary deep-links into a specific live room (not the generic
// `#quickplay` queue). Secondary surfaces the geo-personalised season +
// region — `/api/leaderboards-tabs/` is per-IP at the upstream, so a
// reviewer in NA sees their continent, a reviewer in EU sees theirs.
//
// Why a proxy: colonist.io's API doesn't set CORS headers, so the browser
// can't call it directly from github.io. The /proxy folder ships a 70-line
// Cloudflare Worker that allowlists exactly four GETs we need and adds
// `access-control-allow-origin: *`. See proxy/README.md.
// ---------------------------------------------------------------------------

// Cloudflare Worker base URL. Set after `cd proxy && wrangler deploy`;
// wrangler prints a `*.workers.dev` URL — paste it here. Empty string
// disables the live layer and the page falls back to static navigation
// (#quickplay / /leaderboards), so the demo never breaks if the proxy
// is down or hasn't been deployed yet.
const PROXY_BASE = "https://colonist-cta-proxy.colonist-cta-proxy.workers.dev";

const COLONIST = {
  quickPlayFallback: "https://colonist.io/#quickplay",
  roomUrl: (id) => `https://colonist.io/${id}`,
  leaderboardsUrl: "https://colonist.io/leaderboards",
};

const ENDPOINTS = {
  rooms: "/api/room-list.json",
  games: "/api/game-list.json",
  leaderboards: "/api/leaderboards-tabs/",
};

// Activity refresh cadence. Counts move every poll; the proxy already
// caches at 15 s, so this never translates to upstream traffic 1:1.
const REFRESH_MS = 25_000;
const FETCH_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// State + DOM
// ---------------------------------------------------------------------------
let bestRoomId = null;

const primary = document.querySelector('[data-cta="primary"]');
const secondary = document.querySelector('[data-cta="secondary"]');
const primarySubtitle = primary.querySelector(".cta__subtitle");

const liveBar = document.querySelector(".live-bar");
const liveBarPlaying = liveBar.querySelector('[data-stat="playing"]');
const liveBarRooms = liveBar.querySelector('[data-stat="rooms"]');
const liveBarSeason = liveBar.querySelector('[data-stat="season"]');

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
  setInterval(refreshActivity, REFRESH_MS);
}

async function hydrate() {
  await Promise.all([refreshActivity(), refreshLeaderboards()]);
}

async function refreshActivity() {
  // Both endpoints in parallel — we need rooms for the deep-link and
  // game-list for the "playing now" count of users actually mid-game.
  const [roomData, gameData] = await Promise.all([
    fetchJson(ENDPOINTS.rooms),
    fetchJson(ENDPOINTS.games),
  ]);

  if (roomData?.rooms) {
    const joinable = roomData.rooms.filter(isJoinable).sort(byMostFull);
    if (joinable.length > 0) {
      bestRoomId = joinable[0].id;
      // Subtitle gets the specific room we'll drop the user into. The
      // original copy ("straight into a live game") becomes literal.
      primarySubtitle.textContent = roomSubtitle(joinable[0]);
    } else {
      bestRoomId = null;
    }

    setStat(liveBarRooms, joinable.length);
  }

  if (roomData?.rooms || gameData?.games) {
    const inRooms = countHumans(roomData?.rooms);
    const inGames = countHumans(gameData?.games);
    setStat(liveBarPlaying, inRooms + inGames);
  }

  showBar();
}

function countHumans(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (const item of list) {
    if (!Array.isArray(item.players)) continue;
    for (const p of item.players) if (!p.isBot) n++;
  }
  return n;
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
  // Surfacing the room id makes the deep-link concrete — you can see
  // *which* room you're about to land in before you click.
  const id = room.id;
  if (seatsLeft === 1) return `Joining ${id} · ${filled}/${seats} · last seat`;
  return `Joining ${id} · ${filled}/${seats} · ${seatsLeft} seats open`;
}

async function refreshLeaderboards() {
  const data = await fetchJson(ENDPOINTS.leaderboards);
  if (!data) return;

  const season = data.activeSeasonData?.name?.options?.seasonNumber;
  const region = pickRegionLabel(data.tableTabs);

  const parts = [];
  if (season != null) parts.push(`S${season}`);
  if (region) parts.push(region);
  if (parts.length > 0) liveBarSeason.textContent = parts.join(" · ");

  if (region) {
    secondary.querySelector(".cta__subtitle").textContent =
      `Top players in ${region} this season`;
  }

  showBar();
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

// ---------------------------------------------------------------------------
// Live bar
// ---------------------------------------------------------------------------
function showBar() {
  liveBar.setAttribute("data-active", "true");
}

function setStat(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/[^0-9]/g, ""), 10) || 0;
  if (start === target) return;
  animateNumber(el, start, target);
}

// Tiny tween: 600ms ease-out cubic. Keeps the bar feeling alive when
// counts move, without pulling in a CountUp library for one feature.
function animateNumber(el, from, to, duration = 600) {
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - (1 - t) ** 3;
    const v = Math.round(from + (to - from) * eased);
    el.textContent = v.toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
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
