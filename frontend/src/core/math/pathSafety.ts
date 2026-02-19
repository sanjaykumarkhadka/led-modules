import { pathBBoxFromPathData } from './shapeWarp';

export type PathEditRejectReason =
  | 'self_intersection'
  | 'curvature_spike'
  | 'bbox_escape'
  | 'degenerate_segment';

export interface PathEditValidationResult {
  ok: boolean;
  reason?: PathEditRejectReason;
  metrics?: {
    candidateLength?: number;
    previousLength?: number;
    maxSegment?: number;
    previousMedianSegment?: number;
  };
}

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isFinitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samplePathPoints(pathData: string): Point[] {
  if (typeof document === 'undefined' || !pathData) return [];
  const svgNS = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathData);
  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    return [];
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0) return [];
  const samples = clamp(Math.ceil(totalLength / 8), 32, 320);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const at = (i / samples) * totalLength;
    const p = path.getPointAtLength(at);
    const next = { x: p.x, y: p.y };
    if (!isFinitePoint(next)) continue;
    const prev = points[points.length - 1];
    if (prev && Math.hypot(prev.x - next.x, prev.y - next.y) < 1e-5) continue;
    points.push(next);
  }
  return points;
}

function polylineSegments(points: Point[]) {
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ a: points[i], b: points[i + 1] });
  }
  return segments;
}

function segmentLength(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orientation(a: Point, b: Point, c: Point) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point) {
  return (
    b.x <= Math.max(a.x, c.x) + 1e-9 &&
    b.x + 1e-9 >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + 1e-9 &&
    b.y + 1e-9 >= Math.min(a.y, c.y)
  );
}

function intersects(a1: Point, a2: Point, b1: Point, b2: Point) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function hasSelfIntersection(points: Point[]) {
  const segments = polylineSegments(points);
  for (let i = 0; i < segments.length; i += 1) {
    const s1 = segments[i];
    for (let j = i + 2; j < segments.length; j += 1) {
      // Neighbor segments share endpoints; ignore.
      if (j === i + 1) continue;
      // Ignore first/last pair in closed-ish traces.
      if (i === 0 && j === segments.length - 1) continue;
      const s2 = segments[j];
      if (intersects(s1.a, s1.b, s2.a, s2.b)) return true;
    }
  }
  return false;
}

function stats(points: Point[]) {
  if (points.length < 2) {
    return { total: 0, maxSeg: 0, medianSeg: 0 };
  }
  const lengths: number[] = [];
  let total = 0;
  let maxSeg = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const len = segmentLength(points[i], points[i + 1]);
    lengths.push(len);
    total += len;
    maxSeg = Math.max(maxSeg, len);
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  const medianSeg = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return { total, maxSeg, medianSeg };
}

function escapesBounds(candidate: Bounds, base: Bounds) {
  const diagonal = Math.hypot(base.width, base.height);
  const epsilon = Math.max(0.5, diagonal * 0.01);
  const minX = base.x - epsilon;
  const minY = base.y - epsilon;
  const maxX = base.x + base.width + epsilon;
  const maxY = base.y + base.height + epsilon;
  return (
    candidate.x < minX ||
    candidate.y < minY ||
    candidate.x + candidate.width > maxX ||
    candidate.y + candidate.height > maxY
  );
}

export function validatePathEdit(
  previousPath: string,
  candidatePath: string,
  baseBBox?: Bounds
): PathEditValidationResult {
  if (!candidatePath.trim()) return { ok: false, reason: 'degenerate_segment' };
  const candidateBBox = pathBBoxFromPathData(candidatePath) ?? baseBBox;
  if (!candidateBBox) return { ok: false, reason: 'degenerate_segment' };
  if (
    !Number.isFinite(candidateBBox.width) ||
    !Number.isFinite(candidateBBox.height) ||
    candidateBBox.width < 1e-3 ||
    candidateBBox.height < 1e-3
  ) {
    return { ok: false, reason: 'degenerate_segment' };
  }
  if (baseBBox && escapesBounds(candidateBBox, baseBBox)) {
    return { ok: false, reason: 'bbox_escape' };
  }

  const candidatePoints = samplePathPoints(candidatePath);
  if (candidatePoints.length < 4) {
    return { ok: false, reason: 'degenerate_segment' };
  }
  if (hasSelfIntersection(candidatePoints)) {
    return { ok: false, reason: 'self_intersection' };
  }

  const previousPoints = samplePathPoints(previousPath);
  const candidateStats = stats(candidatePoints);
  const previousStats = stats(previousPoints.length > 1 ? previousPoints : candidatePoints);
  const baseDiagonal = Math.hypot(candidateBBox.width, candidateBBox.height);

  if (
    previousStats.total > 0 &&
    candidateStats.total > previousStats.total * 2.25
  ) {
    return {
      ok: false,
      reason: 'curvature_spike',
      metrics: {
        candidateLength: candidateStats.total,
        previousLength: previousStats.total,
        maxSegment: candidateStats.maxSeg,
        previousMedianSegment: previousStats.medianSeg,
      },
    };
  }

  const segmentThreshold = Math.max(previousStats.medianSeg * 8, baseDiagonal * 1.25);
  if (candidateStats.maxSeg > segmentThreshold) {
    return {
      ok: false,
      reason: 'curvature_spike',
      metrics: {
        candidateLength: candidateStats.total,
        previousLength: previousStats.total,
        maxSegment: candidateStats.maxSeg,
        previousMedianSegment: previousStats.medianSeg,
      },
    };
  }

  return {
    ok: true,
    metrics: {
      candidateLength: candidateStats.total,
      previousLength: previousStats.total,
      maxSegment: candidateStats.maxSeg,
      previousMedianSegment: previousStats.medianSeg,
    },
  };
}
