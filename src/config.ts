// Central place for Colonist URLs and API endpoints. If the real endpoints
// differ from my best guesses, swap them here — no code changes needed.

export const COLONIST = {
  // Primary CTA destination — starts a quick game.
  quickPlayUrl: "https://colonist.io/#quickplay",

  // Secondary CTA — leaderboards integration.
  //
  // Fetches the leaderboard-tabs metadata (current season + available tabs)
  // before navigating, so we can log/preview what the user's about to see.
  leaderboardsApiUrl: "https://colonist.io/api/leaderboards-tabs/",
  leaderboardsUrl: "https://colonist.io/leaderboards",

  // Hard cap on the API call so a hung network doesn't block the user.
  leaderboardsApiTimeoutMs: 2000,
} as const;
