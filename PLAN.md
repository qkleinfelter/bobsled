# Bobsled Game — Development Plan

## Overview
A browser-based bobsled racing game rendered on an HTML5 Canvas. The player steers a bobsled down a winding ice track using keyboard controls, aiming for the fastest time. Realistic physics reward finding the optimal racing line through curves. A localStorage-backed leaderboard with 3-letter arcade-style name entry tracks best times.

## Architecture
Single-page app: `index.html` (structure + styles) + `game.js` (all game logic).

### File Structure
```
bobsled/
├── index.html      # HTML shell, CSS, canvas, UI overlays
├── game.js         # Game engine (track, physics, rendering, state, leaderboard)
└── PLAN.md         # This file
```

## Game Design

### Perspective
Top-down view with the camera following the sled. The track scrolls as the sled progresses.

### Track Representation
- Track defined as a **spine** — a polyline of control points generated with varying curvature.
- Each point has: `(x, y)` world position, `curvature`, `trackWidth`, `bankAngle`.
- Segments are interpolated with Catmull-Rom or cubic Hermite splines for smooth curves.
- Track rendered as a filled polygon with walls on each side.

### Track Generation
1. Start with a straight section.
2. Add a series of curves (alternating left/right, varying radius & length).
3. Include S-curves, hairpins, and high-speed sweepers for variety.
4. Total length ~1500–2000m (roughly 60–90 seconds of gameplay).

### Physics Model

#### Coordinate System
- `s` — distance along track spine (progress, meters).
- `d` — lateral offset from center line (meters, positive = right).
- `v` — velocity along the track (m/s).
- `ω` — lateral velocity (m/s, for steering response).

#### Forces & Effects
| Force | Description |
|---|---|
| **Gravity** | Constant downhill acceleration (~2–4 m/s², tuned for fun). |
| **Air drag** | Proportional to v² — limits top speed. |
| **Ice friction** | Small base friction (ice is slippery). |
| **Wall friction** | Large penalty when sled contacts a wall; also a lateral bounce. |
| **Banking / curve force** | In a curve, centripetal acceleration pushes the sled outward. The player must steer into the curve to hold a good line. |
| **Optimal line bonus** | Being near the apex (inside of a curve) reduces effective friction. Being on the outside adds drag. |
| **Steering** | Left/Right arrows apply lateral force. Responsiveness varies with speed (harder to steer at high speed). |

#### Key Parameters (tunable)
```
GRAVITY_ACCEL     = 3.0    m/s²
AIR_DRAG_COEFF    = 0.001
ICE_FRICTION      = 0.02
WALL_PENALTY      = 0.15   (fraction of speed lost on wall hit)
STEER_FORCE       = 8.0    m/s²
LATERAL_FRICTION  = 4.0    (damping on lateral movement)
MAX_SPEED         = ~140 km/h (~39 m/s)
TRACK_HALF_WIDTH  = 2.5 m
```

#### Update Loop (per frame, dt)
1. Compute curvature at current `s`.
2. Apply centripetal push: `ω += curvature * v² * dt` (pushes outward).
3. Apply steering input: `ω += steerDir * STEER_FORCE * dt`.
4. Apply lateral damping: `ω *= (1 - LATERAL_FRICTION * dt)`.
5. Update lateral offset: `d += ω * dt`.
6. Wall collision: if `|d| > halfWidth`, clamp, reverse `ω`, apply speed penalty.
7. Compute effective friction: base + penalty for distance from optimal line.
8. Compute acceleration: `a = GRAVITY - friction * v - drag * v²`.
9. Update velocity: `v += a * dt`, clamp ≥ 0.
10. Update progress: `s += v * dt`.
11. Check finish condition.

### Rendering
- **Camera** follows the sled, rotated so the track direction is always "up" on screen.
- **Track** drawn as a filled path with lane markings, wall highlights.
- **Sled** drawn as a small rectangle/capsule with a trail effect.
- **HUD** overlays: speedometer, elapsed time, position indicator.
- **Minimap** (optional stretch goal): small track outline showing progress.

### Controls
| Key | Action |
|---|---|
| ← / A | Steer left |
| → / D | Steer right |
| Space / Enter | Start race / confirm name entry |

### Game States
1. **Title Screen** — "BOBSLED" logo, "Press SPACE to Start".
2. **Countdown** — 3-2-1-GO with the sled at the starting gate.
3. **Racing** — Active gameplay.
4. **Finish** — Time displayed, transition to name entry if leaderboard-worthy.
5. **Name Entry** — 3-letter arcade name picker (↑/↓ to change letter, →/Enter to confirm).
6. **Leaderboard** — Top 10 times displayed. "Press SPACE to race again".

### Leaderboard
- Stored in `localStorage` as JSON array of `{ name: "AAA", time: 62.345 }`.
- Top 10 entries kept, sorted by time ascending.
- Displayed after each race, highlighting the player's new entry.

## Visual Style
- Dark blue/grey ice track with lighter edges for walls.
- Speed lines / particle effects at high speed.
- Glowing optimal-line indicator (subtle).
- Retro-inspired HUD fonts (monospace, neon colors).

## Future Enhancements (not in v1)
- Multiple track layouts / procedural generation.
- Sound effects (whoosh, scraping, crowd cheering).
- Ghost replay of best time.
- Mobile touch controls.
- Multiplayer via WebSocket.
