import { COLONIST } from "./config.ts";

// Shape of a single lobby item. Kept permissive — we only rely on the URL.
interface LobbyItem {
  joinUrl?: string;
  spectateUrl?: string;
  url?: string;
  players?: number;
}

interface LobbyResponse {
  lobbies?: LobbyItem[];
  data?: LobbyItem[];
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
 * Secondary CTA — pulls the live lobby list from the Colonist API, picks the
 * busiest game, and navigates there. Any failure falls through to the public
 * lobby page so the click is never wasted.
 */
async function handleSecondaryClick(btn: HTMLButtonElement, status: HTMLElement | null): Promise<void> {
  if (btn.getAttribute("aria-busy") === "true") return;

  setBusy(btn, status, true, "Finding a live lobby…");

  try {
    const target = await fetchBestLobbyUrl();
    window.location.assign(target ?? COLONIST.lobbyFallbackUrl);
  } catch {
    // Any unexpected error still lands the user somewhere useful.
    window.location.assign(COLONIST.lobbyFallbackUrl);
  } finally {
    setBusy(btn, status, false, "");
  }
}

/**
 * Try the lobby API with a hard timeout. Returns the best join URL or null.
 * Never throws — callers treat null as "go to fallback".
 */
async function fetchBestLobbyUrl(): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, COLONIST.lobbyApiTimeoutMs);

  try {
    const res = await fetch(COLONIST.lobbyApiUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as LobbyResponse;
    const lobbies = data.lobbies ?? data.data ?? [];
    if (lobbies.length === 0) return null;

    // Busiest lobby first so the user lands in an active game.
    const best = [...lobbies].sort((a, b) => (b.players ?? 0) - (a.players ?? 0))[0];
    return best?.joinUrl ?? best?.spectateUrl ?? best?.url ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function setBusy(btn: HTMLButtonElement, status: HTMLElement | null, busy: boolean, message: string): void {
  btn.setAttribute("aria-busy", busy ? "true" : "false");
  if (status) status.textContent = message;
}
