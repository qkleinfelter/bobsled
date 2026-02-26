// ============================================================
//  Rendering — Canvas drawing & HUD
// ============================================================

import { PHYSICS, TRACK_VISUAL, NUM_SECTORS } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { TRACKS } from './tracks.js';
import { getTrackPointAt, findPointIndex } from './tracks.js';
import { formatTime } from './utils.js';

export function render() {
    const { ctx, canvas } = dom;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.gameState === "racing" || state.gameState === "countdown" ||
        state.gameState === "finish" || state.gameState === "paused" ||
        state.gameState === "resuming" || state.gameState === "pausedLeaderboard") {
        renderTrack();
    }
}

function renderTrack() {
    const { ctx, canvas } = dom;
    const sled = state.sled;
    const track = state.track;
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

    drawTrackSurface(startIdx, endIdx, scale);
    drawOptimalLine(startIdx, endIdx, scale);
    drawTrackWalls(startIdx, endIdx, scale);
    drawDistanceMarkers(startIdx, endIdx, scale);
    drawStartFinish(startIdx, endIdx, scale);
    drawSparks(scale);
    drawSled(sledX, sledY, tp.angle, scale);

    ctx.restore();

    renderHUD();
}

// ---- Track Surface ----

function drawTrackSurface(startIdx, endIdx, scale) {
    const { ctx } = dom;
    const hw = PHYSICS.trackHalfWidth;
    const pts = state.track.points;

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

// ---- Optimal Line ----

function drawOptimalLine(startIdx, endIdx, scale) {
    const { ctx } = dom;
    const hw = PHYSICS.trackHalfWidth;
    const pts = state.track.points;

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

// ---- Track Walls ----

function drawTrackWalls(startIdx, endIdx, scale) {
    const { ctx } = dom;
    const hw = PHYSICS.trackHalfWidth;
    const pts = state.track.points;

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

// ---- Distance Markers ----

function drawDistanceMarkers(startIdx, endIdx, scale) {
    const { ctx } = dom;
    const hw = PHYSICS.trackHalfWidth;
    const pts = state.track.points;

    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";

    for (let i = startIdx; i <= endIdx && i < pts.length; i++) {
        const p = pts[i];
        const m = Math.round(p.dist);
        if (m % 100 === 0 && Math.abs(p.dist - m) < 0.3) {
            const perp = p.angle + Math.PI / 2;
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo((p.x + Math.cos(perp) * (-hw + 0.3)) * scale, (p.y + Math.sin(perp) * (-hw + 0.3)) * scale);
            ctx.lineTo((p.x + Math.cos(perp) * (-hw + 0.8)) * scale, (p.y + Math.sin(perp) * (-hw + 0.8)) * scale);
            ctx.stroke();
        }
    }
}

// ---- Start / Finish Lines ----

function drawStartFinish(startIdx, endIdx, scale) {
    const { ctx } = dom;
    const hw = PHYSICS.trackHalfWidth;
    const track = state.track;

    // Start line — only draw if index 0 is in visible range
    if (startIdx === 0) {
        const sp = track.points[0];
        const sPerp = sp.angle + Math.PI / 2;
        ctx.strokeStyle = "rgba(76,175,80,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo((sp.x + Math.cos(sPerp) * (-hw)) * scale, (sp.y + Math.sin(sPerp) * (-hw)) * scale);
        ctx.lineTo((sp.x + Math.cos(sPerp) * hw) * scale, (sp.y + Math.sin(sPerp) * hw) * scale);
        ctx.stroke();
    }

    // Finish line — only draw if last index is in visible range
    if (endIdx >= track.points.length - 2) {
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
}

// ---- Sparks ----

function drawSparks(scale) {
    const { ctx } = dom;
    for (const sp of state.sled.sparkles) {
        const alpha = Math.min(1, sp.life * 3);
        ctx.fillStyle = `rgba(255,200,100,${alpha})`;
        ctx.beginPath();
        ctx.arc(sp.x * scale, sp.y * scale, 2.5 * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---- Sled ----

function drawSled(sledX, sledY, angle, scale) {
    const { ctx } = dom;
    const sled = state.sled;

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

// ---- HUD ----

function renderHUD() {
    if (state.gameState !== "racing" && state.gameState !== "finish") return;

    // Speed
    const mph = Math.round(state.sled.v * 2.23694);
    dom.hudSpeed.textContent = mph + " mph";

    // Track name & difficulty
    const t = TRACKS[state.selectedTrackIdx];
    dom.hudTrack.textContent = t.name + "  ·  " + t.description;
    dom.hudTrack.style.color = t.color;

    // Time
    dom.hudTime.textContent = formatTime(state.raceTime);

    // Progress marker
    const progress = Math.min(1, state.sled.s / state.track.totalLength);
    dom.progressMarker.style.top = (progress * 286) + "px";

    // Position sector dividers and time labels
    for (let i = 0; i < NUM_SECTORS; i++) {
        const frac = (i + 1) / NUM_SECTORS;
        const yPos = frac * 286;
        if (i < NUM_SECTORS - 1) {
            const div = document.getElementById("sector-div-" + (i + 1));
            if (div) div.style.top = yPos + "px";
        }
        const midFrac = (i + 0.5) / NUM_SECTORS;
        const labelY = midFrac * 286;
        const lbl = document.getElementById("sector-time-" + i);
        if (lbl) lbl.style.top = labelY + "px";
    }
}
