import type { LEDModule } from '../../data/catalog/modules';
import { calculateNormal, isPointInside, type Point } from './geometry';

export interface LEDPosition extends Point {
  rotation: number; // degrees
}

export interface PlacementConfig {
  targetModule: LEDModule;
  strokeWidth: number; // inches? or pixels? Assuming pixels for canvas logic usually
  pixelsPerInch: number;
}

/**
 * Generates LED positions for a given path using stroke-based distribution.
 * This simulates the "TetraHub" intelligent layout.
 */
import { selectWellSpacedPoints } from './maximin';

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

  const candidates: LEDPosition[] = [];
  const numSteps = Math.floor(pathLength / samplingStepPx);

  for (let i = 0; i < numSteps; i++) {
    const dist = i * samplingStepPx;
    const onPath = pathElement.getPointAtLength(dist);
    const normal = calculateNormal(pathElement, dist);

    // 2. Dynamic Stroke Analysis with multiple offset attempts
    const offsets = [3, 6, 10, 15, 20]; // Try multiple inward offsets

    for (const offset of offsets) {
      // Try positive normal direction
      let testX = onPath.x + normal.x * offset;
      let testY = onPath.y + normal.y * offset;

      if (isPointInside(pathElement, testX, testY)) {
        const angle = Math.atan2(normal.y, normal.x) * (180 / Math.PI);
        candidates.push({
          x: testX,
          y: testY,
          rotation: angle,
        });
        break; // Found a valid point, move to next path position
      }

      // Try negative normal direction
      testX = onPath.x - normal.x * offset;
      testY = onPath.y - normal.y * offset;

      if (isPointInside(pathElement, testX, testY)) {
        const angle = Math.atan2(-normal.y, -normal.x) * (180 / Math.PI);
        candidates.push({
          x: testX,
          y: testY,
          rotation: angle,
        });
        break;
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

      if (!isPointInside(pathElement, cx, cy)) {
        cx = pt.x - normal.x * inset;
        cy = pt.y - normal.y * inset;
      }

      // If still not inside, use the path point directly
      if (!isPointInside(pathElement, cx, cy)) {
        cx = pt.x;
        cy = pt.y;
      }

      candidates.push({ x: cx, y: cy, rotation: angle });
    }
  }

  // 4. Optimize Spacing (Maximin) - use slightly relaxed spacing for fallback paths
  const effectiveSpacing = candidates.length < 20 ? minSpacingPx * 0.7 : minSpacingPx;
  const selectedIndices = selectWellSpacedPoints(candidates, effectiveSpacing);

  return selectedIndices.map((i) => candidates[i]);
}
