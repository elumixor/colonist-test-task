import { COLONIST } from "./config.ts";

// Shape of the response from /api/leaderboards-tabs/. Only the fields we
// actually use are typed — the rest can come and go without breaking us.
interface LeaderboardsResponse {
  activeRankedModeTypes?: number[];
  tableTabs?: Array<{
    label: string | { key: string; options?: Record<string, unknown> };
    leaderboardUrl: string;
  }>;
  activeSeasonData?: {
    rankedSeasonType?: number;
    name?: { key?: string; options?: { seasonNumber?: number } };
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Wire up both CTAs. Exposed as one function so main.ts stays trivial.
 */
export function wireCtas(root: Document | HTMLElement = document): void {
  const primary = root.querySelector<HTMLButtonElement>('[data-cta="primary"]');
  const secondary = root.querySelector<HTMLButtonElement>('[data-cta="secondary"]');
  const status = root.querySelector<HTMLElement>(".cta-slot__status");

  if (!primary || !secondary) {
    // The HTML was edited without updating this module — loud in dev, silent in prod.
    console.warn("[cta] missing button(s) in DOM");
    return;
  }

  primary.addEventListener("click", () => {
    goToQuickPlay();
  });

  secondary.addEventListener("click", () => {
    void handleSecondaryClick(secondary, status);
  });
}

/**
 * Primary CTA — sends the player straight into a room.
 * Uses same-tab navigation so the player isn't dumped into a background tab
 * they might miss.
 */
function goToQuickPlay(): void {
  window.location.assign(COLONIST.quickPlayUrl);
}

/**
 * Secondary CTA — fetches leaderboard metadata (current season + available
 * tabs), surfaces a short summary to the user + console, and navigates to
 * the leaderboards page. On any failure we still navigate, so the click is
 * never wasted.
 */
async function handleSecondaryClick(btn: HTMLButtonElement, status: HTMLElement | null): Promise<void> {
  if (btn.getAttribute("aria-busy") === "true") return;

  setBusy(btn, status, true, "Loading leaderboards…");

  try {
    const summary = await fetchLeaderboardsSummary();
    if (summary) {
      console.info("[colonist/leaderboards]", summary.raw);
      setBusy(btn, status, true, summary.userMessage);
    }
  } catch (err) {
    console.warn("[colonist/leaderboards] fetch failed, falling back", err);
  } finally {
    // Small delay lets the status line flash long enough to be readable
    // before we navigate away. Skipped when reduced-motion is preferred.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        window.location.assign(COLONIST.leaderboardsUrl);
      },
      reduced ? 0 : 600,
    );
  }
}

interface LeaderboardsSummary {
  raw: LeaderboardsResponse;
  userMessage: string;
}

/**
 * Hit /api/leaderboards-tabs/ with a hard timeout. Returns a summary or null
 * on any failure — never throws.
 */
async function fetchLeaderboardsSummary(): Promise<LeaderboardsSummary | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, COLONIST.leaderboardsApiTimeoutMs);

  try {
    const res = await fetch(COLONIST.leaderboardsApiUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as LeaderboardsResponse;
    return { raw: data, userMessage: buildUserMessage(data) };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function buildUserMessage(data: LeaderboardsResponse): string {
  const seasonNumber = data.activeSeasonData?.name?.options?.seasonNumber;
  const tabCount = data.tableTabs?.length ?? 0;
  if (seasonNumber != null) return `Season ${seasonNumber} · ${tabCount} boards`;
  if (tabCount > 0) return `${tabCount} boards available`;
  return "Opening leaderboards…";
}

function setBusy(btn: HTMLButtonElement, status: HTMLElement | null, busy: boolean, message: string): void {
  btn.setAttribute("aria-busy", busy ? "true" : "false");
  if (status) status.textContent = message;
}
