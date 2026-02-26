// ============================================================
//  BOBSLED — Game Engine
//  Top-down bobsled racing with realistic-ish physics
// ============================================================

(function () {
    "use strict";

    // ---- Canvas setup ----
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // ---- DOM refs ----
    const hudEl = document.getElementById("hud");
    const hudSpeed = document.getElementById("hud-speed");
    const hudTime = document.getElementById("hud-time");
    const progressBar = document.getElementById("track-progress");
    const progressMarker = document.getElementById("progress-marker");
    const titleScreen = document.getElementById("title-screen");
    const countdownScreen = document.getElementById("countdown-screen");
    const countdownText = document.getElementById("countdown");
    const finishScreen = document.getElementById("finish-screen");
    const finalTimeEl = document.getElementById("final-time");
    const nameEntry = document.getElementById("name-entry");
    const nameLettersEl = document.getElementById("name-letters");
    const finishPrompt = document.getElementById("finish-prompt");
    const leaderboardScreen = document.getElementById("leaderboard-screen");
    const leaderboardBody = document.getElementById("leaderboard-body");
    const pauseScreen = document.getElementById("pause-screen");
    const pauseTimeEl = document.getElementById("pause-time");
    const pauseResumeBtn = document.getElementById("pause-resume");
    const pauseRestartBtn = document.getElementById("pause-restart");
    const pauseLbBtn = document.getElementById("pause-leaderboard");

    // ---- Constants / Tuning ----
    const PHYSICS = {
        gravity: 3.2,          // m/s² downhill acceleration
        airDrag: 0.0008,       // drag coefficient (v²)
        iceFriction: 0.015,    // base friction
        wallSpeedPenalty: 0.09, // fraction of speed lost on wall hit
        wallBounce: 0.4,       // lateral velocity reversal factor
        steerForce: 14.0,      // lateral acceleration from steering m/s²
        lateralDamping: 5.5,   // damping rate on lateral velocity
        trackHalfWidth: 2.9,   // meters from center to wall
        centripetalScale: 0.85, // how much curvature pushes sled outward
        optimalLineFactor: 0.04, // extra friction for bad line
    };

    const TRACK_VISUAL = {
        metersToPx: 30,         // pixels per meter when rendering
    };

    // ---- Input ----
    const keys = {};
    window.addEventListener("keydown", e => { keys[e.code] = true; });
    window.addEventListener("keyup", e => { keys[e.code] = false; });

    // ---- Gyroscope / tilt input for mobile ----
    let tiltValue = 0; // -1 to 1, mapped from device tilt
    let gyroAvailable = false;
    const TILT_DEAD_ZONE = 3;   // degrees of tilt ignored
    const TILT_MAX_ANGLE = 25;  // degrees for full steer

    function initGyroscope() {
        // iOS 13+ requires permission
        if (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === "granted") {
                        window.addEventListener("deviceorientation", handleOrientation);
                        gyroAvailable = true;
                    }
                })
                .catch(console.warn);
        } else if ("DeviceOrientationEvent" in window) {
            // Android / older iOS — just listen
            window.addEventListener("deviceorientation", handleOrientation);
            // We'll confirm availability on the first event
        }
    }

    function handleOrientation(e) {
        if (e.gamma === null) return;
        gyroAvailable = true;
        // gamma: left/right tilt in degrees (-90..90)
        let tilt = e.gamma;
        // Apply dead zone
        if (Math.abs(tilt) < TILT_DEAD_ZONE) {
            tiltValue = 0;
        } else {
            const sign = Math.sign(tilt);
            const adjusted = Math.abs(tilt) - TILT_DEAD_ZONE;
            const maxAdj = TILT_MAX_ANGLE - TILT_DEAD_ZONE;
            tiltValue = sign * Math.min(1, adjusted / maxAdj);
        }
    }

    // ---- Touch input for mobile ----
    let isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
                   ("ontouchstart" in window);

    function steerInput() {
        let s = 0;
        if (keys["ArrowLeft"] || keys["KeyA"]) s += 1;
        if (keys["ArrowRight"] || keys["KeyD"]) s -= 1;
        // Layer gyroscope tilt on top (inverted to match visual direction)
        if (gyroAvailable) s -= tiltValue;
        return Math.max(-1, Math.min(1, s));
    }

    // ================================================================
    //  TRACK GENERATION
    // ================================================================
    // The track is a dense polyline of points along the center spine.
    // Each point stores: { x, y, angle, curvature, dist }
    // `dist` = cumulative distance from start.

    function generateTrack() {
        // Define track as a series of segments: { type, length, curvature }
        // curvature > 0 = turning right, < 0 = turning left, 0 = straight
        const segments = [
            { len: 40, curv: 0 },        // starting straight
            { len: 30, curv: 0.04 },     // gentle right
            { len: 20, curv: 0 },        // straight
            { len: 40, curv: -0.06 },    // left curve
            { len: 15, curv: 0 },        // straight
            { len: 35, curv: 0.07 },     // right curve
            { len: 25, curv: -0.03 },    // gentle left
            { len: 20, curv: 0 },        // straight
            { len: 50, curv: -0.08 },    // long left curve
            { len: 15, curv: 0 },        // straight
            { len: 30, curv: 0.05 },     // right
            { len: 20, curv: 0.09 },     // sharp right (hairpin)
            { len: 25, curv: -0.04 },    // left
            { len: 10, curv: 0 },        // straight
            { len: 35, curv: -0.07 },    // left
            { len: 30, curv: 0.06 },     // right
            { len: 18, curv: 0 },        // straight
            { len: 45, curv: -0.05 },    // long sweeping left
            { len: 20, curv: 0.04 },     // right
            { len: 12, curv: 0 },        // straight
            { len: 35, curv: 0.08 },     // sharp right
            { len: 25, curv: -0.06 },    // left
            { len: 20, curv: 0 },        // straight
            { len: 40, curv: -0.09 },    // sharp left hairpin
            { len: 15, curv: 0 },        // straight
            { len: 30, curv: 0.03 },     // gentle right
            { len: 50, curv: 0 },        // finishing straight
        ];

        const step = 0.5; // meters per point
        const points = [];
        let x = 0, y = 0, angle = Math.PI / 2; // start heading "up" (positive y)
        let dist = 0;

        for (const seg of segments) {
            const nSteps = Math.ceil(seg.len / step);
            const actualStep = seg.len / nSteps;
            for (let i = 0; i < nSteps; i++) {
                // Smooth curvature transitions by blending
                const curv = seg.curv;
                points.push({ x, y, angle, curvature: curv, dist });
                angle += curv * actualStep;
                x += Math.cos(angle) * actualStep;
                y += Math.sin(angle) * actualStep;
                dist += actualStep;
            }
        }
        // Add final point
        points.push({ x, y, angle, curvature: 0, dist });

        // Smooth curvatures with a Gaussian-ish kernel for nicer transitions
        const smoothed = smoothCurvatures(points, 12);

        return { points: smoothed, totalLength: dist };
    }

    function smoothCurvatures(points, radius) {
        const out = points.map(p => ({ ...p }));
        for (let i = 0; i < points.length; i++) {
            let sum = 0, weight = 0;
            for (let j = -radius; j <= radius; j++) {
                const idx = Math.max(0, Math.min(points.length - 1, i + j));
                const w = Math.exp(-0.5 * (j / (radius * 0.4)) ** 2);
                sum += points[idx].curvature * w;
                weight += w;
            }
            out[i].curvature = sum / weight;
        }
        return out;
    }

    // Find track point nearest to a given distance `s` along the track
    function getTrackPointAt(track, s) {
        s = Math.max(0, Math.min(track.totalLength, s));
        // Binary search
        let lo = 0, hi = track.points.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (track.points[mid].dist <= s) lo = mid;
            else hi = mid;
        }
        const p0 = track.points[lo];
        const p1 = track.points[hi];
        const segLen = p1.dist - p0.dist;
        const t = segLen > 0 ? (s - p0.dist) / segLen : 0;
        return {
            x: p0.x + (p1.x - p0.x) * t,
            y: p0.y + (p1.y - p0.y) * t,
            angle: p0.angle + angleDiff(p0.angle, p1.angle) * t,
            curvature: p0.curvature + (p1.curvature - p0.curvature) * t,
        };
    }

    function angleDiff(a, b) {
        let d = b - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return d;
    }

    // ================================================================
    //  SLED STATE & PHYSICS
    // ================================================================
    let sled, track, raceTime, gameState;
    let lastFrameTime = 0;
    let countdownTimer = 0;
    let finishTime = 0;

    function resetSled() {
        sled = {
            s: 0,          // distance along track
            d: 0,          // lateral offset (+ = right of center line facing forward)
            v: 0,          // forward velocity m/s
            omega: 0,      // lateral velocity m/s
            wallHitTimer: 0,
            wallSide: 0,
            sparkles: [],
        };
        raceTime = 0;
    }

    function updatePhysics(dt) {
        if (dt > 0.05) dt = 0.05; // cap for tab-away

        const tp = getTrackPointAt(track, sled.s);
        const curv = tp.curvature;
        const hw = PHYSICS.trackHalfWidth;

        // How close to the wall are we? (0 = center, 1 = at wall)
        const wallProximity = Math.abs(sled.d) / hw;
        // Is the curve pushing us toward the wall we're near?
        const pushingIntoWall = (Math.sign(curv) === Math.sign(sled.d));

        // 1. Centripetal push: curvature * v² pushes sled outward
        // Reduce centripetal effect when pinned near wall to prevent "stuck" feeling
        let centScale = PHYSICS.centripetalScale;
        if (pushingIntoWall && wallProximity > 0.7) {
            // Dampen centripetal force near the wall — slide along instead of pinning
            centScale *= 1.0 - (wallProximity - 0.7) / 0.3 * 0.7;
        }
        const centripetalAccel = curv * sled.v * sled.v * centScale;
        sled.omega += centripetalAccel * dt;

        // 2. Player steering — boost when near wall to help recovery
        const steer = steerInput();
        let steerMult = 1.0;
        if (wallProximity > 0.6) {
            // Steering into the wall? normal. Steering away? boosted.
            const steeringAway = (Math.sign(steer) !== Math.sign(sled.d));
            if (steeringAway) steerMult = 1.0 + (wallProximity - 0.6) / 0.4 * 0.8;
        }
        sled.omega += steer * PHYSICS.steerForce * steerMult * dt;

        // 3. Lateral damping (ice has some grip)
        sled.omega *= Math.max(0, 1 - PHYSICS.lateralDamping * dt);

        // 4. Update lateral position
        sled.d += sled.omega * dt;

        // 5. Wall collisions
        sled.wallHitTimer = Math.max(0, sled.wallHitTimer - dt);
        if (Math.abs(sled.d) > hw) {
            const side = Math.sign(sled.d);
            sled.d = side * hw;
            // Absorb lateral velocity into the wall rather than bouncing back in
            sled.omega = -sled.omega * PHYSICS.wallBounce;
            // Only apply speed penalty on fresh hits (not while grinding)
            if (sled.wallHitTimer <= 0) {
                sled.v *= (1 - PHYSICS.wallSpeedPenalty);
                addSparks(tp, sled.d, side);
            }
            sled.wallHitTimer = 0.15;
            sled.wallSide = side;
        }

        // 6. Optimal line computation
        // In a curve, the optimal line is toward the inside (opposite of curvature direction)
        // optimalD: where you should be to apex the curve
        const optimalD = -Math.sign(curv) * hw * 0.6 * Math.min(1, Math.abs(curv) * 20);
        const lineError = Math.abs(sled.d - optimalD) / (hw * 2);
        const linePenalty = lineError * PHYSICS.optimalLineFactor;

        // 7. Speed update
        const friction = PHYSICS.iceFriction + linePenalty;
        const drag = PHYSICS.airDrag;
        const accel = PHYSICS.gravity - friction * sled.v - drag * sled.v * sled.v;
        sled.v += accel * dt;
        if (sled.v < 0) sled.v = 0;

        // 8. Progress
        sled.s += sled.v * dt;

        // 9. Update sparks
        updateSparks(dt);

        // 10. Timer
        raceTime += dt;

        // 11. Finish check
        if (sled.s >= track.totalLength) {
            sled.s = track.totalLength;
            finishTime = raceTime;
            transitionTo("finish");
        }
    }

    function addSparks(tp, d, side) {
        const perp = tp.angle + Math.PI / 2;
        const wx = tp.x + Math.cos(perp) * d;
        const wy = tp.y + Math.sin(perp) * d;
        for (let i = 0; i < 5; i++) {
            sled.sparkles.push({
                x: wx + (Math.random() - 0.5) * 0.3,
                y: wy + (Math.random() - 0.5) * 0.3,
                vx: (Math.random() - 0.5) * 3 + Math.cos(perp) * side * 2,
                vy: (Math.random() - 0.5) * 3 + Math.sin(perp) * side * 2,
                life: 0.4 + Math.random() * 0.3,
            });
        }
    }

    function updateSparks(dt) {
        for (let i = sled.sparkles.length - 1; i >= 0; i--) {
            const sp = sled.sparkles[i];
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.life -= dt;
            if (sp.life <= 0) sled.sparkles.splice(i, 1);
        }
    }

    // ================================================================
    //  RENDERING
    // ================================================================

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fill background
        ctx.fillStyle = "#0a0e1a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (gameState === "racing" || gameState === "countdown" || gameState === "finish" || gameState === "paused" || gameState === "resuming" || gameState === "pausedLeaderboard") {
            renderTrack();
        }
    }

    function renderTrack() {
        const tp = getTrackPointAt(track, sled.s);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const scale = TRACK_VISUAL.metersToPx;

        // Camera: center on sled, rotated so track direction points up
        const camAngle = -tp.angle + Math.PI / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(camAngle);

        // Sled world position
        const perp = tp.angle + Math.PI / 2;
        const sledX = tp.x + Math.cos(perp) * sled.d;
        const sledY = tp.y + Math.sin(perp) * sled.d;
        ctx.translate(-sledX * scale, -sledY * scale);

        // Determine visible range of track points
        const viewRadius = Math.max(canvas.width, canvas.height) / scale + 10;
        const startIdx = findPointIndex(track, sled.s - viewRadius);
        const endIdx = findPointIndex(track, sled.s + viewRadius);

        // Draw track surface
        drawTrackSurface(startIdx, endIdx, scale);

        // Draw optimal line hint (subtle)
        drawOptimalLine(startIdx, endIdx, scale);

        // Draw track walls
        drawTrackWalls(startIdx, endIdx, scale);

        // Draw distance markers
        drawDistanceMarkers(startIdx, endIdx, scale);

        // Draw start/finish lines
        drawStartFinish(scale);

        // Draw sparks
        drawSparks(scale);

        // Draw sled
        drawSled(sledX, sledY, tp.angle, scale);

        ctx.restore();

        // Draw HUD
        renderHUD();
    }

    function findPointIndex(track, s) {
        s = Math.max(0, Math.min(track.totalLength, s));
        let lo = 0, hi = track.points.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (track.points[mid].dist <= s) lo = mid;
            else hi = mid;
        }
        return lo;
    }

    function drawTrackSurface(startIdx, endIdx, scale) {
        const hw = PHYSICS.trackHalfWidth;
        const pts = track.points;

        // Build left and right edge paths
        const leftEdge = [];
        const rightEdge = [];

        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            leftEdge.push({
                x: (p.x + Math.cos(perp) * (-hw)) * scale,
                y: (p.y + Math.sin(perp) * (-hw)) * scale,
            });
            rightEdge.push({
                x: (p.x + Math.cos(perp) * hw) * scale,
                y: (p.y + Math.sin(perp) * hw) * scale,
            });
        }

        // Fill track surface
        ctx.beginPath();
        for (let i = 0; i < leftEdge.length; i++) {
            if (i === 0) ctx.moveTo(leftEdge[i].x, leftEdge[i].y);
            else ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
        }
        for (let i = rightEdge.length - 1; i >= 0; i--) {
            ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
        }
        ctx.closePath();

        // Ice gradient effect
        ctx.fillStyle = "#1a2744";
        ctx.fill();

        // Subtle ice texture lines
        ctx.strokeStyle = "rgba(100,150,200,0.08)";
        ctx.lineWidth = 1;
        for (let i = startIdx; i <= endIdx && i < pts.length; i += 8) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo((p.x + Math.cos(perp) * (-hw)) * scale, (p.y + Math.sin(perp) * (-hw)) * scale);
            ctx.lineTo((p.x + Math.cos(perp) * hw) * scale, (p.y + Math.sin(perp) * hw) * scale);
            ctx.stroke();
        }

        // Center line (faint dashed)
        ctx.setLineDash([10, 15]);
        ctx.strokeStyle = "rgba(79,195,247,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            if (i === startIdx) ctx.moveTo(p.x * scale, p.y * scale);
            else ctx.lineTo(p.x * scale, p.y * scale);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawOptimalLine(startIdx, endIdx, scale) {
        const hw = PHYSICS.trackHalfWidth;
        const pts = track.points;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(76,175,80,0.15)";
        ctx.lineWidth = 3;

        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const optD = -Math.sign(p.curvature) * hw * 0.6 * Math.min(1, Math.abs(p.curvature) * 20);
            const perp = p.angle + Math.PI / 2;
            const ox = (p.x + Math.cos(perp) * optD) * scale;
            const oy = (p.y + Math.sin(perp) * optD) * scale;
            if (i === startIdx) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
        }
        ctx.stroke();
    }

    function drawTrackWalls(startIdx, endIdx, scale) {
        const hw = PHYSICS.trackHalfWidth;
        const pts = track.points;

        // Left wall
        ctx.beginPath();
        ctx.strokeStyle = "#546e7a";
        ctx.lineWidth = 3;
        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            const wx = (p.x + Math.cos(perp) * (-hw)) * scale;
            const wy = (p.y + Math.sin(perp) * (-hw)) * scale;
            if (i === startIdx) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // Right wall
        ctx.beginPath();
        ctx.strokeStyle = "#546e7a";
        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            const wx = (p.x + Math.cos(perp) * hw) * scale;
            const wy = (p.y + Math.sin(perp) * hw) * scale;
            if (i === startIdx) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();

        // Glow on walls (outer highlight)
        ctx.shadowColor = "rgba(100,180,255,0.3)";
        ctx.shadowBlur = 6;
        // Left wall glow
        ctx.beginPath();
        ctx.strokeStyle = "rgba(100,180,255,0.15)";
        ctx.lineWidth = 5;
        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            const wx = (p.x + Math.cos(perp) * (-hw - 0.1)) * scale;
            const wy = (p.y + Math.sin(perp) * (-hw - 0.1)) * scale;
            if (i === startIdx) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        // Right wall glow
        ctx.beginPath();
        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const perp = p.angle + Math.PI / 2;
            const wx = (p.x + Math.cos(perp) * (hw + 0.1)) * scale;
            const wy = (p.y + Math.sin(perp) * (hw + 0.1)) * scale;
            if (i === startIdx) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawDistanceMarkers(startIdx, endIdx, scale) {
        const hw = PHYSICS.trackHalfWidth;
        const pts = track.points;

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";

        for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
            const p = pts[i];
            const m = Math.round(p.dist);
            if (m % 100 === 0 && Math.abs(p.dist - m) < 0.3) {
                const perp = p.angle + Math.PI / 2;
                // Small tick marks
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo((p.x + Math.cos(perp) * (-hw + 0.3)) * scale, (p.y + Math.sin(perp) * (-hw + 0.3)) * scale);
                ctx.lineTo((p.x + Math.cos(perp) * (-hw + 0.8)) * scale, (p.y + Math.sin(perp) * (-hw + 0.8)) * scale);
                ctx.stroke();
            }
        }
    }

    function drawStartFinish(scale) {
        const hw = PHYSICS.trackHalfWidth;

        // Start line
        const sp = track.points[0];
        const sPerp = sp.angle + Math.PI / 2;
        ctx.strokeStyle = "rgba(76,175,80,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((sp.x + Math.cos(sPerp) * (-hw)) * scale, (sp.y + Math.sin(sPerp) * (-hw)) * scale);
        ctx.lineTo((sp.x + Math.cos(sPerp) * hw) * scale, (sp.y + Math.sin(sPerp) * hw) * scale);
        ctx.stroke();

        // Finish line
        const fp = track.points[track.points.length - 1];
        const fPerp = fp.angle + Math.PI / 2;
        ctx.strokeStyle = "rgba(255,82,82,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((fp.x + Math.cos(fPerp) * (-hw)) * scale, (fp.y + Math.sin(fPerp) * (-hw)) * scale);
        ctx.lineTo((fp.x + Math.cos(fPerp) * hw) * scale, (fp.y + Math.sin(fPerp) * hw) * scale);
        ctx.stroke();

        // Checkered pattern on finish
        const numChecks = 8;
        const checkSize = (hw * 2) / numChecks;
        for (let i = 0; i < numChecks; i++) {
            if (i % 2 === 0) {
                const offset = -hw + i * checkSize;
                const cx = (fp.x + Math.cos(fPerp) * (offset + checkSize / 2)) * scale;
                const cy = (fp.y + Math.sin(fPerp) * (offset + checkSize / 2)) * scale;
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.fillRect(cx - 3, cy - 3, 6, 6);
            }
        }
    }

    function drawSparks(scale) {
        for (const sp of sled.sparkles) {
            const alpha = Math.min(1, sp.life * 3);
            ctx.fillStyle = `rgba(255,200,100,${alpha})`;
            ctx.beginPath();
            ctx.arc(sp.x * scale, sp.y * scale, 2.5 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSled(sledX, sledY, angle, scale) {
        ctx.save();
        ctx.translate(sledX * scale, sledY * scale);
        ctx.rotate(angle - Math.PI / 2);

        // Speed lines (at higher speeds)
        const speedFrac = Math.min(1, sled.v / 35);
        if (speedFrac > 0.3) {
            const numLines = Math.floor(speedFrac * 6);
            for (let i = 0; i < numLines; i++) {
                const xOff = (Math.random() - 0.5) * 20;
                const len = 10 + Math.random() * 20 * speedFrac;
                ctx.strokeStyle = `rgba(150,200,255,${0.15 * speedFrac})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(xOff, 15);
                ctx.lineTo(xOff, 15 + len);
                ctx.stroke();
            }
        }

        // Sled body (elongated capsule shape)
        const sledW = 10;
        const sledH = 22;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(2, 2, sledW / 2 + 1, sledH / 2 + 1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        const bodyGrad = ctx.createLinearGradient(0, -sledH / 2, 0, sledH / 2);
        bodyGrad.addColorStop(0, "#e53935");
        bodyGrad.addColorStop(0.5, "#c62828");
        bodyGrad.addColorStop(1, "#b71c1c");
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, sledW / 2, sledH / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cockpit
        ctx.fillStyle = "#ffcdd2";
        ctx.beginPath();
        ctx.ellipse(0, -3, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, -sledH / 2 + 3, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wall hit flash
        if (sled.wallHitTimer > 0) {
            ctx.fillStyle = `rgba(255,150,50,${sled.wallHitTimer * 2})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, sledW / 2 + 4, sledH / 2 + 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    function renderHUD() {
        if (gameState !== "racing" && gameState !== "finish") return;

        // Speed
        const mph = Math.round(sled.v * 2.23694);
        hudSpeed.textContent = mph + " mph";

        // Time
        hudTime.textContent = formatTime(raceTime);

        // Progress marker
        const progress = Math.min(1, sled.s / track.totalLength);
        progressMarker.style.top = ((1 - progress) * 286) + "px";
    }

    function formatTime(t) {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 1000);
        return mins + ":" + String(secs).padStart(2, "0") + "." + String(ms).padStart(3, "0");
    }

    // ================================================================
    //  GAME STATE MACHINE
    // ================================================================

    function transitionTo(state) {
        // Hide all screens
        titleScreen.classList.remove("active");
        countdownScreen.classList.remove("active");
        finishScreen.classList.remove("active");
        leaderboardScreen.classList.remove("active");
        pauseScreen.classList.remove("active");
        hudEl.style.display = "none";
        progressBar.style.display = "none";
        nameEntry.classList.remove("active");
        finishPrompt.style.display = "none";

        gameState = state;

        switch (state) {
            case "title":
                titleScreen.classList.add("active");
                break;

            case "countdown":
                countdownScreen.classList.add("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                countdownTimer = 3.0;
                track = generateTrack();
                resetSled();
                break;

            case "racing":
                countdownScreen.classList.remove("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                break;

            case "finish":
                finishScreen.classList.add("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                finalTimeEl.textContent = formatTime(finishTime);
                // Start name entry
                nameEntryState = { letters: [0, 0, 0], cursor: 0, done: false };
                buildNameEntryUI();
                nameEntry.classList.add("active");
                break;

            case "leaderboard":
                leaderboardScreen.classList.add("active");
                document.getElementById("leaderboard-prompt").textContent = "TAP OR PRESS SPACE TO RACE AGAIN";
                renderLeaderboard();
                break;

            case "paused":
                pauseScreen.classList.add("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                pauseTimeEl.textContent = formatTime(raceTime);
                break;

            case "resuming":
                countdownScreen.classList.add("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                countdownTimer = 3.0;
                break;

            case "pausedLeaderboard":
                leaderboardScreen.classList.add("active");
                hudEl.style.display = "flex";
                progressBar.style.display = "block";
                document.getElementById("leaderboard-prompt").textContent = "PRESS SPACE OR ESC TO GO BACK";
                renderLeaderboard();
                break;
        }
    }

    // ---- Countdown logic ----
    function updateCountdown(dt) {
        countdownTimer -= dt;
        if (countdownTimer <= 0) {
            countdownText.textContent = "GO!";
            setTimeout(() => transitionTo("racing"), 300);
        } else {
            countdownText.textContent = Math.ceil(countdownTimer);
        }
    }

    function updateResumeCountdown(dt) {
        countdownTimer -= dt;
        if (countdownTimer <= 0) {
            countdownText.textContent = "GO!";
            setTimeout(() => transitionTo("racing"), 300);
        } else {
            countdownText.textContent = Math.ceil(countdownTimer);
        }
    }

    // ---- Pause menu button handlers ----
    function handlePauseResume() {
        if (gameState === "paused") transitionTo("resuming");
    }
    function handlePauseRestart() {
        if (gameState === "paused") transitionTo("countdown");
    }
    function handlePauseLeaderboard() {
        if (gameState === "paused") transitionTo("pausedLeaderboard");
    }
    pauseResumeBtn.addEventListener("click", handlePauseResume);
    pauseRestartBtn.addEventListener("click", handlePauseRestart);
    pauseLbBtn.addEventListener("click", handlePauseLeaderboard);
    pauseResumeBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseResume(); });
    pauseRestartBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseRestart(); });
    pauseLbBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseLeaderboard(); });

    // ================================================================
    //  NAME ENTRY (Arcade style)
    // ================================================================
    let nameEntryState = { letters: [0, 0, 0], cursor: 0, done: false };
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

    function buildNameEntryUI() {
        nameLettersEl.innerHTML = "";
        for (let i = 0; i < 3; i++) {
            const slot = document.createElement("div");
            slot.className = "letter-slot" + (i === nameEntryState.cursor ? " active" : "");
            slot.id = "letter-" + i;

            const up = document.createElement("div");
            up.className = "arrow up";
            up.textContent = "▲";
            slot.appendChild(up);

            const letter = document.createElement("span");
            letter.textContent = ALPHABET[nameEntryState.letters[i]];
            letter.className = "char";
            slot.appendChild(letter);

            const down = document.createElement("div");
            down.className = "arrow down";
            down.textContent = "▼";
            slot.appendChild(down);

            nameLettersEl.appendChild(slot);
        }
        // Attach touch handlers for mobile
        attachNameEntryTouch();
        attachConfirmButton();
    }

    function updateNameEntryUI() {
        for (let i = 0; i < 3; i++) {
            const slot = document.getElementById("letter-" + i);
            if (!slot) continue;
            slot.className = "letter-slot" + (i === nameEntryState.cursor ? " active" : "");
            slot.querySelector(".char").textContent = ALPHABET[nameEntryState.letters[i]];
        }
    }

    let nameKeyDebounce = {};

    function handleNameEntryInput(e) {
        if (nameEntryState.done) return;
        const now = performance.now();
        if (nameKeyDebounce[e.code] && now - nameKeyDebounce[e.code] < 150) return;
        nameKeyDebounce[e.code] = now;

        const cur = nameEntryState.cursor;

        if (e.code === "ArrowUp" || e.code === "KeyW") {
            nameEntryState.letters[cur] = (nameEntryState.letters[cur] - 1 + ALPHABET.length) % ALPHABET.length;
            updateNameEntryUI();
        } else if (e.code === "ArrowDown" || e.code === "KeyS") {
            nameEntryState.letters[cur] = (nameEntryState.letters[cur] + 1) % ALPHABET.length;
            updateNameEntryUI();
        } else if (e.code === "ArrowRight" || e.code === "Tab") {
            e.preventDefault();
            if (cur < 2) {
                nameEntryState.cursor++;
                updateNameEntryUI();
            }
        } else if (e.code === "ArrowLeft") {
            if (cur > 0) {
                nameEntryState.cursor--;
                updateNameEntryUI();
            }
        } else if (e.code === "Enter" || e.code === "Space") {
            // If not on last slot, advance; otherwise confirm
            if (cur < 2) {
                nameEntryState.cursor++;
                updateNameEntryUI();
            } else {
                // Confirm name
                nameEntryState.done = true;
                const name = nameEntryState.letters.map(i => ALPHABET[i]).join("");
                saveToLeaderboard(name, finishTime);
                nameEntry.classList.remove("active");
                finishPrompt.style.display = "block";
            }
        }
    }

    // ================================================================
    //  LEADERBOARD
    // ================================================================
    const LB_KEY = "bobsled_leaderboard";

    function loadLeaderboard() {
        try {
            const data = localStorage.getItem(LB_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function saveToLeaderboard(name, time) {
        const lb = loadLeaderboard();
        lb.push({ name, time });
        lb.sort((a, b) => a.time - b.time);
        if (lb.length > 10) lb.length = 10;
        localStorage.setItem(LB_KEY, JSON.stringify(lb));
    }

    let highlightName = "";
    let highlightTime = 0;

    function renderLeaderboard() {
        const lb = loadLeaderboard();
        leaderboardBody.innerHTML = "";

        if (lb.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="3" style="color:#546e7a;">No times yet</td>`;
            leaderboardBody.appendChild(row);
            return;
        }

        for (let i = 0; i < lb.length; i++) {
            const entry = lb[i];
            const row = document.createElement("tr");
            if (entry.name === highlightName && Math.abs(entry.time - highlightTime) < 0.01) {
                row.className = "highlight";
            }
            row.innerHTML = `
                <td class="rank">${i + 1}</td>
                <td>${entry.name}</td>
                <td>${formatTime(entry.time)}</td>
            `;
            leaderboardBody.appendChild(row);
        }
    }

    // ================================================================
    //  MAIN LOOP
    // ================================================================

    function gameLoop(timestamp) {
        const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
        lastFrameTime = timestamp;

        switch (gameState) {
            case "countdown":
                updateCountdown(dt);
                render();
                break;
            case "resuming":
                updateResumeCountdown(dt);
                render();
                break;
            case "racing":
                updatePhysics(dt);
                render();
                break;
            case "paused":
            case "pausedLeaderboard":
            case "title":
            case "finish":
            case "leaderboard":
                render();
                break;
        }

        requestAnimationFrame(gameLoop);
    }

    // ---- Global key handler ----
    window.addEventListener("keydown", function (e) {
        // Pause / unpause with Escape
        if (e.code === "Escape") {
            e.preventDefault();
            if (gameState === "racing") {
                transitionTo("paused");
            } else if (gameState === "paused") {
                transitionTo("resuming");
            } else if (gameState === "pausedLeaderboard") {
                transitionTo("paused");
            }
            return;
        }
        if (gameState === "title" && (e.code === "Space" || e.code === "Enter")) {
            e.preventDefault();
            transitionTo("countdown");
        } else if (gameState === "finish") {
            if (!nameEntryState.done) {
                handleNameEntryInput(e);
            } else if (e.code === "Space" || e.code === "Enter") {
                e.preventDefault();
                const name = nameEntryState.letters.map(i => ALPHABET[i]).join("");
                highlightName = name;
                highlightTime = finishTime;
                transitionTo("leaderboard");
            }
        } else if (gameState === "leaderboard" && (e.code === "Space" || e.code === "Enter")) {
            e.preventDefault();
            transitionTo("countdown");
        } else if (gameState === "pausedLeaderboard" && (e.code === "Space" || e.code === "Enter")) {
            e.preventDefault();
            transitionTo("paused");
        }
    });

    // Prevent space from scrolling
    window.addEventListener("keydown", e => {
        if (e.code === "Space") e.preventDefault();
    });

    // ---- Touch / tap handler for mobile ----
    function handleTap(e) {
        // Prevent double-fire and zoom
        e.preventDefault();

        if (gameState === "title") {
            // Request gyroscope permission on first user gesture (iOS requirement)
            initGyroscope();
            transitionTo("countdown");
        } else if (gameState === "finish") {
            if (nameEntryState.done) {
                const name = nameEntryState.letters.map(i => ALPHABET[i]).join("");
                highlightName = name;
                highlightTime = finishTime;
                transitionTo("leaderboard");
            }
            // Name entry touch is handled separately on the slots
        } else if (gameState === "leaderboard") {
            initGyroscope();
            transitionTo("countdown");
        } else if (gameState === "pausedLeaderboard") {
            transitionTo("paused");
        }
    }
    canvas.addEventListener("touchend", handleTap);

    // Touch-based name entry: make letter slots and arrows tappable
    function attachNameEntryTouch() {
        for (let i = 0; i < 3; i++) {
            const slot = document.getElementById("letter-" + i);
            if (!slot) continue;
            // Tap slot to select it
            slot.addEventListener("touchend", function (e) {
                e.stopPropagation();
                nameEntryState.cursor = i;
                updateNameEntryUI();
            });
            // Tap up arrow
            const upArrow = slot.querySelector(".arrow.up");
            if (upArrow) {
                upArrow.addEventListener("touchend", function (e) {
                    e.stopPropagation();
                    nameEntryState.cursor = i;
                    nameEntryState.letters[i] = (nameEntryState.letters[i] - 1 + ALPHABET.length) % ALPHABET.length;
                    updateNameEntryUI();
                });
            }
            // Tap down arrow
            const downArrow = slot.querySelector(".arrow.down");
            if (downArrow) {
                downArrow.addEventListener("touchend", function (e) {
                    e.stopPropagation();
                    nameEntryState.cursor = i;
                    nameEntryState.letters[i] = (nameEntryState.letters[i] + 1) % ALPHABET.length;
                    updateNameEntryUI();
                });
            }
        }
    }

    // Confirm button for mobile name entry
    function attachConfirmButton() {
        const confirmBtn = document.getElementById("name-confirm-btn");
        if (confirmBtn) {
            confirmBtn.addEventListener("touchend", function (e) {
                e.stopPropagation();
                if (!nameEntryState.done) {
                    nameEntryState.done = true;
                    const name = nameEntryState.letters.map(i => ALPHABET[i]).join("");
                    saveToLeaderboard(name, finishTime);
                    nameEntry.classList.remove("active");
                    finishPrompt.style.display = "block";
                }
            });
            confirmBtn.addEventListener("click", function (e) {
                if (!nameEntryState.done) {
                    nameEntryState.done = true;
                    const name = nameEntryState.letters.map(i => ALPHABET[i]).join("");
                    saveToLeaderboard(name, finishTime);
                    nameEntry.classList.remove("active");
                    finishPrompt.style.display = "block";
                }
            });
        }
    }

    // ---- Start ----
    transitionTo("title");
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);

})();
