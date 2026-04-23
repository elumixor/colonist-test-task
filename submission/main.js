// Central place for Colonist URLs. Swap these for the real production
// endpoints in one place — no other code changes needed.
const COLONIST = {
  // Primary CTA — lands the player in a live room.
  quickPlayUrl: "https://colonist.io/#quickplay",

  // Secondary CTA — leaderboards integration.
  leaderboardsApiUrl: "https://colonist.io/api/leaderboards-tabs/",
  leaderboardsUrl: "https://colonist.io/leaderboards",

  // Hard cap so a hung network never blocks the user.
  leaderboardsApiTimeoutMs: 2000,
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
// Secondary CTA — fetches leaderboard metadata (season + available tabs),
// logs the raw response and flashes a short summary, then navigates. Any
// failure still navigates, so the click is never wasted.
// ---------------------------------------------------------------------------
async function handleSecondaryClick() {
  if (secondary.getAttribute("aria-busy") === "true") return;

  setBusy(true, "Loading leaderboards…");

  try {
    const summary = await fetchLeaderboardsSummary();
    if (summary) {
      console.info("[colonist/leaderboards]", summary.raw);
      setBusy(true, summary.userMessage);
    }
  } catch (err) {
    console.warn("[colonist/leaderboards] fetch failed, falling back", err);
  } finally {
    // Navigate immediately — a click has already committed the user;
    // holding them on the page to read a status line just adds latency.
    window.location.assign(COLONIST.leaderboardsUrl);
  }
}

async function fetchLeaderboardsSummary() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COLONIST.leaderboardsApiTimeoutMs);

  try {
    const res = await fetch(COLONIST.leaderboardsApiUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    return { raw: data, userMessage: buildUserMessage(data) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildUserMessage(data) {
  const seasonNumber = data?.activeSeasonData?.name?.options?.seasonNumber;
  const tabCount = data?.tableTabs?.length ?? 0;
  if (seasonNumber != null) return `Season ${seasonNumber} · ${tabCount} boards`;
  if (tabCount > 0) return `${tabCount} boards available`;
  return "Opening leaderboards…";
}

function setBusy(busy, message) {
  secondary.setAttribute("aria-busy", busy ? "true" : "false");
  status.textContent = message;
}
