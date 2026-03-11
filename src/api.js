// ============================================================
//  Leaderboard API — Communicate with Cloudflare Worker
// ============================================================

// Uses same-origin requests (/api/*) by default.
// Set to a full URL to use a different backend, or "OFF" to disable.
const API_BASE = "";

function getApiBase() {
  return window.BOBSLED_API_URL ?? API_BASE;
}

function isOnline() {
  return getApiBase() !== "OFF";
}

/**
 * Fetch global leaderboard for a track from the Worker.
 * Returns [] if the API is unavailable or not configured.
 */
export async function fetchGlobalLeaderboard(trackId) {
  if (!isOnline()) return [];
  try {
    const res = await fetch(`${getApiBase()}/api/leaderboard/${trackId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Submit a score to the global leaderboard.
 * Returns { ok, rank, total } on success or null on failure.
 */
export async function submitGlobalScore(
  trackId,
  name,
  time,
  topSpeed,
  distance,
) {
  if (!isOnline()) return null;
  try {
    const body = { name, time, topSpeed };
    if (distance) body.distance = distance;
    const res = await fetch(`${getApiBase()}/api/leaderboard/${trackId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
