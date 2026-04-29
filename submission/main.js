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
let lastLeaderboardsData = null;
let lastRoomData = null;
let lastGameData = null;
let lbModalCountdownInterval = null;

// Cap how many profiles we fetch when building the modal's player
// ranking. Each call hits the proxy (which caches at 120s), and bigger
// samples surface stronger players, but we don't need 50.
const PLAYER_SAMPLE_SIZE = 12;
const PLAYER_SHOW_TOP = 5;

const primary = document.querySelector('[data-cta="primary"]');
const secondary = document.querySelector('[data-cta="secondary"]');
const primarySubtitle = primary.querySelector(".cta__subtitle");
const secondarySubtitle = secondary.querySelector(".cta__subtitle");

const liveBar = document.querySelector(".live-bar");
const liveBarPlaying = liveBar.querySelector('[data-stat="playing"]');
const liveBarRooms = liveBar.querySelector('[data-stat="rooms"]');
const liveBarSeason = liveBar.querySelector('[data-stat="season"]');

const lbModal = document.querySelector(".lb-modal");
const lbModalClose = lbModal.querySelector(".lb-modal__close");
const lbModalSeason = lbModal.querySelector(".lb-modal__season-num");
const lbModalCountdown = lbModal.querySelector(".lb-modal__countdown");
const lbModalList = lbModal.querySelector(".lb-modal__list");

// ---------------------------------------------------------------------------
// Click handlers
// ---------------------------------------------------------------------------
primary.addEventListener("click", () => {
  // If we found a live joinable room, deep-link there. Otherwise fall back
  // to the generic quick-play hash so the click is never wasted.
  const url = bestRoomId ? COLONIST.roomUrl(bestRoomId) : COLONIST.quickPlayFallback;
  window.location.assign(url);
});

// Click on the secondary opens an in-page dialog with a real "top
// players right now" ranking — usernames pulled from the live
// /api/room-list.json + /api/game-list.json, then each player's public
// profile fetched via /api/profile/<username>/overview, sorted by
// last-100-games points. No redirect — a redirect would make the API
// result invisible to anyone reviewing the page.
secondary.addEventListener("click", () => {
  lbModal.showModal();
  populateModal();
});

lbModalClose.addEventListener("click", () => lbModal.close());

// Backdrop click closes — the dialog itself is the only thing inside the
// `<dialog>`, so a click whose target is the dialog element means the
// user clicked outside the inner card.
lbModal.addEventListener("click", (e) => {
  if (e.target === lbModal) lbModal.close();
});

