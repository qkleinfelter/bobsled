// ============================================================
//  Sector Timing — localStorage helpers
// ============================================================

import { SECTOR_KEY_PREFIX } from './constants.js';
import { state } from './state.js';
import { TRACKS } from './tracks.js';

export function sectorKey() {
    return SECTOR_KEY_PREFIX + TRACKS[state.selectedTrackIdx].id;
}

export function loadBestSectors() {
    try {
        const raw = localStorage.getItem(sectorKey());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function saveBestSectors(times) {
    const prev = loadBestSectors();
    const best = prev ? prev.map((b, i) => Math.min(b, times[i])) : [...times];
    localStorage.setItem(sectorKey(), JSON.stringify(best));
}
