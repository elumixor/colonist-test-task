// Central place for Colonist URLs. Swap these for the real production
// endpoints once known — no other code changes needed.
const COLONIST = {
  // Primary CTA — lands the player in a live room.
  quickPlayUrl: "https://colonist.io/#quickplay",

  // Secondary CTA — lobby / spectate / leaderboards integration. Try the
  // lobby list endpoint, open the busiest live lobby, fall back to the
  // lobby page on any failure.
  lobbyApiUrl: "https://colonist.io/api/lobby/list",
  lobbyFallbackUrl: "https://colonist.io/lobby",

  // Hard cap so a hung network never blocks the user.
  lobbyApiTimeoutMs: 2000,
};

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
const primary = document.querySelector('[data-cta="primary"]');
const secondary = document.querySelector('[data-cta="secondary"]');
const status = document.querySelector(".cta-slot__status");

primary.addEventListener("click", () => {
  // Same-tab navigation — players shouldn't get dumped into a background tab.
  window.location.assign(COLONIST.quickPlayUrl);
});

secondary.addEventListener("click", () => {
  handleSecondaryClick();
});

// ---------------------------------------------------------------------------
// Secondary CTA logic
// ---------------------------------------------------------------------------
async function handleSecondaryClick() {
  if (secondary.getAttribute("aria-busy") === "true") return;

  setBusy(true, "Finding a live lobby…");

  try {
    const target = await fetchBestLobbyUrl();
    window.location.assign(target || COLONIST.lobbyFallbackUrl);
  } catch {
    window.location.assign(COLONIST.lobbyFallbackUrl);
  } finally {
    setBusy(false, "");
  }
}

// Hits the lobby API with a hard timeout. Returns the best join URL or null
// — never throws, so the caller just treats null as "use the fallback".
async function fetchBestLobbyUrl() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COLONIST.lobbyApiTimeoutMs);

  try {
    const res = await fetch(COLONIST.lobbyApiUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const lobbies = data.lobbies || data.data || [];
    if (!lobbies.length) return null;

    // Busiest lobby first so the user lands in an active game.
    const best = [...lobbies].sort((a, b) => (b.players || 0) - (a.players || 0))[0];
    return best.joinUrl || best.spectateUrl || best.url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function setBusy(busy, message) {
  secondary.setAttribute("aria-busy", busy ? "true" : "false");
  status.textContent = message;
}
