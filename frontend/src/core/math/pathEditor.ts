type SegmentCmd = 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z';

interface Segment {
  cmd: SegmentCmd;
  values: number[];
}

export type EditablePathPointKind = 'anchor' | 'control1' | 'control2';

export interface EditablePathPoint {
  id: string;
  kind: EditablePathPointKind;
  x: number;
  y: number;
  contourIndex: number;
  segmentIndex: number;
  xValueIndex: number;
  yValueIndex: number;
}

export interface MoveEditableAnchorPointSafeResult {
  accepted: boolean;
  severity?: import('./pathSafety').PathValidationSeverity;
  reason?: import('./pathSafety').PathEditRejectReason;
  warningReason?: import('./pathSafety').PathEditRejectReason;
  pathData: string;
  points: EditablePathPoint[];
}

export interface EditableAnchorDebugGroup {
  representativeId: string;
  contourIndex: number;
  x: number;
  y: number;
  memberIds: string[];
}

const TOKEN_RE = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;

function fmt(value: number) {
  return Number(value.toFixed(2)).toString();
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

    const nextValues = () => {
      const values = tokens.slice(idx, idx + arity).map((t) => Number.parseFloat(t));
      idx += arity;
      return values;
    };

    if (upper === 'M') {
      const values = nextValues();
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
      const values = nextValues();
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
      const values = nextValues();
      const x = isRel ? cx + values[0] : values[0];
      segments.push({ cmd: 'L', values: [x, cy] });
      cx = x;
      prevC = null;
      prevQ = null;
      continue;
    }

    if (upper === 'V') {
      const values = nextValues();
      const y = isRel ? cy + values[0] : values[0];
      segments.push({ cmd: 'L', values: [cx, y] });
      cy = y;
      prevC = null;
      prevQ = null;
      continue;
    }

    if (upper === 'C') {
      const values = nextValues();
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
      const values = nextValues();
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
      const values = nextValues();
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
      const values = nextValues();
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
      const values = nextValues();
      const x = isRel ? cx + values[5] : values[5];
      const y = isRel ? cy + values[6] : values[6];
      segments.push({ cmd: 'A', values: [values[0], values[1], values[2], values[3], values[4], x, y] });
      cx = x;
      cy = y;
      prevQ = null;
      prevC = null;
      continue;
    }
  }

  return segments;
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

function buildEditablePointsFromSegments(segments: Segment[]) {
  const points: EditablePathPoint[] = [];
  let contourIndex = -1;
  segments.forEach((segment, segmentIndex) => {
    if (segment.cmd === 'M') {
      contourIndex += 1;
    }
    const currentContour = Math.max(0, contourIndex);
    if (segment.cmd === 'M' || segment.cmd === 'L') {
      points.push({
        id: `${segmentIndex}:anchor:0:1`,
        kind: 'anchor',
        x: segment.values[0],
        y: segment.values[1],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 0,
        yValueIndex: 1,
      });
      return;
    }
    if (segment.cmd === 'A') {
      points.push({
        id: `${segmentIndex}:anchor:5:6`,
        kind: 'anchor',
        x: segment.values[5],
        y: segment.values[6],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 5,
        yValueIndex: 6,
      });
      return;
    }
    if (segment.cmd === 'Q') {
      points.push({
        id: `${segmentIndex}:control1:0:1`,
        kind: 'control1',
        x: segment.values[0],
        y: segment.values[1],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 0,
        yValueIndex: 1,
      });
      points.push({
        id: `${segmentIndex}:anchor:2:3`,
        kind: 'anchor',
        x: segment.values[2],
        y: segment.values[3],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 2,
        yValueIndex: 3,
      });
      return;
    }
    if (segment.cmd === 'C') {
      points.push({
        id: `${segmentIndex}:control1:0:1`,
        kind: 'control1',
        x: segment.values[0],
        y: segment.values[1],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 0,
        yValueIndex: 1,
      });
      points.push({
        id: `${segmentIndex}:control2:2:3`,
        kind: 'control2',
        x: segment.values[2],
        y: segment.values[3],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 2,
        yValueIndex: 3,
      });
      points.push({
        id: `${segmentIndex}:anchor:4:5`,
        kind: 'anchor',
        x: segment.values[4],
        y: segment.values[5],
        contourIndex: currentContour,
        segmentIndex,
        xValueIndex: 4,
        yValueIndex: 5,
      });
    }
  });
  return points;
}

export function buildEditablePathPoints(pathData: string) {
  const segments = parsePathToAbsoluteSegments(pathData);
  return buildEditablePointsFromSegments(segments);
}

export function buildEditableAnchorPoints(pathData: string) {
  const anchors = buildEditablePathPoints(pathData).filter((point) => point.kind === 'anchor');
  const seen = new Map<string, EditablePathPoint>();
  const precision = 100;
  for (const point of anchors) {
    // Avoid stacked duplicate nodes for the same contour corner.
    const key = `${point.contourIndex}:${Math.round(point.x * precision)}:${Math.round(point.y * precision)}`;
    if (!seen.has(key)) {
      seen.set(key, point);
    }
  }
  return Array.from(seen.values());
}

