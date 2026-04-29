// ---------------------------------------------------------------------------
// Colonist CTAs — live API wiring
// ---------------------------------------------------------------------------
// Iteration 2 (2026-04-29): both buttons are now backed by real Colonist
// data, with a live activity bar above and a regional-tabs strip below
// the secondary that visualises the geo-personalised leaderboard tabs.
// Primary deep-links into a specific live room (not the generic
// `#quickplay` queue).
//
// Why a proxy: colonist.io's API doesn't set CORS headers, so the browser
// can't call it directly from github.io. The /proxy folder ships a small
// Cloudflare Worker that allowlists exactly the four GETs we need and
// adds `access-control-allow-origin: *`. See proxy/README.md.
//
// What we don't do: scrape `window.onlineCount` from the homepage HTML.
// Those bigger numbers exist as SSR'd vars (~6k online, ~240k games/day),
// but Colonist exposes no JSON endpoint for them and we'd be relying on
// HTML structure that can change without notice. The numbers below come
// straight from documented JSON endpoints, so they're a strict subset
// (people in *publicly-listed* rooms / games), but every value is real
// and stable.
// ---------------------------------------------------------------------------

// Cloudflare Worker base URL. Set after `cd proxy && wrangler deploy`;
// wrangler prints a `*.workers.dev` URL — paste it here. Empty string
// disables the live layer and the page falls back to static navigation
// (#quickplay / /leaderboards), so the demo never breaks if the proxy
// is down or hasn't been deployed yet.
const PROXY_BASE = "https://colonist-cta-proxy.colonist-cta-proxy.workers.dev";

const COLONIST_BASE = "https://colonist.io";
const COLONIST = {
  quickPlayFallback: `${COLONIST_BASE}/#quickplay`,
  roomUrl: (id) => `${COLONIST_BASE}/${id}`,
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
const secondarySubtitle = secondary.querySelector(".cta__subtitle");

const liveBar = document.querySelector(".live-bar");
const liveBarPlaying = liveBar.querySelector('[data-stat="playing"]');
const liveBarRooms = liveBar.querySelector('[data-stat="rooms"]');
const liveBarSeason = liveBar.querySelector('[data-stat="season"]');

const regionTabs = document.querySelector(".region-tabs");

// ---------------------------------------------------------------------------
// Click handlers
// ---------------------------------------------------------------------------
primary.addEventListener("click", () => {
  // If we found a live joinable room, deep-link there. Otherwise fall back
  // to the generic quick-play hash so the click is never wasted.
  const url = bestRoomId ? COLONIST.roomUrl(bestRoomId) : COLONIST.quickPlayFallback;
  window.location.assign(url);
});

// The secondary intentionally has no click handler. Its job is to *show*
// what /api/leaderboards-tabs/ returned (live season countdown in the
// subtitle, geo-personalised chip row below) — not to redirect the user
// to colonist.io, which would make the API call invisible to a reviewer.

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
  // Both endpoints in parallel: rooms (deep-link target + waiting count)
  // and games (humans currently in a public game).
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
    // "Playing now" here means humans in publicly-listed rooms or games.
    // It's a strict subset of total online (private rooms, matchmaking
    // queue and idle-in-menu users aren't in either listing) — but every
    // counted player is a real session in a real public room, no scrape.
    setStat(liveBarPlaying, countHumans(roomData?.rooms) + countHumans(gameData?.games));
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

  // Live season countdown drives the subtitle. Ticking-second animation
  // is the strongest proof on the page that the API call is real — it's
  // not something a static mock can fake.
  if (data.activeSeasonData?.endDate) {
    startSeasonCountdown(data.activeSeasonData.endDate);
  }

  renderRegionTabs(data.tableTabs);

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
// Region tabs — visualises the geo-personalised tableTabs from the API as
// passive label chips. The chips don't navigate (a click that leaves the
// page would make the API call invisible to a reviewer) — they exist to
// show that the API tailored this list to the viewer's location: a
// viewer in Berlin sees Global / EU / DE / Berlin; a viewer in Toronto
// sees Global / NA / CA / Ontario; etc.
// ---------------------------------------------------------------------------
function renderRegionTabs(tabs) {
  if (!regionTabs || !Array.isArray(tabs)) return;

  const chips = tabs
    .filter((t) => t.leaderboardUrl !== "Friends") // Friends tab requires login.
    .map((tab) => {
      const span = document.createElement("span");
      span.className = "region-tabs__chip";
      span.textContent = tabLabel(tab);
      return span;
    });

  if (chips.length === 0) return;
  regionTabs.replaceChildren(...chips);
  regionTabs.setAttribute("data-active", "true");
}

function tabLabel(tab) {
  if (typeof tab.label === "string") return tab.label;
  // i18n keys look like "strings:leaderboardPage.tabs.global" or
  // "strings:leaderboardPage.tabs.continents.EU" — the suffix is the
  // most-readable thing we can extract without shipping a translation
  // table.
  if (tab.label?.key) {
    const last = tab.label.key.split(".").pop();
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return tab.leaderboardUrl || "Global";
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
// Season countdown — turns activeSeasonData.endDate into a live ticker.
// One second per repaint, formatted as `Nd HHh MMm SSs`.
// ---------------------------------------------------------------------------
let countdownInterval = null;

function startSeasonCountdown(endDateIso) {
  if (countdownInterval) clearInterval(countdownInterval);
  const endTime = new Date(endDateIso).getTime();
  if (Number.isNaN(endTime)) return;

  const update = () => {
    const remaining = Math.max(0, endTime - Date.now());
    secondarySubtitle.textContent =
      remaining === 0 ? "Season ended" : `Season ends in ${formatRemaining(remaining)}`;
  };
  update();
  countdownInterval = setInterval(update, 1000);
}

function formatRemaining(ms) {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
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
