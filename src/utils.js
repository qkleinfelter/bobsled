// ============================================================
//  Utility Functions
// ============================================================

export function formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return mins + ":" + String(secs).padStart(2, "0") + "." + String(ms).padStart(3, "0");
}

export function formatSectorTime(t) {
    const secs = Math.floor(t);
    const ms = Math.floor((t % 1) * 100);
    return secs + "." + String(ms).padStart(2, "0");
}

export function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}
