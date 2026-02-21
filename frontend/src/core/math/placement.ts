import { isCapsuleInside, isPointInside, type Point } from './geometry';

export interface LEDPosition extends Point {
  rotation: number;
  id?: string;
  source?: 'auto' | 'manual';
}

export interface AutofillConfig {
  moduleWidth: number;
  moduleHeight: number;
  scale: number;
  spacing: number;
  orientation: 'horizontal' | 'vertical';
  inset: number;
}

const BASE_MODULE_WIDTH = 12;
const BASE_MODULE_HEIGHT = 5;

export function createDefaultAutofillConfig(): AutofillConfig {
  return {
    moduleWidth: BASE_MODULE_WIDTH,
    moduleHeight: BASE_MODULE_HEIGHT,
    scale: 1,
    spacing: 2,
    orientation: 'horizontal',
    inset: 1,
  };
}

/**
 * Scanline grid autofill algorithm.
 *
 * Overlays a uniform rectangular grid on the path's bounding box and keeps
 * every cell whose centre (and optionally full capsule) falls inside the
 * character fill.  Guarantees perfectly uniform, side-by-side placement
 * regardless of character shape.
 */
export function generateLEDPositions(
  pathElement: SVGPathElement,
  config: AutofillConfig,
): LEDPosition[] {
  if (!pathElement) return [];

  const s = Math.max(0.1, config.scale);
  const cellW = config.moduleWidth * s + config.spacing;
  const cellH = config.moduleHeight * s + config.spacing;
  if (cellW <= 0 || cellH <= 0) return [];

  const isVertical = config.orientation === 'vertical';
  const rotation = isVertical ? 90 : 0;

  // When vertical, the module is rotated 90 deg so its width becomes the
  // vertical extent and vice-versa. Swap cell dimensions accordingly so the
  // grid spacing still matches the rotated module footprint.
  const gridStepX = isVertical ? cellH : cellW;
  const gridStepY = isVertical ? cellW : cellH;

  const halfCapsule = (config.moduleWidth * s) / 2;
  const cornerR = (config.moduleHeight * s) / 2;
  const testHalfLen = Math.max(0, halfCapsule - cornerR);

  const inset = Math.max(0, config.inset);

  let bbox: { x: number; y: number; width: number; height: number };
  try {
    const b = pathElement.getBBox();
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return [];
    bbox = { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return [];
  }

  const startX = bbox.x + inset + gridStepX / 2;
  const startY = bbox.y + inset + gridStepY / 2;
  const endX = bbox.x + bbox.width - inset;
  const endY = bbox.y + bbox.height - inset;

  const positions: LEDPosition[] = [];

  for (let cy = startY; cy <= endY; cy += gridStepY) {
    for (let cx = startX; cx <= endX; cx += gridStepX) {
      if (!isPointInside(pathElement, cx, cy)) continue;

      if (testHalfLen > 0 && !isCapsuleInside(pathElement, cx, cy, rotation, testHalfLen)) {
        continue;
      }

      positions.push({ x: cx, y: cy, rotation });
    }
  }

  return positions;
}

/**
 * Quick estimate of how many modules the grid will produce.
 * Same logic as generateLEDPositions but only counts (cheaper if the caller
 * just needs the number for a UI preview).
 */
export function estimateGridCount(
  pathElement: SVGPathElement,
  config: AutofillConfig,
): number {
  if (!pathElement) return 0;

  const s = Math.max(0.1, config.scale);
  const cellW = config.moduleWidth * s + config.spacing;
  const cellH = config.moduleHeight * s + config.spacing;
  if (cellW <= 0 || cellH <= 0) return 0;

  const isVertical = config.orientation === 'vertical';
  const gridStepX = isVertical ? cellH : cellW;
  const gridStepY = isVertical ? cellW : cellH;

  const inset = Math.max(0, config.inset);

  let bbox: { x: number; y: number; width: number; height: number };
  try {
    const b = pathElement.getBBox();
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return 0;
    bbox = { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return 0;
  }

  const startX = bbox.x + inset + gridStepX / 2;
  const startY = bbox.y + inset + gridStepY / 2;
  const endX = bbox.x + bbox.width - inset;
  const endY = bbox.y + bbox.height - inset;

  let count = 0;
  for (let cy = startY; cy <= endY; cy += gridStepY) {
    for (let cx = startX; cx <= endX; cx += gridStepX) {
      if (isPointInside(pathElement, cx, cy)) count += 1;
    }
  }
  return count;
}
