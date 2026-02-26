// ============================================================
//  UI — State Machine, Track Select, Name Entry, Countdowns
// ============================================================

import { state, resetSled } from './state.js';
import { dom } from './dom.js';
import { ALPHABET } from './constants.js';
import { TRACKS, generateTrack } from './tracks.js';
import { renderLeaderboard, saveToLeaderboard } from './leaderboard.js';
import { formatTime } from './utils.js';

// ================================================================
//  STATE MACHINE
// ================================================================

export function transitionTo(newState) {
    // Hide all screens
    dom.titleScreen.classList.remove("active");
    dom.countdownScreen.classList.remove("active");
    dom.finishScreen.classList.remove("active");
    dom.leaderboardScreen.classList.remove("active");
    dom.pauseScreen.classList.remove("active");
    const trackSelectScreen = document.getElementById("track-select-screen");
    if (trackSelectScreen) trackSelectScreen.classList.remove("active");
    dom.hud.style.display = "none";
    dom.progressBar.style.display = "none";
    dom.nameEntry.classList.remove("active");
    dom.finishPrompt.style.display = "none";

    state.gameState = newState;

    switch (newState) {
        case "title":
            dom.titleScreen.classList.add("active");
            break;

        case "trackSelect":
            document.getElementById("track-select-screen").classList.add("active");
            buildTrackSelectUI();
            break;

        case "countdown":
            dom.countdownScreen.classList.add("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            state.countdownTimer = 3.0;
            state.track = generateTrack(TRACKS[state.selectedTrackIdx]);
            resetSled();
            break;

        case "racing":
            dom.countdownScreen.classList.remove("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            break;

        case "finish":
            dom.finishScreen.classList.add("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            dom.finalTimeEl.textContent = formatTime(state.finishTime);
            dom.finalTopSpeedEl.textContent = "Top Speed: " + Math.round(state.topSpeed * 2.237) + " mph";
            // Start name entry
            state.nameEntryState = { letters: [0, 0, 0], cursor: 0, done: false };
            buildNameEntryUI();
            dom.nameEntry.classList.add("active");
            break;

        case "leaderboard":
            dom.leaderboardScreen.classList.add("active");
            document.getElementById("leaderboard-prompt").textContent = "TAP OR PRESS SPACE TO SELECT TRACK";
            renderLeaderboard();
            break;

        case "paused":
            dom.pauseScreen.classList.add("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            dom.pauseTimeEl.textContent = formatTime(state.raceTime);
            break;

        case "resuming":
            dom.countdownScreen.classList.add("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            state.countdownTimer = 3.0;
            break;

        case "pausedLeaderboard":
            dom.leaderboardScreen.classList.add("active");
            dom.hud.style.display = "flex";
            dom.progressBar.style.display = "block";
            document.getElementById("leaderboard-prompt").textContent = "PRESS SPACE OR ESC TO GO BACK";
            renderLeaderboard();
            break;
    }
}

// ================================================================
//  TRACK SELECTION UI
// ================================================================

export function buildTrackSelectUI() {
    const container = document.getElementById("track-cards");
    if (!container) return;
    container.innerHTML = "";

    TRACKS.forEach((t, idx) => {
        const card = document.createElement("div");
        card.className = "track-card" + (idx === state.selectedTrackIdx ? " selected" : "");
        card.style.borderColor = t.color;
        if (idx === state.selectedTrackIdx) {
            card.style.boxShadow = `0 0 20px ${t.color}44`;
        }
        card.innerHTML = `
            <div class="track-card-name" style="color:${t.color}">${t.name}</div>
            <div class="track-card-desc">${t.description}</div>
        `;
        card.addEventListener("click", () => {
            state.selectedTrackIdx = idx;
            buildTrackSelectUI();
        });
        card.addEventListener("touchend", (e) => {
            e.stopPropagation();
            state.selectedTrackIdx = idx;
            buildTrackSelectUI();
        });
        container.appendChild(card);
    });

    // Update the go button
    const goBtn = document.getElementById("track-go-btn");
    if (goBtn) {
        goBtn.style.borderColor = TRACKS[state.selectedTrackIdx].color;
        goBtn.style.color = TRACKS[state.selectedTrackIdx].color;
    }
}

// ================================================================
//  COUNTDOWNS
// ================================================================

export function updateCountdown(dt) {
    state.countdownTimer -= dt;
    if (state.countdownTimer <= 0) {
        dom.countdownText.textContent = "GO!";
        setTimeout(() => transitionTo("racing"), 300);
    } else {
        dom.countdownText.textContent = Math.ceil(state.countdownTimer);
    }
}

export function updateResumeCountdown(dt) {
    state.countdownTimer -= dt;
    if (state.countdownTimer <= 0) {
        dom.countdownText.textContent = "GO!";
        setTimeout(() => transitionTo("racing"), 300);
    } else {
        dom.countdownText.textContent = Math.ceil(state.countdownTimer);
    }
}

// ================================================================
//  NAME ENTRY (Arcade style)
// ================================================================

export function buildNameEntryUI() {
    dom.nameLettersEl.innerHTML = "";
    for (let i = 0; i < 3; i++) {
        const slot = document.createElement("div");
        slot.className = "letter-slot" + (i === state.nameEntryState.cursor ? " active" : "");
        slot.id = "letter-" + i;

        const up = document.createElement("div");
        up.className = "arrow up";
        up.textContent = "▲";
        slot.appendChild(up);

        const letter = document.createElement("span");
        letter.textContent = ALPHABET[state.nameEntryState.letters[i]];
        letter.className = "char";
        slot.appendChild(letter);

        const down = document.createElement("div");
        down.className = "arrow down";
        down.textContent = "▼";
        slot.appendChild(down);

        dom.nameLettersEl.appendChild(slot);
    }
    attachNameEntryTouch();
    attachConfirmButton();
}

export function updateNameEntryUI() {
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById("letter-" + i);
        if (!slot) continue;
        slot.className = "letter-slot" + (i === state.nameEntryState.cursor ? " active" : "");
        slot.querySelector(".char").textContent = ALPHABET[state.nameEntryState.letters[i]];
    }
}

export function handleNameEntryInput(e) {
    if (state.nameEntryState.done) return;
    const now = performance.now();
    if (state.nameKeyDebounce[e.code] && now - state.nameKeyDebounce[e.code] < 150) return;
    state.nameKeyDebounce[e.code] = now;

    const cur = state.nameEntryState.cursor;

    if (e.code === "ArrowUp" || e.code === "KeyW") {
        state.nameEntryState.letters[cur] = (state.nameEntryState.letters[cur] - 1 + ALPHABET.length) % ALPHABET.length;
        updateNameEntryUI();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        state.nameEntryState.letters[cur] = (state.nameEntryState.letters[cur] + 1) % ALPHABET.length;
        updateNameEntryUI();
    } else if (e.code === "ArrowRight" || e.code === "Tab") {
        e.preventDefault();
        if (cur < 2) {
            state.nameEntryState.cursor++;
            updateNameEntryUI();
        }
    } else if (e.code === "ArrowLeft") {
        if (cur > 0) {
            state.nameEntryState.cursor--;
            updateNameEntryUI();
        }
    } else if (e.code === "Enter" || e.code === "Space") {
        if (cur < 2) {
            state.nameEntryState.cursor++;
            updateNameEntryUI();
        } else {
            // Confirm name
            state.nameEntryState.done = true;
            const name = state.nameEntryState.letters.map(i => ALPHABET[i]).join("");
            saveToLeaderboard(name, state.finishTime, state.topSpeed);
            dom.nameEntry.classList.remove("active");
            dom.finishPrompt.style.display = "block";
        }
    }
}

// ---- Touch-based name entry ----

export function attachNameEntryTouch() {
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById("letter-" + i);
        if (!slot) continue;
        slot.addEventListener("touchend", function (e) {
            e.stopPropagation();
            state.nameEntryState.cursor = i;
            updateNameEntryUI();
        });
        const upArrow = slot.querySelector(".arrow.up");
        if (upArrow) {
            upArrow.addEventListener("touchend", function (e) {
                e.stopPropagation();
                state.nameEntryState.cursor = i;
                state.nameEntryState.letters[i] = (state.nameEntryState.letters[i] - 1 + ALPHABET.length) % ALPHABET.length;
                updateNameEntryUI();
            });
        }
        const downArrow = slot.querySelector(".arrow.down");
        if (downArrow) {
            downArrow.addEventListener("touchend", function (e) {
                e.stopPropagation();
                state.nameEntryState.cursor = i;
                state.nameEntryState.letters[i] = (state.nameEntryState.letters[i] + 1) % ALPHABET.length;
                updateNameEntryUI();
            });
        }
    }
}

export function attachConfirmButton() {
    const confirmBtn = document.getElementById("name-confirm-btn");
    if (confirmBtn) {
        confirmBtn.addEventListener("touchend", function (e) {
            e.stopPropagation();
            if (!state.nameEntryState.done) {
                state.nameEntryState.done = true;
                const name = state.nameEntryState.letters.map(i => ALPHABET[i]).join("");
                saveToLeaderboard(name, state.finishTime, state.topSpeed);
                dom.nameEntry.classList.remove("active");
                dom.finishPrompt.style.display = "block";
            }
        });
        confirmBtn.addEventListener("click", function () {
            if (!state.nameEntryState.done) {
                state.nameEntryState.done = true;
                const name = state.nameEntryState.letters.map(i => ALPHABET[i]).join("");
                saveToLeaderboard(name, state.finishTime, state.topSpeed);
                dom.nameEntry.classList.remove("active");
                dom.finishPrompt.style.display = "block";
            }
        });
    }
}
