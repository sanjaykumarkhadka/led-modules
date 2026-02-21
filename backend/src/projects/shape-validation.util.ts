type PathRejectCode =
  | 'SHAPE_INVALID_DEGENERATE'
  | 'SHAPE_INVALID_SELF_INTERSECTION'
  | 'SHAPE_INVALID_BBOX_ESCAPE'
  | 'SHAPE_INVALID_CURVATURE_SPIKE';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Contour {
  points: Point[];
  closed: boolean;
}

interface ValidationResult {
  ok: boolean;
  code?: PathRejectCode;
  message?: string;
}

const TOKEN_RE = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;
const CURVE_SAMPLE_STEPS = 12;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleQuadraticBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  steps = CURVE_SAMPLE_STEPS,
): Point[] {
  const points: Point[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return points;
}

function sampleCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = CURVE_SAMPLE_STEPS,
): Point[] {
  const points: Point[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push({
      x:
        mt * mt * mt * p0.x +
        3 * mt * mt * t * p1.x +
        3 * mt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        mt * mt * mt * p0.y +
        3 * mt * mt * t * p1.y +
        3 * mt * t * t * p2.y +
        t * t * t * p3.y,
    });
  }
  return points;
}

function commandArity(cmd: string) {
  switch (cmd.toUpperCase()) {
    case 'M':
    case 'L':
    case 'T':
      return 2;
    case 'H':
    case 'V':
      return 1;
    case 'Q':
    case 'S':
      return 4;
    case 'C':
      return 6;
    case 'A':
      return 7;
    case 'Z':
      return 0;
    default:
      return 0;
  }
}

function parseContours(pathData: string): Contour[] {
  const tokens = Array.from(pathData.matchAll(TOKEN_RE)).map((m) => m[0]);
  const contours: Contour[] = [];
  let idx = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let prevC: Point | null = null;
  let prevQ: Point | null = null;
  let current: Contour | null = null;

  const pushPoint = (point: Point) => {
    if (!current) return;
    const last = current.points[current.points.length - 1];
    if (!last || Math.hypot(last.x - point.x, last.y - point.y) > 1e-6) {
      current.points.push(point);
    }
  };

  while (idx < tokens.length) {
    const token = tokens[idx];
    if (/^[a-zA-Z]$/.test(token)) {
      cmd = token;
      idx += 1;
      if (cmd.toUpperCase() === 'Z') {
        if (current) current.closed = true;
        prevC = null;
        prevQ = null;
      }
      continue;
    }
    if (!cmd) {
      idx += 1;
      continue;
    }
    const upper = cmd.toUpperCase();
    const isRel = cmd !== upper;
    const arity = commandArity(cmd);
    if (arity === 0 || idx + arity - 1 >= tokens.length) {
      idx += 1;
      continue;
    }
    const values = tokens.slice(idx, idx + arity).map((t) => Number.parseFloat(t));
    idx += arity;

    if (upper === 'M') {
      const x = isRel ? cx + values[0] : values[0];
      const y = isRel ? cy + values[1] : values[1];
      current = { points: [{ x, y }], closed: false };
      contours.push(current);
      cx = x;
      cy = y;
      prevC = null;
      prevQ = null;
      cmd = isRel ? 'l' : 'L';
      continue;
    }
    if (upper === 'L') {
      const x = isRel ? cx + values[0] : values[0];
      const y = isRel ? cy + values[1] : values[1];
      pushPoint({ x, y });
      cx = x;
      cy = y;
      prevC = null;
      prevQ = null;
      continue;
    }
    if (upper === 'H') {
      const x = isRel ? cx + values[0] : values[0];
      pushPoint({ x, y: cy });
      cx = x;
      prevC = null;
      prevQ = null;
      continue;
    }
    if (upper === 'V') {
      const y = isRel ? cy + values[0] : values[0];
      pushPoint({ x: cx, y });
      cy = y;
      prevC = null;
      prevQ = null;
      continue;
    }
    if (upper === 'C') {
      const c1x = isRel ? cx + values[0] : values[0];
      const c1y = isRel ? cy + values[1] : values[1];
      const c2x = isRel ? cx + values[2] : values[2];
      const c2y = isRel ? cy + values[3] : values[3];
      const x = isRel ? cx + values[4] : values[4];
      const y = isRel ? cy + values[5] : values[5];
      sampleCubicBezier(
        { x: cx, y: cy },
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
        { x, y },
      ).forEach(pushPoint);
      cx = x;
      cy = y;
      prevC = { x: c2x, y: c2y };
      prevQ = null;
      continue;
    }
    if (upper === 'S') {
      const c1x = prevC ? cx + (cx - prevC.x) : cx;
      const c1y = prevC ? cy + (cy - prevC.y) : cy;
      const c2x = isRel ? cx + values[0] : values[0];
      const c2y = isRel ? cy + values[1] : values[1];
      const x = isRel ? cx + values[2] : values[2];
      const y = isRel ? cy + values[3] : values[3];
      sampleCubicBezier(
        { x: cx, y: cy },
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
        { x, y },
      ).forEach(pushPoint);
      cx = x;
      cy = y;
      prevC = { x: c2x, y: c2y };
      prevQ = null;
      continue;
    }
    if (upper === 'Q') {
      const c1x = isRel ? cx + values[0] : values[0];
      const c1y = isRel ? cy + values[1] : values[1];
      const x = isRel ? cx + values[2] : values[2];
      const y = isRel ? cy + values[3] : values[3];
      sampleQuadraticBezier(
        { x: cx, y: cy },
        { x: c1x, y: c1y },
        { x, y },
      ).forEach(pushPoint);
      cx = x;
      cy = y;
      prevQ = { x: c1x, y: c1y };
      prevC = null;
      continue;
    }
    if (upper === 'T') {
      const reflectedControlX: number = prevQ ? cx + (cx - prevQ.x) : cx;
      const reflectedControlY: number = prevQ ? cy + (cy - prevQ.y) : cy;
      const x = isRel ? cx + values[0] : values[0];
      const y = isRel ? cy + values[1] : values[1];
      sampleQuadraticBezier(
        { x: cx, y: cy },
        { x: reflectedControlX, y: reflectedControlY },
        { x, y },
      ).forEach(pushPoint);
      cx = x;
      cy = y;
      prevQ = { x: reflectedControlX, y: reflectedControlY };
      prevC = null;
      continue;
    }
    if (upper === 'A') {
      const x = isRel ? cx + values[5] : values[5];
      const y = isRel ? cy + values[6] : values[6];
      for (let i = 1; i <= CURVE_SAMPLE_STEPS; i += 1) {
        const t = i / CURVE_SAMPLE_STEPS;
        pushPoint({
          x: lerp(cx, x, t),
          y: lerp(cy, y, t),
        });
      }
      cx = x;
      cy = y;
      prevQ = null;
      prevC = null;
    }
  }

  return contours.filter((c) => c.points.length > 1);
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

function samePoint(a: Point, b: Point, eps = 1e-6) {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function sharesEndpoint(
  s1: { a: Point; b: Point },
  s2: { a: Point; b: Point },
) {
  return (
    samePoint(s1.a, s2.a) ||
    samePoint(s1.a, s2.b) ||
    samePoint(s1.b, s2.a) ||
    samePoint(s1.b, s2.b)
  );
}

function hasSelfIntersection(contour: Contour) {
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let i = 0; i < contour.points.length - 1; i += 1) {
    segments.push({ a: contour.points[i], b: contour.points[i + 1] });
  }
  if (contour.closed && contour.points.length > 2) {
    segments.push({ a: contour.points[contour.points.length - 1], b: contour.points[0] });
  }
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (contour.closed && i === 0 && j === segments.length - 1) continue;
      if (intersects(segments[i].a, segments[i].b, segments[j].a, segments[j].b)) {
        if (sharesEndpoint(segments[i], segments[j])) continue;
        return true;
      }
    }
  }
  return false;
}

