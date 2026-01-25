import type { LEDModule } from '../../data/catalog/modules';
import { calculateNormal, isCapsuleInside, isPointInside, type Point } from './geometry';
import { measureStrokeWidth } from './measureStrokeWidth';

export interface LEDPosition extends Point {
  rotation: number; // degrees
}

export interface PlacementConfig {
  targetModule: LEDModule;
  strokeWidth: number; // inches? or pixels? Assuming pixels for canvas logic usually
  pixelsPerInch: number;
  targetCount?: number; // Optional target LED count for per-character adjustment
  columnCount?: number; // Number of parallel LED columns (1-5)
  orientation?: 'horizontal' | 'vertical'; // LED orientation: horizontal (0°) or vertical (90°)
}

import { selectWellSpacedPoints } from './maximin';

/** Extended LED position with stroke width info for multi-column placement */
interface LEDPositionWithWidth extends LEDPosition {
  strokeWidth: number;
  normalX: number; // Normal vector components for column offset
  normalY: number;
}

/**
 * Attempts to find the true center of the stroke at a given path point.
 * Returns a centered LED position with stroke width info, or null if measurement fails.
 */
function findStrokeCenter(
  pathElement: SVGPathElement,
  onPath: Point,
  normal: Point
): LEDPositionWithWidth | null {
  // First, move slightly inward (2px) to ensure we're inside the fill
  const insetDist = 2;

  // Try positive normal direction first
  let testX = onPath.x + normal.x * insetDist;
  let testY = onPath.y + normal.y * insetDist;
  let normalDir = 1;

  if (!isPointInside(pathElement, testX, testY)) {
    // Try negative normal direction
    testX = onPath.x - normal.x * insetDist;
    testY = onPath.y - normal.y * insetDist;
    normalDir = -1;

    if (!isPointInside(pathElement, testX, testY)) {
      return null; // Neither direction works
    }
  }

  // Measure stroke width from this inset point
  const metric = measureStrokeWidth(
    pathElement,
    { x: testX, y: testY },
    { x: normal.x * normalDir, y: normal.y * normalDir }
  );

  // Validate the measurement - reject unrealistic values
  if (metric.width < 6 || metric.width > 200) {
    return null; // Stroke too thin or measurement invalid
  }

  // Calculate center offset: move from current position to true center
  // rightDist is forward along normal, leftDist is backward
  // Center is at (rightDist - leftDist) / 2 from current position
  const centerOffset = (metric.rightDist - metric.leftDist) / 2;

  const centerX = testX + normal.x * normalDir * centerOffset;
  const centerY = testY + normal.y * normalDir * centerOffset;

  // Verify the centered point is still inside the fill
  if (!isPointInside(pathElement, centerX, centerY)) {
    return null;
  }

  const angle = Math.atan2(normal.y * normalDir, normal.x * normalDir) * (180 / Math.PI);

  return {
    x: centerX,
    y: centerY,
    rotation: angle,
    strokeWidth: metric.width,
    normalX: normal.x * normalDir,
    normalY: normal.y * normalDir,
  };
}

/**
 * Fallback position finding using fixed offsets (original algorithm).
 * Used when stroke centering fails.
 */
function findFallbackPosition(
  pathElement: SVGPathElement,
  onPath: Point,
  normal: Point
): LEDPositionWithWidth | null {
  const offsets = [3, 6, 10, 15, 20];

  for (const offset of offsets) {
    // Try positive normal direction
    let testX = onPath.x + normal.x * offset;
    let testY = onPath.y + normal.y * offset;

    if (isPointInside(pathElement, testX, testY)) {
      const angle = Math.atan2(normal.y, normal.x) * (180 / Math.PI);
      return {
        x: testX,
        y: testY,
        rotation: angle,
        strokeWidth: offset * 2, // Estimate stroke width based on offset
        normalX: normal.x,
        normalY: normal.y,
      };
    }

    // Try negative normal direction
    testX = onPath.x - normal.x * offset;
    testY = onPath.y - normal.y * offset;

    if (isPointInside(pathElement, testX, testY)) {
      const angle = Math.atan2(-normal.y, -normal.x) * (180 / Math.PI);
      return {
        x: testX,
        y: testY,
        rotation: angle,
        strokeWidth: offset * 2, // Estimate stroke width based on offset
        normalX: -normal.x,
        normalY: -normal.y,
      };
    }
  }

  return null;
}

