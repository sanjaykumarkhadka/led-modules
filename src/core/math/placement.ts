import type { LEDModule } from '../../data/catalog/modules';
import { findDistanceToEdge, isCapsuleInside, isPointInside, type Point } from './geometry';

export interface LEDPosition extends Point {
  rotation: number; // degrees
  id?: string;
  source?: 'auto' | 'manual';
}

export interface PlacementConfig {
  targetModule: LEDModule;
  strokeWidth: number; // kept for API compatibility
  pixelsPerInch: number;
  targetCount?: number; // target LED count for this character
  columnCount?: number; // number of columns (1-5)
  orientation?: 'horizontal' | 'vertical' | 'auto'; // LED orientation
}

interface CenterCandidate extends Point {
  id: number;
  pathDist: number;
  width: number;
  clearance: number;
  normal: Point;
  tangent: Point;
}

const LED_RENDER_LENGTH = 12;
const LED_RENDER_HEIGHT = 5;
const MAX_COLUMNS = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function normalize(vec: Point): Point {
  const len = Math.hypot(vec.x, vec.y);
  if (len === 0) return { x: 1, y: 0 };
  return { x: vec.x / len, y: vec.y / len };
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function calculateTangent(
  pathElement: SVGPathElement,
  distance: number,
  delta: number = 0.5
): Point {
  const totalLength = pathElement.getTotalLength();
  const d1 = Math.max(0, distance - delta);
  const d2 = Math.min(totalLength, distance + delta);
  const p1 = pathElement.getPointAtLength(d1);
  const p2 = pathElement.getPointAtLength(d2);
  return normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
}

function estimateTargetCount(pathElement: SVGPathElement, config: PlacementConfig): number {
  const pathLength = pathElement.getTotalLength();
  if (pathLength <= 0) return 0;

  const modulesPerFoot = config.targetModule.installation.modulesPerFoot;
  const pixelsPerInch = config.pixelsPerInch || 12.5;
  const lengthInInches = pathLength / pixelsPerInch;
  const lengthInFeet = lengthInInches / 12;

  return Math.max(1, Math.round(lengthInFeet * modulesPerFoot));
}

function findCenterCandidate(
  pathElement: SVGPathElement,
  distance: number,
  maxDist: number
): CenterCandidate | null {
  const onPath = pathElement.getPointAtLength(distance);
  const tangent = calculateTangent(pathElement, distance);
  const normal = normalize({ x: -tangent.y, y: tangent.x });

  const inset = 1.5;
  let testX = onPath.x + normal.x * inset;
  let testY = onPath.y + normal.y * inset;
  let dir = normal;

  if (!isPointInside(pathElement, testX, testY)) {
    testX = onPath.x - normal.x * inset;
    testY = onPath.y - normal.y * inset;
    dir = { x: -normal.x, y: -normal.y };

    if (!isPointInside(pathElement, testX, testY)) {
      return null;
    }
  }

  const distForward = findDistanceToEdge(pathElement, testX, testY, dir.x, dir.y, maxDist);
  const distBackward = findDistanceToEdge(pathElement, testX, testY, -dir.x, -dir.y, maxDist);
  const width = distForward + distBackward;

  if (width < 6) {
    return null;
  }

  const centerOffset = (distForward - distBackward) / 2;
  const centerX = testX + dir.x * centerOffset;
  const centerY = testY + dir.y * centerOffset;

  if (!isPointInside(pathElement, centerX, centerY)) {
    return null;
  }

  return {
    id: 0,
    x: centerX,
    y: centerY,
    pathDist: distance,
    width,
    clearance: Math.min(distForward, distBackward),
    normal: dir,
    tangent,
  };
}

function dedupeCandidates(
  candidates: CenterCandidate[],
  cellSize: number
): CenterCandidate[] {
  if (candidates.length === 0) return [];

  const grid = new Map<string, CenterCandidate[]>();
  const result: CenterCandidate[] = [];
  const radius = cellSize * 0.75;

  const cellKey = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;

  for (const cand of candidates) {
    const cx = Math.floor(cand.x / cellSize);
    const cy = Math.floor(cand.y / cellSize);
    let keep = true;

    for (let gx = cx - 1; gx <= cx + 1 && keep; gx++) {
      for (let gy = cy - 1; gy <= cy + 1 && keep; gy++) {
        const key = `${gx},${gy}`;
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (const existing of bucket) {
          if (dist(existing, cand) <= radius) {
            keep = false;
            break;
          }
        }
      }
    }

    if (!keep) continue;

    const key = cellKey(cand.x, cand.y);
    const bucket = grid.get(key);
    if (bucket) bucket.push(cand);
    else grid.set(key, [cand]);
    result.push(cand);
  }

  return result;
}

function buildChains(
  candidates: CenterCandidate[],
  breakThreshold: number
): CenterCandidate[][] {
  if (candidates.length === 0) return [];
  const chains: CenterCandidate[][] = [];
  let current: CenterCandidate[] = [candidates[0]];

  for (let i = 1; i < candidates.length; i++) {
    const prev = candidates[i - 1];
    const curr = candidates[i];
    if (dist(prev, curr) > breakThreshold) {
      if (current.length > 0) chains.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }

  if (current.length > 0) chains.push(current);
  return chains;
}

function chainLength(chain: CenterCandidate[]): number {
  if (chain.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < chain.length; i++) {
    length += dist(chain[i - 1], chain[i]);
  }
  return length;
}

function allocateCountsByLength(lengths: number[], total: number): number[] {
  const count = lengths.length;
  if (count === 0) return [];
  if (total <= 0) return new Array(count).fill(0);

  const totalLength = lengths.reduce((sum, v) => sum + v, 0);
  if (totalLength <= 0) {
    const base = Math.floor(total / count);
    let remainder = total % count;
    return lengths.map(() => base + (remainder-- > 0 ? 1 : 0));
  }

  const raw = lengths.map((len) => (len / totalLength) * total);
  const counts = raw.map((v) => Math.floor(v));
  let remainder = total - counts.reduce((sum, v) => sum + v, 0);

  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (const item of order) {
    if (remainder <= 0) break;
    counts[item.index] += 1;
    remainder -= 1;
  }

  return counts;
}

function pickEvenly(chain: CenterCandidate[], count: number): CenterCandidate[] {
  if (count <= 0) return [];
  if (chain.length <= count) return [...chain];
  if (chain.length === 1) return [chain[0]];

  const cumulative: number[] = [0];
  for (let i = 1; i < chain.length; i++) {
    cumulative[i] = cumulative[i - 1] + dist(chain[i - 1], chain[i]);
  }
  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength === 0) {
    const step = (chain.length - 1) / count;
    const result: CenterCandidate[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round(i * step);
      result.push(chain[idx]);
    }
    return result;
  }

  const step = totalLength / count;
  const used = new Set<number>();
  const result: CenterCandidate[] = [];
  let cursor = 0;

  for (let i = 0; i < count; i++) {
    const target = step * (i + 0.5);
    while (cursor < cumulative.length - 1 && cumulative[cursor] < target) {
      cursor += 1;
    }

    let best = cursor;
    if (cursor > 0) {
      const prev = cursor - 1;
      const prevDist = Math.abs(cumulative[prev] - target);
      const currDist = Math.abs(cumulative[cursor] - target);
      best = currDist <= prevDist ? cursor : prev;
    }

    let chosen = best;
    if (used.has(chosen)) {
      let left = best - 1;
      let right = best + 1;
      while (left >= 0 || right < chain.length) {
        if (left >= 0 && !used.has(left)) {
          chosen = left;
          break;
        }
        if (right < chain.length && !used.has(right)) {
          chosen = right;
          break;
        }
        left -= 1;
        right += 1;
      }
    }

    used.add(chosen);
    result.push(chain[chosen]);
  }

  return result;
}

function generateCenterlineCandidates(
  pathElement: SVGPathElement,
  targetCount: number
): { candidates: CenterCandidate[]; step: number } {
  const pathLength = pathElement.getTotalLength();
  if (pathLength <= 0) return { candidates: [], step: 0 };

  const step = clamp(pathLength / (targetCount * 12), 1.5, 4);
  const maxDist = pathLength * 0.5;
  const candidates: CenterCandidate[] = [];

  let id = 0;
  for (let distAlong = 0; distAlong <= pathLength; distAlong += step) {
    const candidate = findCenterCandidate(pathElement, distAlong, maxDist);
    if (!candidate) continue;
    candidate.id = id;
    candidates.push(candidate);
    id += 1;
  }

  const deduped = dedupeCandidates(candidates, step * 0.9);
  return { candidates: deduped, step };
}

function selectBasePositions(
  candidates: CenterCandidate[],
  step: number,
  count: number
): CenterCandidate[] {
  if (candidates.length === 0 || count <= 0) return [];
  if (candidates.length <= count) return [...candidates];

  const breakThreshold = Math.max(step * 4, LED_RENDER_LENGTH * 1.25);
  const chains = buildChains(candidates, breakThreshold);
  const lengths = chains.map((chain) => chainLength(chain));
  const allocations = allocateCountsByLength(lengths, count);

  const result: CenterCandidate[] = [];
  for (let i = 0; i < chains.length; i++) {
    const take = allocations[i];
    if (take <= 0) continue;
    result.push(...pickEvenly(chains[i], take));
  }

  return result;
}

function buildColumnOffsets(columnCount: number): number[] {
  if (columnCount <= 1) return [0];

  const center = (columnCount - 1) / 2;
  const offsets: number[] = [];
  for (let i = 0; i < columnCount; i++) {
    offsets.push(i - center);
  }

  offsets.sort((a, b) => Math.abs(a) - Math.abs(b));
  return offsets;
}

function expandColumns(
  pathElement: SVGPathElement,
  basePositions: CenterCandidate[],
  targetCount: number,
  columnCount: number,
  orientation: 'horizontal' | 'vertical' | 'auto'
): LEDPosition[] {
  const positions: LEDPosition[] = [];
  const halfLength = LED_RENDER_LENGTH / 2;
  const usableColumnOffsets = buildColumnOffsets(columnCount);

  for (const base of basePositions) {
    if (positions.length >= targetCount) break;

    const usableWidth = Math.max(LED_RENDER_HEIGHT * 1.25, base.width * 0.65);
    const spacing = columnCount > 1 ? usableWidth / (columnCount - 1) : 0;

    let rotation = 0;
    if (orientation === 'horizontal') rotation = 0;
    else if (orientation === 'vertical') rotation = 90;
    else rotation = radToDeg(Math.atan2(base.tangent.y, base.tangent.x));

    for (const offsetIndex of usableColumnOffsets) {
      if (positions.length >= targetCount) break;

      const offset = offsetIndex * spacing;
      let x = base.x + base.normal.x * offset;
      let y = base.y + base.normal.y * offset;

      let fits = isCapsuleInside(pathElement, x, y, rotation, halfLength * 0.9);

      if (!fits && Math.abs(offset) > 0.1) {
        const shrink = 0.75;
        x = base.x + base.normal.x * offset * shrink;
        y = base.y + base.normal.y * offset * shrink;
        fits = isCapsuleInside(pathElement, x, y, rotation, halfLength * 0.85);
      }

      if (!fits && !isPointInside(pathElement, x, y)) {
        continue;
      }

      positions.push({ x, y, rotation });
    }
  }

  return positions;
}

export function generateLEDPositions(
  pathElement: SVGPathElement,
  config: PlacementConfig
): LEDPosition[] {
  if (!pathElement) return [];

  const targetCount =
    config.targetCount && config.targetCount > 0
      ? config.targetCount
      : estimateTargetCount(pathElement, config);

  if (!targetCount || targetCount <= 0) return [];

  const columnCount = clamp(config.columnCount ?? 1, 1, MAX_COLUMNS);
  const orientation = config.orientation ?? 'auto';

  const { candidates, step } = generateCenterlineCandidates(pathElement, targetCount);
  if (candidates.length === 0) return [];

  const baseCount = Math.ceil(targetCount / columnCount);
  const basePositions = selectBasePositions(candidates, step, baseCount);
  if (basePositions.length === 0) return [];

  const expanded = expandColumns(
    pathElement,
    basePositions,
    targetCount,
    columnCount,
    orientation
  );

  return expanded;
}
