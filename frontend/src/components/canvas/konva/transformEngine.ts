import type { RectBounds } from './types';

export interface TransformSession {
  pointerStart: { x: number; y: number };
}

export interface TransformResult {
  x: number;
  y: number;
  clamped: boolean;
}

export interface ClampResult {
  x: number;
  y: number;
  clamped: boolean;
  reason?: 'stage-bounds';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeRotation = (deg: number) => ((deg % 360) + 360) % 360;

function getHalfExtents(width: number, height: number, rotationDeg: number) {
  const rad = (normalizeRotation(rotationDeg) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    x: (width / 2) * cos + (height / 2) * sin,
    y: (width / 2) * sin + (height / 2) * cos,
  };
}

export function startTransform(pointerStart: { x: number; y: number }): TransformSession {
  return { pointerStart };
}

export function clampInsideStage(
  center: { x: number; y: number },
  options: {
    width: number;
    height: number;
    rotationDeg?: number;
    stageBounds: RectBounds;
  }
): ClampResult {
  const { width, height, stageBounds, rotationDeg = 0 } = options;
  const ext = getHalfExtents(width, height, rotationDeg);
  const minX = stageBounds.x + ext.x;
  const maxX = stageBounds.x + stageBounds.width - ext.x;
  const minY = stageBounds.y + ext.y;
  const maxY = stageBounds.y + stageBounds.height - ext.y;

  const x = clamp(center.x, minX, maxX);
  const y = clamp(center.y, minY, maxY);
  const clamped = x !== center.x || y !== center.y;
  return {
    x,
    y,
    clamped,
    ...(clamped ? { reason: 'stage-bounds' as const } : {}),
  };
}

export function applyDrag(
  session: TransformSession,
  pointer: { x: number; y: number },
  target: {
    startX: number;
    startY: number;
    width: number;
    height: number;
    rotationDeg?: number;
  },
  stageBounds: RectBounds
): TransformResult {
  const next = {
    x: target.startX + (pointer.x - session.pointerStart.x),
    y: target.startY + (pointer.y - session.pointerStart.y),
  };
  const clamped = clampInsideStage(next, {
    width: target.width,
    height: target.height,
    rotationDeg: target.rotationDeg ?? 0,
    stageBounds,
  });
  return { x: clamped.x, y: clamped.y, clamped: clamped.clamped };
}

export function clampGroupDrag(
  delta: { dx: number; dy: number },
  entities: Array<{ x: number; y: number; width: number; height: number; rotationDeg?: number }>,
  stageBounds: RectBounds
) {
  let minDx = -Infinity;
  let maxDx = Infinity;
  let minDy = -Infinity;
  let maxDy = Infinity;

  entities.forEach((item) => {
    const ext = getHalfExtents(item.width, item.height, item.rotationDeg ?? 0);
    minDx = Math.max(minDx, stageBounds.x + ext.x - item.x);
    maxDx = Math.min(maxDx, stageBounds.x + stageBounds.width - ext.x - item.x);
    minDy = Math.max(minDy, stageBounds.y + ext.y - item.y);
    maxDy = Math.min(maxDy, stageBounds.y + stageBounds.height - ext.y - item.y);
  });

  return {
    dx: clamp(delta.dx, minDx, maxDx),
    dy: clamp(delta.dy, minDy, maxDy),
  };
}

export function applyResizeOppositeAnchor(
  start: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    rotationDeg?: number;
    scale: number;
    minScale: number;
    maxScale: number;
  },
  pointerDeltaWorld: { dx: number; dy: number },
  handle: 'nw' | 'ne' | 'sw' | 'se',
  stageBounds: RectBounds
): { centerX: number; centerY: number; scale: number; clamped: boolean } {
  const rotation = start.rotationDeg ?? 0;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localDx = pointerDeltaWorld.dx * cos + pointerDeltaWorld.dy * sin;
  const localDy = -pointerDeltaWorld.dx * sin + pointerDeltaWorld.dy * cos;

  const baseW = start.width;
  const baseH = start.height;
  let delta = 0;
  switch (handle) {
    case 'se':
      delta = (localDx / baseW + localDy / baseH) / 2;
      break;
    case 'sw':
      delta = (-localDx / baseW + localDy / baseH) / 2;
      break;
    case 'ne':
      delta = (localDx / baseW - localDy / baseH) / 2;
      break;
    case 'nw':
      delta = (-localDx / baseW - localDy / baseH) / 2;
      break;
  }

  const nextScale = clamp(start.scale + delta, start.minScale, start.maxScale);
  const w1 = baseW * nextScale;
  const h1 = baseH * nextScale;
  const sx = handle === 'nw' || handle === 'sw' ? -1 : 1;
  const sy = handle === 'nw' || handle === 'ne' ? -1 : 1;

  const oppX =
    start.centerX +
    (-sx * (baseW / 2)) * cos -
    (-sy * (baseH / 2)) * sin;
  const oppY =
    start.centerY +
    (-sx * (baseW / 2)) * sin +
    (-sy * (baseH / 2)) * cos;

  const centerX = oppX - ((-sx * (w1 / 2)) * cos - (-sy * (h1 / 2)) * sin);
  const centerY = oppY - ((-sx * (w1 / 2)) * sin + (-sy * (h1 / 2)) * cos);

  const clamped = clampInsideStage(
    { x: centerX, y: centerY },
    { width: w1, height: h1, rotationDeg: rotation, stageBounds }
  );

  return {
    centerX: clamped.x,
    centerY: clamped.y,
    scale: nextScale,
    clamped: clamped.clamped,
  };
}

export function applyRotate(
  center: { x: number; y: number },
  start: { pointerAngleDeg: number; rotationDeg: number },
  pointer: { x: number; y: number }
) {
  const current = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
  return normalizeRotation(start.rotationDeg + (current - start.pointerAngleDeg));
}

