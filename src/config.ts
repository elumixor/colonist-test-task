// Central place for Colonist URLs and API endpoints. If the real endpoints
// differ from my best guesses, swap them here — no code changes needed.

export const COLONIST = {
  // Primary CTA destination — starts a quick game.
  quickPlayUrl: "https://colonist.io/#quickplay",

  // Secondary CTA — lobby / spectate / leaderboards integration.
  //
  // We try the lobby list endpoint first and open the busiest live lobby so
  // the user lands directly in the action. If the endpoint is unreachable
  // (CORS, offline, rate-limit), we fall back to the lobby page.
  lobbyApiUrl: "https://colonist.io/api/lobby/list",
  lobbyFallbackUrl: "https://colonist.io/lobby",

  // Hard cap on the API call so a hung network doesn't block the user.
  lobbyApiTimeoutMs: 2000,
} as const;
