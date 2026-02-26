// ============================================================
//  Input Handling — Keyboard, Gyroscope, Touch
// ============================================================

import { state } from './state.js';
import { TILT_DEAD_ZONE, TILT_MAX_ANGLE } from './constants.js';

export const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
                        ("ontouchstart" in window);

// ---- Keyboard ----

export function setupKeyboardInput() {
    window.addEventListener("keydown", e => { state.keys[e.code] = true; });
    window.addEventListener("keyup", e => { state.keys[e.code] = false; });
}

// ---- Gyroscope / Tilt ----

export function initGyroscope() {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then(s => {
                if (s === "granted") {
                    window.addEventListener("deviceorientation", handleOrientation);
                    state.gyroAvailable = true;
                }
            })
            .catch(console.warn);
    } else if ("DeviceOrientationEvent" in window) {
        window.addEventListener("deviceorientation", handleOrientation);
    }
}

function handleOrientation(e) {
    if (e.gamma === null) return;
    state.gyroAvailable = true;
    let tilt = e.gamma;
    if (Math.abs(tilt) < TILT_DEAD_ZONE) {
        state.tiltValue = 0;
    } else {
        const sign = Math.sign(tilt);
        const adjusted = Math.abs(tilt) - TILT_DEAD_ZONE;
        const maxAdj = TILT_MAX_ANGLE - TILT_DEAD_ZONE;
        state.tiltValue = sign * Math.min(1, adjusted / maxAdj);
    }
}

// ---- Steer Input (combined keyboard + gyro) ----

export function steerInput() {
    let s = 0;
    if (state.keys["ArrowLeft"] || state.keys["KeyA"]) s += 1;
    if (state.keys["ArrowRight"] || state.keys["KeyD"]) s -= 1;
    // Layer gyroscope tilt on top (inverted to match visual direction)
    if (state.gyroAvailable) s -= state.tiltValue;
    return Math.max(-1, Math.min(1, s));
}
