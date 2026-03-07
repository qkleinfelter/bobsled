// ============================================================
//  Track Definitions & Generation
// ============================================================

import { angleDiff } from "./utils.js";

// ---- Track Definitions ----
export const TRACKS = [
  {
    id: "alpine",
    name: "ALPINE PASS",
    description: "Gentle curves — perfect for beginners",
    color: "#4fc3f7",
    segments: [
      { len: 50, curv: 0 },
      { len: 35, curv: 0.03 },
      { len: 25, curv: 0 },
      { len: 40, curv: -0.04 },
      { len: 20, curv: 0 },
      { len: 30, curv: 0.05 },
      { len: 20, curv: -0.03 },
      { len: 25, curv: 0 },
      { len: 35, curv: -0.05 },
      { len: 20, curv: 0 },
      { len: 30, curv: 0.04 },
      { len: 20, curv: 0 },
      { len: 35, curv: -0.04 },
      { len: 25, curv: 0.03 },
      { len: 15, curv: 0 },
      { len: 30, curv: -0.03 },
      { len: 60, curv: 0 },
    ],
  },
  {
    id: "glacier",
    name: "GLACIER RUN",
    description: "Technical turns and S-curves",
    color: "#ffcc80",
    segments: [
      { len: 40, curv: 0 },
      { len: 30, curv: 0.04 },
      { len: 20, curv: 0 },
      { len: 40, curv: -0.06 },
      { len: 15, curv: 0 },
      { len: 35, curv: 0.07 },
      { len: 25, curv: -0.03 },
      { len: 20, curv: 0 },
      { len: 50, curv: -0.08 },
      { len: 15, curv: 0 },
      { len: 30, curv: 0.05 },
      { len: 20, curv: 0.09 },
      { len: 25, curv: -0.04 },
      { len: 10, curv: 0 },
      { len: 35, curv: -0.07 },
      { len: 30, curv: 0.06 },
      { len: 18, curv: 0 },
      { len: 45, curv: -0.05 },
      { len: 20, curv: 0.04 },
      { len: 12, curv: 0 },
      { len: 35, curv: 0.08 },
      { len: 25, curv: -0.06 },
      { len: 20, curv: 0 },
      { len: 40, curv: -0.09 },
      { len: 15, curv: 0 },
      { len: 30, curv: 0.03 },
      { len: 50, curv: 0 },
    ],
  },
  {
    id: "inferno",
    name: "INFERNO",
    description: "Hairpins and high speed — experts only",
    color: "#ef5350",
    segments: [
      { len: 30, curv: 0 },
      { len: 25, curv: 0.06 },
      { len: 10, curv: 0 },
      { len: 35, curv: -0.1 },
      { len: 30, curv: 0.08 },
      { len: 12, curv: 0 },
      { len: 20, curv: -0.12 },
      { len: 15, curv: 0.05 },
      { len: 40, curv: -0.07 },
      { len: 8, curv: 0 },
      { len: 25, curv: 0.11 },
      { len: 20, curv: -0.09 },
      { len: 15, curv: 0.1 },
      { len: 10, curv: 0 },
      { len: 30, curv: -0.13 },
      { len: 18, curv: 0 },
      { len: 25, curv: 0.09 },
      { len: 35, curv: -0.08 },
      { len: 20, curv: 0.12 },
      { len: 8, curv: 0 },
      { len: 30, curv: -0.11 },
      { len: 15, curv: 0.06 },
      { len: 10, curv: 0 },
      { len: 25, curv: -0.1 },
      { len: 20, curv: 0.07 },
      { len: 35, curv: -0.14 },
      { len: 15, curv: 0 },
      { len: 20, curv: 0.05 },
      { len: 40, curv: 0 },
    ],
  },
  {
    id: "infinite",
    name: "INFINITE",
    description: "Endless run — dodge the walls or die",
    color: "#ab47bc",
    segments: null,
  },
];

// ---- Track Generation ----

export function generateTrack(trackDef) {
  const segments = trackDef.segments;
  const step = 0.5; // meters per point
  const points = [];
  let x = 0,
    y = 0,
    angle = Math.PI / 2;
  let dist = 0;

  for (const seg of segments) {
    const nSteps = Math.ceil(seg.len / step);
    const actualStep = seg.len / nSteps;
    for (let i = 0; i < nSteps; i++) {
      const curv = seg.curv;
      points.push({ x, y, angle, curvature: curv, dist });
      angle += curv * actualStep;
      x += Math.cos(angle) * actualStep;
      y += Math.sin(angle) * actualStep;
      dist += actualStep;
    }
  }
  points.push({ x, y, angle, curvature: 0, dist });

  const smoothed = smoothCurvatures(points, 12);
  return { points: smoothed, totalLength: dist };
}

function smoothCurvatures(points, radius) {
  const out = points.map((p) => ({ ...p }));
  for (let i = 0; i < points.length; i++) {
    let sum = 0,
      weight = 0;
    for (let j = -radius; j <= radius; j++) {
      const idx = Math.max(0, Math.min(points.length - 1, i + j));
      const w = Math.exp(-0.5 * (j / (radius * 0.4)) ** 2);
      sum += points[idx].curvature * w;
      weight += w;
    }
    out[i].curvature = sum / weight;
  }
  return out;
}