/**
 * Expands single-column LED positions to multiple columns.
 * Uses the stroke width and normal vector at each position to calculate offsets.
 */
function expandToMultipleColumns(
  positions: LEDPositionWithWidth[],
  columnCount: number,
  pathElement: SVGPathElement,
  fixedOrientation?: 'horizontal' | 'vertical'
): LEDPosition[] {
  if (columnCount <= 1) {
    // Candidates are already validated with correct rotation
    // Just strip the extra width info and return
    return positions.map(({ x, y, rotation }) => ({ x, y, rotation }));
  }

  const multiColumnPositions: LEDPosition[] = [];

  for (const pos of positions) {
    // Calculate column spacing based on stroke width
    // Use ~65% of measured stroke width for better fill coverage
    const usableWidth = pos.strokeWidth * 0.65;
    const columnSpacing = usableWidth / (columnCount - 1);

    for (let col = 0; col < columnCount; col++) {
      // Offset: -1, 0, +1 for 3 columns; -0.5, +0.5 for 2 columns
      const offset = (col - (columnCount - 1) / 2) * columnSpacing;

      const newX = pos.x + pos.normalX * offset;
      const newY = pos.y + pos.normalY * offset;

      // Apply fixed orientation if set, otherwise use path-derived rotation
      const rotation =
        fixedOrientation === 'horizontal' ? 0 : fixedOrientation === 'vertical' ? 90 : pos.rotation;

      // Verify the full capsule (center + both endpoints) is inside the stroke
      const halfLength =
        fixedOrientation === 'vertical' && pos.strokeWidth < 16
          ? Math.max(3, pos.strokeWidth / 4)
          : 6;
      if (isCapsuleInside(pathElement, newX, newY, rotation, halfLength)) {
        multiColumnPositions.push({
          x: newX,
          y: newY,
          rotation,
        });
      }
    }
  }

  return multiColumnPositions;
}

/**
 * Generates LED positions for a given path using stroke-based distribution.
 * This simulates the "TetraHub" intelligent layout.
 */
