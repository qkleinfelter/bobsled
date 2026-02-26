// ============================================================
//  Physics — Sled simulation, sparks
// ============================================================

import { PHYSICS, NUM_SECTORS } from './constants.js';
import { state } from './state.js';
import { getTrackPointAt } from './tracks.js';
import { steerInput } from './input.js';
import { loadBestSectors, saveBestSectors } from './sectors.js';
import { formatSectorTime } from './utils.js';

/**
 * Advance physics one time-step.
 * @returns {boolean} true if the sled crossed the finish line this frame.
 */
export function updatePhysics(dt) {
    if (dt > 0.05) dt = 0.05; // cap for tab-away

    const sled = state.sled;
    const track = state.track;
    const tp = getTrackPointAt(track, sled.s);
    const curv = tp.curvature;
    const hw = PHYSICS.trackHalfWidth;

    // How close to the wall are we? (0 = center, 1 = at wall)
    const wallProximity = Math.abs(sled.d) / hw;
    // Is the curve pushing us toward the wall we're near?
    const pushingIntoWall = (Math.sign(curv) === Math.sign(sled.d));

    // 1. Centripetal push: curvature * v² pushes sled outward
    let centScale = PHYSICS.centripetalScale;
    if (pushingIntoWall && wallProximity > 0.7) {
        centScale *= 1.0 - (wallProximity - 0.7) / 0.3 * 0.7;
    }
    const centripetalAccel = curv * sled.v * sled.v * centScale;
    sled.omega += centripetalAccel * dt;

    // 2. Player steering — boost when near wall to help recovery
    const steer = steerInput();
    let steerMult = 1.0;
    if (wallProximity > 0.6) {
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
    state.raceTime += dt;

    // 10b. Track top speed
    if (sled.v > state.topSpeed) state.topSpeed = sled.v;

    // 10c. Sector crossing check
    if (state.currentSector < NUM_SECTORS) {
        const sectorBoundary = track.totalLength * ((state.currentSector + 1) / NUM_SECTORS);
        if (sled.s >= sectorBoundary) {
            const sectorTime = state.raceTime - state.sectorStartTime;
            state.sectorTimes.push(sectorTime);

            // Compare to best
            const best = loadBestSectors();
            let color = "#4fc3f7"; // default neutral
            if (best && best[state.currentSector]) {
                const bestT = best[state.currentSector];
                if (sectorTime < bestT) color = "#ab47bc";            // purple — faster
                else if (sectorTime <= bestT * 1.1) color = "#66bb6a"; // green — within 10%
                else color = "#ef5350";                                // red — >10% slower
            }
            state.sectorColors.push(color);

            // Show sector time on minimap
            const el = document.getElementById("sector-time-" + state.currentSector);
            if (el) {
                el.textContent = formatSectorTime(sectorTime);
                el.style.color = color;
                el.style.opacity = "1";
            }

            state.currentSector++;
            state.sectorStartTime = state.raceTime;
        }
    }

    // 11. Finish check
    if (sled.s >= track.totalLength) {
        sled.s = track.totalLength;
        state.finishTime = state.raceTime;
        if (state.sectorTimes.length === NUM_SECTORS) {
            saveBestSectors(state.sectorTimes);
        }
        return true; // signal finish
    }
    return false;
}

function addSparks(tp, d, side) {
    const perp = tp.angle + Math.PI / 2;
    const wx = tp.x + Math.cos(perp) * d;
    const wy = tp.y + Math.sin(perp) * d;
    for (let i = 0; i < 5; i++) {
        state.sled.sparkles.push({
            x: wx + (Math.random() - 0.5) * 0.3,
            y: wy + (Math.random() - 0.5) * 0.3,
            vx: (Math.random() - 0.5) * 3 + Math.cos(perp) * side * 2,
            vy: (Math.random() - 0.5) * 3 + Math.sin(perp) * side * 2,
            life: 0.4 + Math.random() * 0.3,
        });
    }
}

function updateSparks(dt) {
    const sparkles = state.sled.sparkles;
    for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
        if (sp.life <= 0) sparkles.splice(i, 1);
    }
}