export function validateShapePathPayload(
  payload: { outerPath?: string; bbox?: Bounds },
): ValidationResult {
  const outerPath = payload.outerPath?.trim();
  if (!outerPath) return { ok: true };

  if (outerPath.length > 120_000) {
    return { ok: false, code: 'SHAPE_INVALID_DEGENERATE', message: 'Shape path is too large.' };
  }
  const contours = parseContours(outerPath);
  if (contours.length === 0) {
    return { ok: false, code: 'SHAPE_INVALID_DEGENERATE', message: 'Shape path appears degenerate.' };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxSegment = 0;
  for (const contour of contours) {
    if (hasSelfIntersection(contour)) {
      return {
        ok: false,
        code: 'SHAPE_INVALID_SELF_INTERSECTION',
        message: 'Shape contour self-intersects.',
      };
    }
    for (let i = 0; i < contour.points.length; i += 1) {
      const p = contour.points[i];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      if (i > 0) {
        const prev = contour.points[i - 1];
        maxSegment = Math.max(maxSegment, Math.hypot(p.x - prev.x, p.y - prev.y));
      }
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0.001 || height <= 0.001) {
    return { ok: false, code: 'SHAPE_INVALID_DEGENERATE', message: 'Shape path has invalid dimensions.' };
  }

  const diag = Math.hypot(width, height);
  if (diag > 0 && maxSegment > diag * 20) {
    return { ok: false, code: 'SHAPE_INVALID_CURVATURE_SPIKE', message: 'Shape path has extreme spikes.' };
  }

  const bbox = payload.bbox;
  if (bbox) {
    const bboxDiag = Math.hypot(bbox.width, bbox.height);
    const epsilon = Math.max(3, bboxDiag * 0.08);
    if (
      minX < bbox.x - epsilon ||
      minY < bbox.y - epsilon ||
      maxX > bbox.x + bbox.width + epsilon ||
      maxY > bbox.y + bbox.height + epsilon
    ) {
      return { ok: false, code: 'SHAPE_INVALID_BBOX_ESCAPE', message: 'Shape path escapes allowed bounds.' };
    }
  }

  return { ok: true };
}