export function buildEditableAnchorDebugGroups(pathData: string): EditableAnchorDebugGroup[] {
  const anchors = buildEditablePathPoints(pathData).filter((point) => point.kind === 'anchor');
  const precision = 100;
  const groups = new Map<
    string,
    { representative: EditablePathPoint; members: EditablePathPoint[] }
  >();
  for (const point of anchors) {
    const key = `${point.contourIndex}:${Math.round(point.x * precision)}:${Math.round(point.y * precision)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { representative: point, members: [point] });
      continue;
    }
    existing.members.push(point);
  }
  return Array.from(groups.values()).map((group) => ({
    representativeId: group.representative.id,
    contourIndex: group.representative.contourIndex,
    x: group.representative.x,
    y: group.representative.y,
    memberIds: group.members.map((m) => m.id),
  }));
}

export function moveEditablePathPoint(pathData: string, pointId: string, next: { x: number; y: number }) {
  const segments = parsePathToAbsoluteSegments(pathData);
  const points = buildEditablePointsFromSegments(segments);
  const point = points.find((p) => p.id === pointId);
  if (!point) {
    return { pathData, points };
  }

  const segment = segments[point.segmentIndex];
  if (!segment) {
    return { pathData, points };
  }

  segment.values[point.xValueIndex] = next.x;
  segment.values[point.yValueIndex] = next.y;

  const updatedPath = serializeSegments(segments);
  return {
    pathData: updatedPath,
    points: buildEditablePathPoints(updatedPath),
  };
}

function translateIncomingControl(segment: Segment, point: EditablePathPoint, dx: number, dy: number) {
  if (point.kind !== 'anchor') return;
  if (segment.cmd === 'C' && point.xValueIndex === 4 && point.yValueIndex === 5) {
    segment.values[2] += dx;
    segment.values[3] += dy;
    return;
  }
  if (segment.cmd === 'Q' && point.xValueIndex === 2 && point.yValueIndex === 3) {
    segment.values[0] += dx;
    segment.values[1] += dy;
  }
}

function translateOutgoingControl(nextSegment: Segment | undefined, dx: number, dy: number) {
  if (!nextSegment) return;
  if (nextSegment.cmd === 'C' || nextSegment.cmd === 'Q') {
    nextSegment.values[0] += dx;
    nextSegment.values[1] += dy;
  }
}

export function moveEditableAnchorPointSafe(
  pathData: string,
  pointId: string,
  next: { x: number; y: number },
  options?: {
    bounds?: { x: number; y: number; width: number; height: number };
    validate?: (
      previousPath: string,
      candidatePath: string,
      bounds?: { x: number; y: number; width: number; height: number }
    ) => {
      ok: boolean;
      severity?: import('./pathSafety').PathValidationSeverity;
      reason?: import('./pathSafety').PathEditRejectReason;
    };
  }
): MoveEditableAnchorPointSafeResult {
  const segments = parsePathToAbsoluteSegments(pathData);
  const points = buildEditablePointsFromSegments(segments);
  const point = points.find((p) => p.id === pointId);
  if (!point || point.kind !== 'anchor') {
    return { accepted: false, reason: 'degenerate_segment', pathData, points: buildEditableAnchorPoints(pathData) };
  }
  const segment = segments[point.segmentIndex];
  if (!segment) {
    return { accepted: false, reason: 'degenerate_segment', pathData, points: buildEditableAnchorPoints(pathData) };
  }

  const currentX = segment.values[point.xValueIndex];
  const currentY = segment.values[point.yValueIndex];
  const dx = next.x - currentX;
  const dy = next.y - currentY;
  const linked = points.filter((candidate) => {
    if (candidate.kind !== 'anchor') return false;
    if (candidate.contourIndex !== point.contourIndex) return false;
    return Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 0.01;
  });
  const targets = linked.length > 0 ? linked : [point];
  const updatedAnchorKeys = new Set<string>();
  for (const target of targets) {
    const targetSegment = segments[target.segmentIndex];
    if (!targetSegment) continue;
    const targetKey = `${target.segmentIndex}:${target.xValueIndex}:${target.yValueIndex}`;
    if (updatedAnchorKeys.has(targetKey)) continue;
    updatedAnchorKeys.add(targetKey);
    translateIncomingControl(targetSegment, target, dx, dy);
    const isPrimary = target.id === point.id;
    targetSegment.values[target.xValueIndex] = isPrimary
      ? next.x
      : targetSegment.values[target.xValueIndex] + dx;
    targetSegment.values[target.yValueIndex] = isPrimary
      ? next.y
      : targetSegment.values[target.yValueIndex] + dy;
    translateOutgoingControl(segments[target.segmentIndex + 1], dx, dy);
  }

  const candidatePath = serializeSegments(segments);
  if (options?.validate) {
    const verdict = options.validate(pathData, candidatePath, options.bounds);
    if (!verdict.ok) {
      return {
        accepted: false,
        severity: verdict.severity ?? 'error',
        reason: verdict.reason,
        pathData,
        points: buildEditableAnchorPoints(pathData),
      };
    }
    if (verdict.severity === 'warn') {
      return {
        accepted: true,
        severity: 'warn',
        warningReason: verdict.reason,
        pathData: candidatePath,
        points: buildEditableAnchorPoints(candidatePath),
      };
    }
  }

  return {
    accepted: true,
    severity: 'ok',
    pathData: candidatePath,
    points: buildEditableAnchorPoints(candidatePath),
  };
}