// ---- Track Point Lookup ----

export function getTrackPointAt(track, s) {
  s = Math.max(0, Math.min(track.totalLength, s));
  let lo = 0,
    hi = track.points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track.points[mid].dist <= s) lo = mid;
    else hi = mid;
  }
  const p0 = track.points[lo];
  const p1 = track.points[hi];
  const segLen = p1.dist - p0.dist;
  const t = segLen > 0 ? (s - p0.dist) / segLen : 0;
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    angle: p0.angle + angleDiff(p0.angle, p1.angle) * t,
    curvature: p0.curvature + (p1.curvature - p0.curvature) * t,
  };
}

export function findPointIndex(track, s) {
  s = Math.max(0, Math.min(track.totalLength, s));
  let lo = 0,
    hi = track.points.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track.points[mid].dist <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ---- Infinite Track Generation ----

export function generateInfiniteTrack() {
  const step = 0.5;
  const points = [];
  let x = 0,
    y = 0,
    angle = Math.PI / 2;
  let dist = 0;

  // Starting straight
  const initLen = 50;
  const nSteps = Math.ceil(initLen / step);
  for (let i = 0; i < nSteps; i++) {
    points.push({ x, y, angle, curvature: 0, dist });
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    dist += step;
  }
  points.push({ x, y, angle, curvature: 0, dist });

  const smoothed = smoothCurvatures(points, 12);
  const track = {
    points: smoothed,
    totalLength: dist,
    infinite: true,
    _gen: { x, y, angle },
  };

  extendInfiniteTrack(track, 500);
  return track;
}

export function extendInfiniteTrack(track, additionalDist) {
  if (!additionalDist) additionalDist = 200;
  const step = 0.5;
  let { x, y, angle } = track._gen;
  let dist = track.totalLength;
  const targetDist = dist + additionalDist;
  const prevPointCount = track.points.length;

  while (dist < targetDist) {
    // Difficulty ramps based on total distance
    const difficulty = Math.min(2.5, dist / 800);

    // Straight section (shorter as difficulty increases)
    const straightLen =
      Math.max(5, 18 - difficulty * 4) +
      Math.random() * Math.max(3, 12 - difficulty * 3);
    const sSteps = Math.ceil(straightLen / step);
    for (let i = 0; i < sSteps && dist < targetDist + 50; i++) {
      track.points.push({ x, y, angle, curvature: 0, dist });
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      dist += step;
    }

    // Curve section
    const maxCurv = 0.03 + difficulty * 0.05;
    const curvMag = 0.02 + Math.random() * maxCurv;
    const curv = (Math.random() < 0.5 ? -1 : 1) * curvMag;
    const curveLen = 15 + Math.random() * (25 + difficulty * 8);
    const cSteps = Math.ceil(curveLen / step);
    const cStep = curveLen / cSteps;
    for (let i = 0; i < cSteps && dist < targetDist + 50; i++) {
      track.points.push({ x, y, angle, curvature: curv, dist });
      angle += curv * cStep;
      x += Math.cos(angle) * cStep;
      y += Math.sin(angle) * cStep;
      dist += cStep;
    }

    // Occasional S-curve at higher difficulties
    if (difficulty > 0.8 && Math.random() < 0.3) {
      const sCurv = -curv * (0.7 + Math.random() * 0.6);
      const sLen = 10 + Math.random() * 15;
      const ssSteps = Math.ceil(sLen / step);
      const ssStep = sLen / ssSteps;
      for (let i = 0; i < ssSteps && dist < targetDist + 50; i++) {
        track.points.push({ x, y, angle, curvature: sCurv, dist });
        angle += sCurv * ssStep;
        x += Math.cos(angle) * ssStep;
        y += Math.sin(angle) * ssStep;
        dist += ssStep;
      }
    }
  }

  track.points.push({ x, y, angle, curvature: 0, dist });
  track.totalLength = dist;
  track._gen = { x, y, angle };

  // Smooth newly added section + transition zone
  const smoothRadius = 12;
  const smoothStart = Math.max(0, prevPointCount - smoothRadius);
  smoothCurvaturesRegion(
    track.points,
    smoothRadius,
    smoothStart,
    track.points.length,
  );
}

function smoothCurvaturesRegion(points, radius, fromIdx, toIdx) {
  const readStart = Math.max(0, fromIdx - radius);
  const readEnd = Math.min(points.length, toIdx + radius);
  const snap = new Array(readEnd - readStart);
  for (let i = readStart; i < readEnd; i++) {
    snap[i - readStart] = points[i].curvature;
  }
  for (let i = fromIdx; i < toIdx && i < points.length; i++) {
    let sum = 0,
      weight = 0;
    for (let j = -radius; j <= radius; j++) {
      const idx = Math.max(0, Math.min(points.length - 1, i + j));
      const w = Math.exp(-0.5 * (j / (radius * 0.4)) ** 2);
      const snapIdx = idx - readStart;
      const curv =
        snapIdx >= 0 && snapIdx < snap.length
          ? snap[snapIdx]
          : points[idx].curvature;
      sum += curv * w;
      weight += w;
    }
    points[i].curvature = sum / weight;
  }
}
