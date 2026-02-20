import { extractContours, sampleContourPoints } from './pathContours';
import { pathBBoxFromPathData } from './shapeWarp';

export type PathEditRejectReason =
  | 'self_intersection'
  | 'curvature_spike'
  | 'bbox_escape'
  | 'degenerate_segment';

export type PathValidationSeverity = 'ok' | 'warn' | 'error';

export interface PathEditValidationResult {
  ok: boolean;
  severity: PathValidationSeverity;
  reason?: PathEditRejectReason;
  metrics?: {
    candidateLength?: number;
    previousLength?: number;
    maxSegment?: number;
    previousMedianSegment?: number;
    contourCount?: number;
  };
}

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

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

function polylineSegments(points: Point[], closed: boolean) {
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ a: points[i], b: points[i + 1] });
  }
  if (closed && points.length > 2) {
    segments.push({ a: points[points.length - 1], b: points[0] });
  }
  return segments;
}

function hasSelfIntersection(points: Point[], closed: boolean) {
  const segments = polylineSegments(points, closed);
  for (let i = 0; i < segments.length; i += 1) {
    const s1 = segments[i];
    for (let j = i + 1; j < segments.length; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (closed && i === 0 && j === segments.length - 1) continue;
      const s2 = segments[j];
      if (intersects(s1.a, s1.b, s2.a, s2.b)) return true;
    }
  }
  return false;
}

function stats(points: Point[], closed: boolean) {
  if (points.length < 2) {
    return { total: 0, maxSeg: 0, medianSeg: 0 };
  }
  const segments = polylineSegments(points, closed);
  const lengths: number[] = [];
  let total = 0;
  let maxSeg = 0;
  for (const segment of segments) {
    const len = segmentLength(segment.a, segment.b);
    lengths.push(len);
    total += len;
    maxSeg = Math.max(maxSeg, len);
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  return { total, maxSeg, medianSeg: sorted[Math.floor(sorted.length / 2)] ?? 0 };
}

function escapesBounds(candidate: Bounds, base: Bounds) {
  const diagonal = Math.hypot(base.width, base.height);
  const epsilon = Math.max(3, diagonal * 0.06);
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

function severityResult(
  severity: PathValidationSeverity,
  reason?: PathEditRejectReason,
  metrics?: PathEditValidationResult['metrics']
): PathEditValidationResult {
  return { ok: severity !== 'error', severity, reason, metrics };
}

export function validatePathEdit(
  previousPath: string,
  candidatePath: string,
  baseBBox?: Bounds,
  options?: { strict?: boolean }
): PathEditValidationResult {
  const strict = Boolean(options?.strict);
  if (!candidatePath.trim()) return severityResult('error', 'degenerate_segment');
  const candidateBBox = pathBBoxFromPathData(candidatePath) ?? baseBBox;
  if (!candidateBBox) return severityResult('error', 'degenerate_segment');
  if (
    !Number.isFinite(candidateBBox.width) ||
    !Number.isFinite(candidateBBox.height) ||
    candidateBBox.width < 1e-3 ||
    candidateBBox.height < 1e-3
  ) {
    return severityResult('error', 'degenerate_segment');
  }
  if (baseBBox && escapesBounds(candidateBBox, baseBBox)) {
    return severityResult(strict ? 'error' : 'warn', 'bbox_escape');
  }

  const candidateContours = extractContours(candidatePath);
  if (candidateContours.length === 0) {
    return severityResult('error', 'degenerate_segment');
  }
  const previousContours = extractContours(previousPath);

  let candidateTotal = 0;
  let previousTotal = 0;
  let candidateMaxSeg = 0;
  let previousMedianSeg = 0;
  const baseDiagonal = Math.hypot(candidateBBox.width, candidateBBox.height);

  for (let i = 0; i < candidateContours.length; i += 1) {
    const contour = candidateContours[i];
    const sampled = sampleContourPoints(contour);
    if (sampled.length < 3) return severityResult('error', 'degenerate_segment');
    if (hasSelfIntersection(sampled, contour.closed)) {
      return severityResult(strict ? 'error' : 'warn', 'self_intersection', {
        contourCount: candidateContours.length,
      });
    }
    const contourStats = stats(sampled, contour.closed);
    candidateTotal += contourStats.total;
    candidateMaxSeg = Math.max(candidateMaxSeg, contourStats.maxSeg);

    const prevContour = previousContours[i];
    if (prevContour) {
      const prevStats = stats(sampleContourPoints(prevContour), prevContour.closed);
      previousTotal += prevStats.total;
      previousMedianSeg = Math.max(previousMedianSeg, prevStats.medianSeg);
    }
  }

  if (previousTotal > 0 && candidateTotal > previousTotal * 3.5) {
    return severityResult(strict ? 'error' : 'warn', 'curvature_spike', {
      candidateLength: candidateTotal,
      previousLength: previousTotal,
      maxSegment: candidateMaxSeg,
      previousMedianSegment: previousMedianSeg,
      contourCount: candidateContours.length,
    });
  }

  const segmentThreshold = Math.max(previousMedianSeg * 14, baseDiagonal * 2.2);
  if (candidateMaxSeg > segmentThreshold) {
    const ratio = segmentThreshold > 0 ? candidateMaxSeg / segmentThreshold : 0;
    return severityResult(ratio > 2.5 || strict ? 'error' : 'warn', 'curvature_spike', {
      candidateLength: candidateTotal,
      previousLength: previousTotal,
      maxSegment: candidateMaxSeg,
      previousMedianSegment: previousMedianSeg,
      contourCount: candidateContours.length,
    });
  }

  return severityResult('ok', undefined, {
    candidateLength: candidateTotal,
    previousLength: previousTotal,
    maxSegment: candidateMaxSeg,
    previousMedianSegment: previousMedianSeg,
    contourCount: candidateContours.length,
  });
}
