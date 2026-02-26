// ============================================================
//  Shared Mutable Game State
// ============================================================

import { NUM_SECTORS } from './constants.js';

export const state = {
    // Canvas
    canvas: null,
    ctx: null,

    // Game entities
    sled: null,
    track: null,

    // Timing
    raceTime: 0,
    gameState: "title",
    lastFrameTime: 0,
    countdownTimer: 0,
    finishTime: 0,
    topSpeed: 0,

    // Track selection
    selectedTrackIdx: 0,

    // Sectors
    currentSector: 0,
    sectorStartTime: 0,
    sectorTimes: [],
    sectorColors: [],

    // Name entry
    nameEntryState: { letters: [0, 0, 0], cursor: 0, done: false },
    nameKeyDebounce: {},
    highlightName: "",
    highlightTime: 0,

    // Input
    keys: {},
    tiltValue: 0,
    gyroAvailable: false,
};

export function resetSled() {
    state.sled = {
        s: 0, d: 0, v: 0, omega: 0,
        wallHitTimer: 0, wallSide: 0, sparkles: [],
    };
    state.raceTime = 0;
    state.topSpeed = 0;
    state.currentSector = 0;
    state.sectorStartTime = 0;
    state.sectorTimes = [];
    state.sectorColors = [];
    // Reset sector time labels
    for (let i = 0; i < NUM_SECTORS; i++) {
        const el = document.getElementById("sector-time-" + i);
        if (el) { el.textContent = ""; el.style.opacity = "0"; }
    }
}
