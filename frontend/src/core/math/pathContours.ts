type SegmentCmd = 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z';

interface Segment {
  cmd: SegmentCmd;
  values: number[];
}

export interface PathContour {
  pathData: string;
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

const TOKEN_RE = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function fmt(value: number) {
  return Number(value.toFixed(2)).toString();
}

function serializeSegments(segments: Segment[]) {
  return segments
    .map((segment) => {
      switch (segment.cmd) {
        case 'M':
        case 'L':
          return `${segment.cmd} ${fmt(segment.values[0])} ${fmt(segment.values[1])}`;
        case 'C':
          return `${segment.cmd} ${fmt(segment.values[0])} ${fmt(segment.values[1])} ${fmt(segment.values[2])} ${fmt(segment.values[3])} ${fmt(segment.values[4])} ${fmt(segment.values[5])}`;
        case 'Q':
          return `${segment.cmd} ${fmt(segment.values[0])} ${fmt(segment.values[1])} ${fmt(segment.values[2])} ${fmt(segment.values[3])}`;
        case 'A':
          return `${segment.cmd} ${fmt(segment.values[0])} ${fmt(segment.values[1])} ${fmt(segment.values[2])} ${fmt(segment.values[3])} ${fmt(segment.values[4])} ${fmt(segment.values[5])} ${fmt(segment.values[6])}`;
        case 'Z':
          return 'Z';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(' ');
}

function parsePathToAbsoluteSegments(pathData: string): Segment[] {
  const tokens = Array.from(pathData.matchAll(TOKEN_RE)).map((m) => m[0]);
  const segments: Segment[] = [];
  let idx = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevC: { x: number; y: number } | null = null;
  let prevQ: { x: number; y: number } | null = null;

  while (idx < tokens.length) {
    const token = tokens[idx];
    if (/^[a-zA-Z]$/.test(token)) {
      cmd = token;
      idx += 1;
      if (cmd === 'Z' || cmd === 'z') {
        segments.push({ cmd: 'Z', values: [] });
        cx = sx;
        cy = sy;
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
    if (arity === 0) {
      idx += 1;
      continue;
    }
    if (idx + arity - 1 >= tokens.length) break;
    const values = tokens.slice(idx, idx + arity).map((t) => Number.parseFloat(t));
    idx += arity;

    if (upper === 'M') {
      const x = isRel ? cx + values[0] : values[0];
      const y = isRel ? cy + values[1] : values[1];
      segments.push({ cmd: 'M', values: [x, y] });
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      prevC = null;
      prevQ = null;
      cmd = isRel ? 'l' : 'L';
      continue;
    }
    if (upper === 'L') {
      const x = isRel ? cx + values[0] : values[0];
      const y = isRel ? cy + values[1] : values[1];
      segments.push({ cmd: 'L', values: [x, y] });
      cx = x;
      cy = y;
      prevC = null;
      prevQ = null;
      continue;
    }
    if (upper === 'H') {
      const x = isRel ? cx + values[0] : values[0];
      segments.push({ cmd: 'L', values: [x, cy] });
      cx = x;
      prevC = null;
      prevQ = null;
      continue;
    }
    if (upper === 'V') {
      const y = isRel ? cy + values[0] : values[0];
      segments.push({ cmd: 'L', values: [cx, y] });
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
      segments.push({ cmd: 'C', values: [c1x, c1y, c2x, c2y, x, y] });
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
      segments.push({ cmd: 'C', values: [c1x, c1y, c2x, c2y, x, y] });
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
      segments.push({ cmd: 'Q', values: [c1x, c1y, x, y] });
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
      segments.push({ cmd: 'Q', values: [reflectedControlX, reflectedControlY, x, y] });
      cx = x;
      cy = y;
      prevQ = { x: reflectedControlX, y: reflectedControlY };
      prevC = null;
      continue;
    }
    if (upper === 'A') {
      const x = isRel ? cx + values[5] : values[5];
      const y = isRel ? cy + values[6] : values[6];
      segments.push({ cmd: 'A', values: [values[0], values[1], values[2], values[3], values[4], x, y] });
      cx = x;
      cy = y;
      prevQ = null;
      prevC = null;
    }
  }
  return segments;
}

export function extractContours(pathData: string): PathContour[] {
  const segments = parsePathToAbsoluteSegments(pathData);
  const contours: PathContour[] = [];
  let current: Segment[] = [];
  let points: Array<{ x: number; y: number }> = [];
  let closed = false;

  const flush = () => {
    if (current.length === 0) return;
    contours.push({
      pathData: serializeSegments(current),
      points: [...points],
      closed,
    });
    current = [];
    points = [];
    closed = false;
  };

  for (const segment of segments) {
    if (segment.cmd === 'M') {
      flush();
      current.push(segment);
      points.push({ x: segment.values[0], y: segment.values[1] });
      continue;
    }
    current.push(segment);
    if (segment.cmd === 'L') points.push({ x: segment.values[0], y: segment.values[1] });
    if (segment.cmd === 'Q') points.push({ x: segment.values[2], y: segment.values[3] });
    if (segment.cmd === 'C') points.push({ x: segment.values[4], y: segment.values[5] });
    if (segment.cmd === 'A') points.push({ x: segment.values[5], y: segment.values[6] });
    if (segment.cmd === 'Z') closed = true;
  }
  flush();
  return contours;
}

export function sampleContourPoints(contour: PathContour): Array<{ x: number; y: number }> {
  if (typeof document === 'undefined' || !contour.pathData) return contour.points;
  const svgNS = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', contour.pathData);
  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    return contour.points;
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0) return contour.points;
  const sampleCount = clamp(Math.ceil(totalLength / 8), 24, 220);
  const sampled: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= sampleCount; i += 1) {
    const at = (i / sampleCount) * totalLength;
    const p = path.getPointAtLength(at);
    const next = { x: p.x, y: p.y };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) continue;
    const prev = sampled[sampled.length - 1];
    if (prev && Math.hypot(prev.x - next.x, prev.y - next.y) < 1e-5) continue;
    sampled.push(next);
  }
  return sampled.length > 1 ? sampled : contour.points;
}
