// ============================================================
//  BOBSLED — Main Entry Point
//  Top-down bobsled racing with realistic-ish physics
// ============================================================

import { ALPHABET } from './constants.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { TRACKS } from './tracks.js';
import { setupKeyboardInput, initGyroscope } from './input.js';
import { updatePhysics } from './physics.js';
import { render } from './renderer.js';
import {
    transitionTo,
    buildTrackSelectUI,
    updateCountdown,
    updateResumeCountdown,
    handleNameEntryInput,
} from './ui.js';

// ---- Canvas setup ----
function resizeCanvas() {
    dom.canvas.width = window.innerWidth;
    dom.canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ---- Input setup ----
setupKeyboardInput();

// ---- Pause menu button handlers ----
function handlePauseResume()     { if (state.gameState === "paused") transitionTo("resuming"); }
function handlePauseRestart()    { if (state.gameState === "paused") transitionTo("countdown"); }
function handlePauseLeaderboard(){ if (state.gameState === "paused") transitionTo("pausedLeaderboard"); }
function handlePauseTrackSelect(){
    if (state.gameState === "paused") {
        transitionTo("trackSelect");
        buildTrackSelectUI();
    }
}

dom.pauseResumeBtn.addEventListener("click", handlePauseResume);
dom.pauseRestartBtn.addEventListener("click", handlePauseRestart);
dom.pauseLbBtn.addEventListener("click", handlePauseLeaderboard);
dom.pauseTrackBtn.addEventListener("click", handlePauseTrackSelect);
dom.pauseResumeBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseResume(); });
dom.pauseRestartBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseRestart(); });
dom.pauseLbBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseLeaderboard(); });
dom.pauseTrackBtn.addEventListener("touchend", e => { e.preventDefault(); handlePauseTrackSelect(); });

// ---- Track select GO button ----
document.getElementById("track-go-btn").addEventListener("click", () => {
    if (state.gameState === "trackSelect") transitionTo("countdown");
});
document.getElementById("track-go-btn").addEventListener("touchend", (e) => {
    e.preventDefault();
    if (state.gameState === "trackSelect") transitionTo("countdown");
});

// ================================================================
//  MAIN LOOP
// ================================================================

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - state.lastFrameTime) / 1000, 0.1);
    state.lastFrameTime = timestamp;

    switch (state.gameState) {
        case "countdown":
            updateCountdown(dt);
            render();
            break;
        case "resuming":
            updateResumeCountdown(dt);
            render();
            break;
        case "racing": {
            const finished = updatePhysics(dt);
            if (finished) transitionTo("finish");
            render();
            break;
        }
        case "paused":
        case "pausedLeaderboard":
        case "trackSelect":
        case "title":
        case "finish":
        case "leaderboard":
            render();
            break;
    }

    requestAnimationFrame(gameLoop);
}

// ================================================================
//  GLOBAL KEY HANDLER
// ================================================================

window.addEventListener("keydown", function (e) {
    // Pause / unpause with Escape
    if (e.code === "Escape") {
        e.preventDefault();
        if (state.gameState === "racing") {
            transitionTo("paused");
        } else if (state.gameState === "paused") {
            transitionTo("resuming");
        } else if (state.gameState === "pausedLeaderboard") {
            transitionTo("paused");
        }
        return;
    }

    if (state.gameState === "title" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        transitionTo("trackSelect");
    } else if (state.gameState === "trackSelect") {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
            e.preventDefault();
            state.selectedTrackIdx = (state.selectedTrackIdx - 1 + TRACKS.length) % TRACKS.length;
            buildTrackSelectUI();
        } else if (e.code === "ArrowRight" || e.code === "KeyD") {
            e.preventDefault();
            state.selectedTrackIdx = (state.selectedTrackIdx + 1) % TRACKS.length;
            buildTrackSelectUI();
        } else if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            transitionTo("countdown");
        }
    } else if (state.gameState === "finish") {
        if (!state.nameEntryState.done) {
            handleNameEntryInput(e);
        } else if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            const name = state.nameEntryState.letters.map(i => ALPHABET[i]).join("");
            state.highlightName = name;
            state.highlightTime = state.finishTime;
            transitionTo("leaderboard");
        }
    } else if (state.gameState === "leaderboard" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        transitionTo("trackSelect");
    } else if (state.gameState === "pausedLeaderboard" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        transitionTo("paused");
    }
});

// Prevent space from scrolling
window.addEventListener("keydown", e => {
    if (e.code === "Space") e.preventDefault();
});

// ================================================================
//  TOUCH / TAP HANDLER (mobile)
// ================================================================

function handleTap(e) {
    e.preventDefault();

    if (state.gameState === "title") {
        initGyroscope();
        transitionTo("trackSelect");
    } else if (state.gameState === "trackSelect") {
        // Tap handled by track cards
    } else if (state.gameState === "finish") {
        if (state.nameEntryState.done) {
            const name = state.nameEntryState.letters.map(i => ALPHABET[i]).join("");
            state.highlightName = name;
            state.highlightTime = state.finishTime;
            transitionTo("leaderboard");
        }
    } else if (state.gameState === "leaderboard") {
        initGyroscope();
        transitionTo("trackSelect");
    } else if (state.gameState === "pausedLeaderboard") {
        transitionTo("paused");
    }
}
dom.canvas.addEventListener("touchend", handleTap);

// ================================================================
//  START
// ================================================================

transitionTo("title");
state.lastFrameTime = performance.now();
requestAnimationFrame(gameLoop);