lbModal.addEventListener("close", () => {
  if (lbModalCountdownInterval) clearInterval(lbModalCountdownInterval);
  lbModalCountdownInterval = null;
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
  // Both endpoints in parallel: rooms (deep-link target + waiting count)
  // and games (humans currently in a public game).
  const [roomData, gameData] = await Promise.all([
    fetchJson(ENDPOINTS.rooms),
    fetchJson(ENDPOINTS.games),
  ]);

  lastRoomData = roomData;
  lastGameData = gameData;

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

  lastLeaderboardsData = data;

  const season = data.activeSeasonData?.name?.options?.seasonNumber;
  const region = pickRegionLabel(data.tableTabs);

  const parts = [];
  if (season != null) parts.push(`S${season}`);
  if (region) parts.push(region);
  if (parts.length > 0) liveBarSeason.textContent = parts.join(" · ");

  // Live season countdown drives the subtitle. Ticking-second animation
  // is the strongest at-rest proof on the page that the API call is real
  // — clicking the button opens the modal with the full breakdown.
  if (data.activeSeasonData?.endDate) {
    startSeasonCountdown(data.activeSeasonData.endDate);
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
// Leaderboards modal — builds a "top players right now" ranking from
// three real Colonist endpoints:
//
//   1. /api/room-list.json + /api/game-list.json  → list of usernames
//      currently in public rooms or playing public games.
//   2. /api/profile/<username>/overview  → karma + last-100 score +
//      games + win % per player.
//   3. /api/leaderboards-tabs/  → active season number + endDate for the
//      countdown, geo-personalised label.
//
// Sample up to PLAYER_SAMPLE_SIZE usernames in parallel, sort by
// last-100-games points (the closest thing the public profile API has
// to a ranking metric), show top PLAYER_SHOW_TOP. Each row shows where
// the data came from on hover via the `title` attribute.
// ---------------------------------------------------------------------------
async function populateModal() {
  // Season + countdown line up first so the modal isn't empty while the
  // profile fetches resolve.
  paintSeasonLine();
  paintList(loadingItem("Sampling active players…"));

  const usernames = collectUsernames(lastRoomData?.rooms, lastGameData?.games);
  if (usernames.length === 0) {
    paintList(loadingItem("No public rooms or games to sample yet."));
    return;
  }

  const sample = usernames.slice(0, PLAYER_SAMPLE_SIZE);
  const profiles = await Promise.all(
    sample.map((u) => fetchJson(`/api/profile/${encodeURIComponent(u)}/overview`)),
  );

  const ranked = profiles
    .filter((p) => p?.gameData?.pointsInLast100Games != null)
    .sort(
      (a, b) =>
        (b.gameData.pointsInLast100Games ?? 0) - (a.gameData.pointsInLast100Games ?? 0),
    )
    .slice(0, PLAYER_SHOW_TOP);

  if (ranked.length === 0) {
    paintList(loadingItem("Couldn't load profile data."));
    return;
  }

  paintList(...ranked.map((p, i) => playerRow(p, i + 1)));
}

function paintSeasonLine() {
  const data = lastLeaderboardsData;
  const season = data?.activeSeasonData?.name?.options?.seasonNumber;
  lbModalSeason.textContent = season != null ? `Season ${season}` : "Season —";

  const endDate = data?.activeSeasonData?.endDate;
  const tickCountdown = () => {
    if (!endDate) {
      lbModalCountdown.textContent = "";
      return;
    }
    const remaining = Math.max(0, new Date(endDate).getTime() - Date.now());
    lbModalCountdown.textContent =
      remaining === 0 ? "Season ended" : `Ends in ${formatRemaining(remaining)}`;
  };
  tickCountdown();
  if (lbModalCountdownInterval) clearInterval(lbModalCountdownInterval);
  lbModalCountdownInterval = setInterval(tickCountdown, 1000);
}

function paintList(...items) {
  lbModalList.replaceChildren(...items);
}

function loadingItem(text) {
  const li = document.createElement("li");
  li.className = "lb-modal__item lb-modal__item--note";
  li.textContent = text;
  return li;
}

function playerRow(profile, rank) {
  const { username, karma, gameData = {} } = profile;
  const li = document.createElement("li");
  li.className = "lb-modal__item";

  const rankEl = document.createElement("span");
  rankEl.className = "lb-modal__rank";
  rankEl.textContent = `#${rank}`;

  const nameEl = document.createElement("strong");
  nameEl.className = "lb-modal__name";
  nameEl.textContent = username;

  const stats = document.createElement("span");
  stats.className = "lb-modal__stats";
  const pil = gameData.pointsInLast100Games ?? "—";
  const games = gameData.totalGames ?? "—";
  const win = gameData.winPercent ?? "—";
  stats.textContent = `${pil} pts · ${games} games · ${win}% W · karma ${karma ?? "—"}`;

  li.append(rankEl, nameEl, stats);
  return li;
}

// Walk the cached room+game data and return unique non-bot usernames.
// Players in mid-game (`game-list`) tend to be more committed than
// people lurking in lobbies, so they go first; lobby players fill out
// the sample.
function collectUsernames(rooms, games) {
  const seen = new Set();
  const ordered = [];
  const collect = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      for (const p of item.players ?? []) {
        if (p.isBot || !p.username) continue;
        if (seen.has(p.username)) continue;
        seen.add(p.username);
        ordered.push(p.username);
      }
    }
  };
  collect(games);
  collect(rooms);
  return ordered;
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
