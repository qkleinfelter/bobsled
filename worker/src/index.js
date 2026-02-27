// ============================================================
//  Bobsled Leaderboard — Cloudflare Worker (R2 Storage)
// ============================================================

const VALID_TRACKS = ["alpine", "glacier", "inferno"];
const MAX_NAME_LEN = 3;

function r2Key(trackId) {
  return `leaderboard/${trackId}.json`;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env),
    },
  });
}

// Read leaderboard from R2, returning [] if not found
async function readLeaderboard(env, trackId) {
  const obj = await env.LEADERBOARD_BUCKET.get(r2Key(trackId));
  if (!obj) return [];
  try {
    return await obj.json();
  } catch {
    return [];
  }
}

// Write leaderboard to R2
async function writeLeaderboard(env, trackId, entries) {
  await env.LEADERBOARD_BUCKET.put(
    r2Key(trackId),
    JSON.stringify(entries),
    { httpMetadata: { contentType: "application/json" } }
  );
}

// Validate a score submission
function validateEntry(body) {
  if (!body || typeof body !== "object") return "Invalid JSON body";
  if (typeof body.name !== "string" || body.name.length < 1 || body.name.length > MAX_NAME_LEN) {
    return "Name must be 1-3 characters";
  }
  if (!/^[A-Z0-9 ]+$/.test(body.name)) {
    return "Name must be uppercase alphanumeric";
  }
  if (typeof body.time !== "number" || body.time <= 0 || body.time > 600) {
    return "Time must be a positive number under 600 seconds";
  }
  if (typeof body.topSpeed !== "number" || body.topSpeed < 0 || body.topSpeed > 200) {
    return "Top speed must be between 0 and 200 m/s";
  }
  return null;
}

// ---- Route handlers ----

async function handleGetLeaderboard(env, trackId) {
  if (!VALID_TRACKS.includes(trackId)) {
    return jsonResponse({ error: "Unknown track" }, 404, env);
  }
  const entries = await readLeaderboard(env, trackId);
  return jsonResponse(entries, 200, env);
}

async function handlePostScore(env, trackId, request) {
  if (!VALID_TRACKS.includes(trackId)) {
    return jsonResponse({ error: "Unknown track" }, 404, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, env);
  }

  const err = validateEntry(body);
  if (err) {
    return jsonResponse({ error: err }, 400, env);
  }

  const maxEntries = parseInt(env.MAX_ENTRIES || "10", 10);
  const entries = await readLeaderboard(env, trackId);

  // Add entry
  entries.push({
    name: body.name.toUpperCase(),
    time: Math.round(body.time * 1000) / 1000,   // 3 decimal places
    topSpeed: Math.round(body.topSpeed * 100) / 100,
    date: new Date().toISOString(),
  });

  // Sort by time ascending, keep top N
  entries.sort((a, b) => a.time - b.time);
  if (entries.length > maxEntries) entries.length = maxEntries;

  await writeLeaderboard(env, trackId, entries);

  // Find rank of the submitted entry (first match by time + name)
  const rank = entries.findIndex(
    (e) => e.name === body.name.toUpperCase() && Math.abs(e.time - body.time) < 0.002
  );

  return jsonResponse({ ok: true, rank: rank + 1, total: entries.length }, 201, env);
}

// ---- Main fetch handler ----

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    // Route: GET /api/leaderboard/:trackId
    // Route: POST /api/leaderboard/:trackId
    const match = url.pathname.match(/^\/api\/leaderboard\/([a-z]+)$/);
    if (match) {
      const trackId = match[1];
      if (method === "GET") return handleGetLeaderboard(env, trackId);
      if (method === "POST") return handlePostScore(env, trackId, request);
      return jsonResponse({ error: "Method not allowed" }, 405, env);
    }

    // Health check
    if (url.pathname === "/api/health") {
      return jsonResponse({ status: "ok" }, 200, env);
    }

    return jsonResponse({ error: "Not found" }, 404, env);
  },
};