export function generateLEDPositions(
  pathElement: SVGPathElement,
  config: PlacementConfig
): LEDPosition[] {
  const pathLength = pathElement.getTotalLength();
  if (pathLength === 0) return [];

  // 1. Configuration - Aggressive density for visual appeal
  // modulesPerFoot affects relative density (more modules/foot = denser placement)
  const baseSpacing = 12; // Tighter base spacing for more LEDs
  const densityFactor = config.targetModule.installation.modulesPerFoot / 3;
  const minSpacingPx = Math.max(8, baseSpacing / densityFactor); // Minimum 8px between LEDs

  // Sample resolution: very fine to capture all curves
  const samplingStepPx = 2;

  const candidates: LEDPositionWithWidth[] = [];
  const numSteps = Math.floor(pathLength / samplingStepPx);

  for (let i = 0; i < numSteps; i++) {
    const dist = i * samplingStepPx;
    const onPath = pathElement.getPointAtLength(dist);
    const normal = calculateNormal(pathElement, dist);

    // 2. Stroke-Centered Placement: Try to find the true center of the stroke
    const centeredPos = findStrokeCenter(pathElement, onPath, normal);

    if (centeredPos) {
      candidates.push(centeredPos);
    } else {
      // Fall back to fixed-offset method if stroke centering fails
      const fallbackPos = findFallbackPosition(pathElement, onPath, normal);
      if (fallbackPos) {
        candidates.push(fallbackPos);
      }
    }
  }

  // 3. If we got very few candidates, fall back to path-following placement
  if (candidates.length < 10) {
    const fallbackSpacing = Math.max(15, pathLength / 50); // At least 50 LEDs or 15px apart
    const fallbackCount = Math.floor(pathLength / fallbackSpacing);

    for (let i = 0; i < fallbackCount; i++) {
      const dist = (i + 0.5) * fallbackSpacing;
      const pt = pathElement.getPointAtLength(dist);
      const normal = calculateNormal(pathElement, dist);
      const angle = Math.atan2(normal.y, normal.x) * (180 / Math.PI);

      // Offset slightly inward
      const inset = 5;
      let cx = pt.x + normal.x * inset;
      let cy = pt.y + normal.y * inset;
      let normX = normal.x;
      let normY = normal.y;

      if (!isPointInside(pathElement, cx, cy)) {
        cx = pt.x - normal.x * inset;
        cy = pt.y - normal.y * inset;
        normX = -normal.x;
        normY = -normal.y;
      }

      // If still not inside, use the path point directly
      if (!isPointInside(pathElement, cx, cy)) {
        cx = pt.x;
        cy = pt.y;
      }

      candidates.push({
        x: cx,
        y: cy,
        rotation: angle,
        strokeWidth: inset * 4, // Estimate for fallback
        normalX: normX,
        normalY: normY,
      });
    }
  }

  // 4. Apply orientation and filter candidates BEFORE spacing selection
  // This ensures we only select from candidates that will actually fit with the chosen orientation
  const columnCount = config.columnCount ?? 1;
  const orientation = config.orientation; // undefined = follow stroke, 'horizontal' = 0°, 'vertical' = 90°

  // Apply fixed orientation to all candidates and filter those that don't fit
  const orientedCandidates = candidates
    .map((c) => ({
      ...c,
      rotation: orientation === 'horizontal' ? 0 : orientation === 'vertical' ? 90 : c.rotation,
    }))
    .filter((c) => {
      // Use adaptive halfLength for vertical orientation on narrow strokes
      const halfLength =
        orientation === 'vertical' && c.strokeWidth < 16 ? Math.max(3, c.strokeWidth / 4) : 6;
      return isCapsuleInside(pathElement, c.x, c.y, c.rotation, halfLength);
    });

  // If no candidates fit with the new orientation, fall back to original candidates
  const validCandidates = orientedCandidates.length > 0 ? orientedCandidates : candidates;

  // 5. Optimize Spacing (Maximin) - use slightly relaxed spacing for fallback paths
  // If targetCount is specified, adjust spacing to achieve target LED count
  if (config.targetCount && config.targetCount > 0) {
    // Adjust target count for single column (will be expanded later)
    const singleColumnTarget = Math.ceil(config.targetCount / columnCount);

    // Calculate spacing that would yield approximately targetCount LEDs
    const targetSpacing = estimateSpacingForCount(
      validCandidates,
      singleColumnTarget,
      minSpacingPx
    );
    const selectedIndices = selectWellSpacedPoints(validCandidates, targetSpacing);

    // Get the selected positions
    let selectedPositions = selectedIndices.map((i) => validCandidates[i]);
    if (selectedPositions.length > singleColumnTarget) {
      // Evenly subsample to get exact target count
      selectedPositions = evenlySubsampleWithWidth(selectedPositions, singleColumnTarget);
    }

    // Expand to multiple columns (candidates already validated for single column)
    return expandToMultipleColumns(selectedPositions, columnCount, pathElement, orientation);
  }

  const effectiveSpacing = validCandidates.length < 20 ? minSpacingPx * 0.7 : minSpacingPx;
  const selectedIndices = selectWellSpacedPoints(validCandidates, effectiveSpacing);

  const selectedPositions = selectedIndices.map((i) => validCandidates[i]);

  // Expand to multiple columns (candidates already validated for single column)
  return expandToMultipleColumns(selectedPositions, columnCount, pathElement, orientation);
}

/**
 * Estimate the spacing needed to achieve approximately targetCount LEDs
 */
function estimateSpacingForCount(
  candidates: LEDPosition[],
  targetCount: number,
  baseSpacing: number
): number {
  if (candidates.length <= targetCount) {
    return 0; // Use all candidates
  }

  // Binary search for the right spacing
  let low = 0;
  let high = baseSpacing * 4;
  let bestSpacing = baseSpacing;

  for (let iter = 0; iter < 20; iter++) {
    const mid = (low + high) / 2;
    const count = selectWellSpacedPoints(candidates, mid).length;

    if (count === targetCount) {
      return mid;
    } else if (count > targetCount) {
      low = mid;
      bestSpacing = mid;
    } else {
      high = mid;
    }
  }

  return bestSpacing;
}

/**
 * Evenly subsample an array of LEDPositionWithWidth to get exactly targetCount items
 */
function evenlySubsampleWithWidth(
  items: LEDPositionWithWidth[],
  targetCount: number
): LEDPositionWithWidth[] {
  if (items.length <= targetCount) return items;

  const result: LEDPositionWithWidth[] = [];
  const step = (items.length - 1) / (targetCount - 1);

  for (let i = 0; i < targetCount; i++) {
    const index = Math.round(i * step);
    result.push(items[index]);
  }

  return result;
}
