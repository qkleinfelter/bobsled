// ============================================================
//  Cached DOM Element References
// ============================================================

const c = document.getElementById("gameCanvas");

export const dom = {
    canvas: c,
    ctx: c.getContext("2d"),

    hud: document.getElementById("hud"),
    hudSpeed: document.getElementById("hud-speed"),
    hudTime: document.getElementById("hud-time"),
    hudTrack: document.getElementById("hud-track"),

    progressBar: document.getElementById("track-progress"),
    progressMarker: document.getElementById("progress-marker"),

    titleScreen: document.getElementById("title-screen"),
    countdownScreen: document.getElementById("countdown-screen"),
    countdownText: document.getElementById("countdown"),

    finishScreen: document.getElementById("finish-screen"),
    finalTimeEl: document.getElementById("final-time"),
    finalTopSpeedEl: document.getElementById("final-topspeed"),
    nameEntry: document.getElementById("name-entry"),
    nameLettersEl: document.getElementById("name-letters"),
    finishPrompt: document.getElementById("finish-prompt"),

    leaderboardScreen: document.getElementById("leaderboard-screen"),
    leaderboardBody: document.getElementById("leaderboard-body"),

    pauseScreen: document.getElementById("pause-screen"),
    pauseTimeEl: document.getElementById("pause-time"),
    pauseResumeBtn: document.getElementById("pause-resume"),
    pauseRestartBtn: document.getElementById("pause-restart"),
    pauseLbBtn: document.getElementById("pause-leaderboard"),
    pauseTrackBtn: document.getElementById("pause-trackselect"),
};
