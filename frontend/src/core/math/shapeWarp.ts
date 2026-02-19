export interface MeshPoint {
  x: number;
  y: number;
}

export interface MeshGrid {
  rows: number;
  cols: number;
  points: MeshPoint[];
}

export interface CharacterShapeOverride {
  // v2 path-native geometry
  version?: number;
  outerPath?: string;
  holes?: string[];
  units?: 'mm' | 'in';
  bbox?: { x: number; y: number; width: number; height: number };
  sourceType?: 'font_glyph' | 'svg_import' | 'custom_path';
  constraints?: { minStrokeWidthMm?: number; minChannelWidthMm?: number };

  // v1 mesh warp fallback (legacy compatibility)
  baseBBox?: { x: number; y: number; width: number; height: number };
  mesh?: MeshGrid;
}

export interface WarpedPathResult {
  pathData: string;
  bbox: { x: number; y: number; width: number; height: number };
}

const TOKEN_RE = /([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/g;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function indexFor(mesh: MeshGrid, row: number, col: number) {
  return row * mesh.cols + col;
}

function getPoint(mesh: MeshGrid, row: number, col: number): MeshPoint {
  return mesh.points[indexFor(mesh, row, col)];
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

export function hasPathGeometry(shape: CharacterShapeOverride | undefined | null): boolean {
  return Boolean(shape?.outerPath && shape.outerPath.trim().length > 0);
}

export function composeCharacterShapePath(shape: CharacterShapeOverride): string {
  const outer = shape.outerPath?.trim() ?? '';
  if (!outer) return '';
  const holes = (shape.holes ?? []).map((h) => h.trim()).filter(Boolean);
  return holes.length > 0 ? `${outer} ${holes.join(' ')}` : outer;
}

export function createPathShapeOverride(
  pathData: string,
  bbox: { x: number; y: number; width: number; height: number },
  sourceType: 'font_glyph' | 'svg_import' | 'custom_path' = 'custom_path',
): CharacterShapeOverride {
  return {
    version: 2,
    outerPath: pathData,
    holes: [],
    units: 'mm',
    bbox: { ...bbox },
    sourceType,
  };
}

export function createIdentityShapeOverride(
  bbox: { x: number; y: number; width: number; height: number },
  rows = 4,
  cols = 4
): CharacterShapeOverride {
  const safeRows = Math.max(2, rows);
  const safeCols = Math.max(2, cols);
  const points: MeshPoint[] = [];
  for (let r = 0; r < safeRows; r += 1) {
    for (let c = 0; c < safeCols; c += 1) {
      const u = c / (safeCols - 1);
      const v = r / (safeRows - 1);
      points.push({
        x: bbox.x + u * bbox.width,
        y: bbox.y + v * bbox.height,
      });
    }
  }
  return {
    version: 1,
    baseBBox: { ...bbox },
    mesh: { rows: safeRows, cols: safeCols, points },
  };
}

export function warpPointWithMesh(
  point: MeshPoint,
  baseBBox: { x: number; y: number; width: number; height: number },
  mesh: MeshGrid
): MeshPoint {
  if (mesh.rows < 2 || mesh.cols < 2 || mesh.points.length !== mesh.rows * mesh.cols) {
    return point;
  }
  const safeW = Math.max(1e-6, baseBBox.width);
  const safeH = Math.max(1e-6, baseBBox.height);
  const u = (point.x - baseBBox.x) / safeW;
  const v = (point.y - baseBBox.y) / safeH;

  const gx = clamp(u, 0, 1) * (mesh.cols - 1);
  const gy = clamp(v, 0, 1) * (mesh.rows - 1);
  const col = clamp(Math.floor(gx), 0, mesh.cols - 2);
  const row = clamp(Math.floor(gy), 0, mesh.rows - 2);
  const tx = gx - col;
  const ty = gy - row;

  const p00 = getPoint(mesh, row, col);
  const p10 = getPoint(mesh, row, col + 1);
  const p01 = getPoint(mesh, row + 1, col);
  const p11 = getPoint(mesh, row + 1, col + 1);

  const x =
    p00.x * (1 - tx) * (1 - ty) +
    p10.x * tx * (1 - ty) +
    p01.x * (1 - tx) * ty +
    p11.x * tx * ty;
  const y =
    p00.y * (1 - tx) * (1 - ty) +
    p10.y * tx * (1 - ty) +
    p01.y * (1 - tx) * ty +
    p11.y * tx * ty;

  return { x, y };
}

export function warpPathDataWithOverride(
  pathData: string,
  shape: CharacterShapeOverride
): WarpedPathResult {
  if (!pathData || !shape?.mesh?.points?.length) {
    const base = shape?.baseBBox ?? shape?.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
    return { pathData, bbox: base };
  }

  const tokens = Array.from(pathData.matchAll(TOKEN_RE)).map((m) => m[0]);
  let idx = 0;
  let cmd = '';
  let out = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let isFirstMovePair = false;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const pushBBox = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  const warpXY = (x: number, y: number) => {
    const p = warpPointWithMesh({ x, y }, shape.baseBBox ?? shape.bbox ?? { x: 0, y: 0, width: 0, height: 0 }, shape.mesh!);
    pushBBox(p.x, p.y);
    return p;
  };

  while (idx < tokens.length) {
    const token = tokens[idx];
    if (/^[a-zA-Z]$/.test(token)) {
      cmd = token;
      idx += 1;
      if (cmd === 'Z' || cmd === 'z') {
        out += `${out ? ' ' : ''}Z`;
        cx = sx;
        cy = sy;
      }
      isFirstMovePair = cmd === 'M' || cmd === 'm';
      continue;
    }
    if (!cmd) {
      idx += 1;
      continue;
    }

    const arity = commandArity(cmd);
    if (arity === 0) {
      idx += 1;
      continue;
    }
    if (idx + arity - 1 >= tokens.length) break;

    const values = tokens.slice(idx, idx + arity).map((t) => Number.parseFloat(t));
    idx += arity;
    const upper = cmd.toUpperCase();
    const isRel = cmd !== upper;

    if (upper === 'H') {
      const x = isRel ? cx + values[0] : values[0];
      const p = warpXY(x, cy);
      out += `${out ? ' ' : ''}${isFirstMovePair ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      cx = x;
      isFirstMovePair = false;
      continue;
    }

    if (upper === 'V') {
      const y = isRel ? cy + values[0] : values[0];
      const p = warpXY(cx, y);
      out += `${out ? ' ' : ''}${isFirstMovePair ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      cy = y;
      isFirstMovePair = false;
      continue;
    }

    if (upper === 'A') {
      const x = isRel ? cx + values[5] : values[5];
      const y = isRel ? cy + values[6] : values[6];
      const wp = warpXY(x, y);
      out += `${out ? ' ' : ''}A ${values[0]} ${values[1]} ${values[2]} ${values[3]} ${values[4]} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`;
      cx = x;
      cy = y;
      isFirstMovePair = false;
      continue;
    }

    const points: MeshPoint[] = [];
    for (let i = 0; i < values.length; i += 2) {
      const x = isRel ? cx + values[i] : values[i];
      const y = isRel ? cy + values[i + 1] : values[i + 1];
      points.push({ x, y });
    }
    const warped = points.map((p) => warpXY(p.x, p.y));
    const outCmd = isFirstMovePair ? 'M' : upper;
    const coords = warped.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    out += `${out ? ' ' : ''}${outCmd} ${coords}`;

    const end = points[points.length - 1];
    cx = end.x;
    cy = end.y;
    if (outCmd === 'M') {
      sx = cx;
      sy = cy;
    }
    isFirstMovePair = false;
    if ((cmd === 'M' || cmd === 'm') && arity === 2) {
      cmd = isRel ? 'l' : 'L';
    }
  }

  const fallbackBBox = shape.baseBBox ?? shape.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    pathData: out || pathData,
    bbox:
      Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
        ? {
            x: minX,
            y: minY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
          }
        : fallbackBBox,
  };
}

export function pathBBoxFromPathData(pathData: string) {
  if (typeof document === 'undefined') return null;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', pathData);
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.opacity = '0';
  svg.style.pointerEvents = 'none';
  svg.appendChild(path);
  document.body.appendChild(svg);
  try {
    const bb = path.getBBox();
    return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
  } catch {
    return null;
  } finally {
    document.body.removeChild(svg);
  }
}

export function resolveShapePath(
  basePathData: string,
  shape: CharacterShapeOverride | undefined,
  fallbackBBox: { x: number; y: number; width: number; height: number }
): WarpedPathResult {
  if (shape && hasPathGeometry(shape)) {
    const pathData = composeCharacterShapePath(shape);
    const bbox = pathBBoxFromPathData(pathData) ?? shape.bbox ?? fallbackBBox;
    return { pathData, bbox };
  }
  if (shape?.mesh) {
    return warpPathDataWithOverride(basePathData, shape);
  }
  const bbox = pathBBoxFromPathData(basePathData) ?? fallbackBBox;
  return { pathData: basePathData, bbox };
}

export function normalizeShapeOverride(
  shape: CharacterShapeOverride | undefined,
  fallbackBBox: { x: number; y: number; width: number; height: number },
  fallbackPathData?: string
) {
  if (shape && hasPathGeometry(shape)) {
    const pathData = composeCharacterShapePath(shape);
    const bbox = shape.bbox ?? pathBBoxFromPathData(pathData) ?? fallbackBBox;
    return {
      version: 2,
      outerPath: shape.outerPath ?? pathData,
      holes: shape.holes ?? [],
      units: shape.units ?? 'mm',
      bbox,
      sourceType: shape.sourceType ?? 'custom_path',
      ...(shape.constraints ? { constraints: shape.constraints } : {}),
    } as CharacterShapeOverride;
  }

  const mesh = shape?.mesh;
  if (
    mesh &&
    mesh.rows >= 2 &&
    mesh.cols >= 2 &&
    Array.isArray(mesh.points) &&
    mesh.points.length === mesh.rows * mesh.cols
  ) {
    return {
      version: 1,
      baseBBox: shape?.baseBBox ?? fallbackBBox,
      mesh: {
        rows: mesh.rows,
        cols: mesh.cols,
        points: mesh.points.map((p) => ({ x: p.x, y: p.y })),
      },
    } as CharacterShapeOverride;
  }

  if (fallbackPathData) {
    return createPathShapeOverride(fallbackPathData, fallbackBBox, 'font_glyph');
  }
  return createIdentityShapeOverride(fallbackBBox);
}
