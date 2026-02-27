// ============================================================
//  Leaderboard — Load / Save / Render (Local + Global)
// ============================================================

import { LB_KEY_PREFIX } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { TRACKS } from './tracks.js';
import { formatTime } from './utils.js';
import { fetchGlobalLeaderboard, submitGlobalScore } from './api.js';

// "local" or "global"
let activeTab = "global";

export function lbKey() {
    return LB_KEY_PREFIX + TRACKS[state.selectedTrackIdx].id;
}

// ---- Local storage ----

export function loadLeaderboard() {
    try {
        const data = localStorage.getItem(lbKey());
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveToLeaderboard(name, time, maxSpeed) {
    // Save locally
    const lb = loadLeaderboard();
    lb.push({ name, time, topSpeed: maxSpeed });
    lb.sort((a, b) => a.time - b.time);
    if (lb.length > 10) lb.length = 10;
    localStorage.setItem(lbKey(), JSON.stringify(lb));

    // Submit to global leaderboard (fire-and-forget)
    const trackId = TRACKS[state.selectedTrackIdx].id;
    submitGlobalScore(trackId, name, time, maxSpeed).catch(() => {});
}

// ---- Tab switching ----

export function setLeaderboardTab(tab) {
    activeTab = tab;
    const localBtn = document.getElementById("lb-tab-local");
    const globalBtn = document.getElementById("lb-tab-global");
    if (localBtn) localBtn.classList.toggle("active", tab === "local");
    if (globalBtn) globalBtn.classList.toggle("active", tab === "global");
    renderLeaderboard();
}

// ---- Rendering ----

function renderEntries(entries) {
    dom.leaderboardBody.innerHTML = "";

    if (entries.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="4" style="color:#546e7a;">No times yet</td>`;
        dom.leaderboardBody.appendChild(row);
        return;
    }

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
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

export function renderLeaderboard() {
    // Update track name in header
    const lbTitle = document.getElementById("leaderboard-title");
    if (lbTitle) lbTitle.textContent = TRACKS[state.selectedTrackIdx].name;

    if (activeTab === "global") {
        // Show loading state
        dom.leaderboardBody.innerHTML = `<tr><td colspan="4" style="color:#546e7a;">Loading…</td></tr>`;
        const trackId = TRACKS[state.selectedTrackIdx].id;
        fetchGlobalLeaderboard(trackId).then(entries => {
            if (entries.length === 0) {
                // Fallback: show local if global is empty / unavailable
                renderEntries(loadLeaderboard());
            } else {
                renderEntries(entries);
            }
        });
    } else {
        renderEntries(loadLeaderboard());
    }
}
