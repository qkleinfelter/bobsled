// ============================================================
//  Constants & Tuning
// ============================================================

export const PHYSICS = {
    gravity: 3.2,           // m/s² downhill acceleration
    airDrag: 0.0008,        // drag coefficient (v²)
    iceFriction: 0.015,     // base friction
    wallSpeedPenalty: 0.09,  // fraction of speed lost on wall hit
    wallBounce: 0.4,        // lateral velocity reversal factor
    steerForce: 14.0,       // lateral acceleration from steering m/s²
    lateralDamping: 5.5,    // damping rate on lateral velocity
    trackHalfWidth: 2.9,    // meters from center to wall
    centripetalScale: 0.85, // how much curvature pushes sled outward
    optimalLineFactor: 0.04, // extra friction for bad line
};

export const TRACK_VISUAL = {
    metersToPx: 30,          // pixels per meter when rendering
};

export const NUM_SECTORS = 3;
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
export const LB_KEY_PREFIX = "bobsled_lb_";
export const SECTOR_KEY_PREFIX = "bobsled_sectors_";
export const TILT_DEAD_ZONE = 3;    // degrees of tilt ignored
export const TILT_MAX_ANGLE = 25;   // degrees for full steer
