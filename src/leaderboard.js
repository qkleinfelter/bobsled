// ============================================================
//  Leaderboard — Load / Save / Render
// ============================================================

import { LB_KEY_PREFIX } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { TRACKS } from './tracks.js';
import { formatTime } from './utils.js';

export function lbKey() {
    return LB_KEY_PREFIX + TRACKS[state.selectedTrackIdx].id;
}

export function loadLeaderboard() {
    try {
        const data = localStorage.getItem(lbKey());
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveToLeaderboard(name, time, maxSpeed) {
    const lb = loadLeaderboard();
    lb.push({ name, time, topSpeed: maxSpeed });
    lb.sort((a, b) => a.time - b.time);
    if (lb.length > 10) lb.length = 10;
    localStorage.setItem(lbKey(), JSON.stringify(lb));
}

export function renderLeaderboard() {
    const lb = loadLeaderboard();
    dom.leaderboardBody.innerHTML = "";

    // Update track name in header
    const lbTitle = document.getElementById("leaderboard-title");
    if (lbTitle) lbTitle.textContent = TRACKS[state.selectedTrackIdx].name;

    if (lb.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="4" style="color:#546e7a;">No times yet</td>`;
        dom.leaderboardBody.appendChild(row);
        return;
    }

    for (let i = 0; i < lb.length; i++) {
        const entry = lb[i];
        const row = document.createElement("tr");
        if (entry.name === state.highlightName && Math.abs(entry.time - state.highlightTime) < 0.01) {
            row.className = "highlight";
        }
        const spd = entry.topSpeed ? Math.round(entry.topSpeed * 2.23694) : "--";
        row.innerHTML = `
            <td class="rank">${i + 1}</td>
            <td>${entry.name}</td>
            <td>${formatTime(entry.time)}</td>
            <td>${spd} mph</td>
        `;
        dom.leaderboardBody.appendChild(row);
    }
}
