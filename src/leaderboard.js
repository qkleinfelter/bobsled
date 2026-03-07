// ============================================================
//  Leaderboard — Load / Save / Render (Local + Global)
// ============================================================

import { fetchGlobalLeaderboard, submitGlobalScore } from "./api.js";
import { LB_KEY_PREFIX } from "./constants.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { TRACKS } from "./tracks.js";
import { formatTime } from "./utils.js";

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

export function saveToLeaderboard(name, time, maxSpeed, distance) {
  // Save locally
  const lb = loadLeaderboard();
  const entry = { name, time, topSpeed: maxSpeed };
  if (state.infiniteMode) entry.distance = distance;
  lb.push(entry);

  if (state.infiniteMode) {
    lb.sort((a, b) => (b.distance || 0) - (a.distance || 0));
  } else {
    lb.sort((a, b) => a.time - b.time);
  }
  if (lb.length > 10) lb.length = 10;
  localStorage.setItem(lbKey(), JSON.stringify(lb));

  // Submit to global leaderboard (fire-and-forget)
  const trackId = TRACKS[state.selectedTrackIdx].id;
  submitGlobalScore(trackId, name, time, maxSpeed, distance).catch(() => {});
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

  // Update table headers for mode
  const thead = document.querySelector("#leaderboard-table thead tr");
  if (thead) {
    if (state.infiniteMode) {
      thead.innerHTML = `<th>#</th><th>NAME</th><th>DISTANCE</th><th>TIME</th><th>TOP SPEED</th>`;
    } else {
      thead.innerHTML = `<th>#</th><th>NAME</th><th>TIME</th><th>TOP SPEED</th>`;
    }
  }

  if (entries.length === 0) {
    const colspan = state.infiniteMode ? 5 : 4;
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="${colspan}" style="color:#546e7a;">No times yet</td>`;
    dom.leaderboardBody.appendChild(row);
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = document.createElement("tr");

    if (state.infiniteMode) {
      if (
        entry.name === state.highlightName &&
        Math.abs((entry.distance || 0) - state.highlightDistance) < 1
      ) {
        row.className = "highlight";
      }
    } else {
      if (
        entry.name === state.highlightName &&
        Math.abs(entry.time - state.highlightTime) < 0.01
      ) {
        row.className = "highlight";
      }
    }

    const spd = entry.topSpeed ? Math.round(entry.topSpeed * 2.23694) : "--";

    if (state.infiniteMode) {
      const dist = entry.distance
        ? Math.floor(entry.distance).toLocaleString("en-US") + " m"
        : "--";
      row.innerHTML = `
                <td class="rank">${i + 1}</td>
                <td>${entry.name}</td>
                <td>${dist}</td>
                <td>${formatTime(entry.time)}</td>
                <td>${spd} mph</td>
            `;
    } else {
      row.innerHTML = `
                <td class="rank">${i + 1}</td>
                <td>${entry.name}</td>
                <td>${formatTime(entry.time)}</td>
                <td>${spd} mph</td>
            `;
    }
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
    fetchGlobalLeaderboard(trackId).then((entries) => {
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
