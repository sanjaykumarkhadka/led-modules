/**
 * geometry.ts
 * Geometric utilities for SVG path operations.
 */

export interface Point {
  x: number;
  y: number;
}

export type Vector = Point;

/**
 * Calculate the normal vector at a specific distance along an SVG path.
 * Returns a normalized vector perpendicular to the path direction.
 * Points "inward" for clockwise paths (standard for letters), but may need flipping.
 */
export function calculateNormal(
  pathElement: SVGPathElement,
  distance: number,
  delta: number = 0.1
): Vector {
  const totalLength = pathElement.getTotalLength();

  // Clamp sample points
  const d1 = Math.max(0, distance - delta);
  const d2 = Math.min(totalLength, distance + delta);

  const p1 = pathElement.getPointAtLength(d1);
  const p2 = pathElement.getPointAtLength(d2);

  // Tangent vector
  const tx = p2.x - p1.x;
  const ty = p2.y - p1.y;

  // Normalize
  const len = Math.sqrt(tx * tx + ty * ty);
  if (len === 0) return { x: 0, y: 0 };

  const nx = tx / len;
  const ny = ty / len;

  // Rotate 90 degrees clockwise (x, y) -> (y, -x)
  // This assumes standard coordinate system where y is down.
  // Tangent (1, 0) -> Normal (0, -1) [Up]
  // Wait, legacy used (tangent.y, -tangent.x).
  // If tangent is (1,0) [Right], normal is (0, -1) [Up].
  // If tangent is (0,1) [Down], normal is (1, 0) [Right].
  // This seems to point "Left" relative to direction?
  // Let's stick to legacy for consistency.
  return {
    x: ny,
    y: -nx,
  };
}

/**
 * Checks if a point is inside the fill of an SVG path.
 * Rellies on browser DOM API `isPointInFill`.
 */
export function isPointInside(pathElement: SVGPathElement, x: number, y: number): boolean {
  try {
    if (typeof pathElement.isPointInFill === 'function') {
      // We need an SVG point object. We can create one from the ownerSVGElement.
      // If path is not attached, this might fail.
      const svg =
        pathElement.ownerSVGElement ||
        document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return pathElement.isPointInFill(point);
    }
  } catch (e) {
    console.warn('isPointInFill failed', e);
  }
  return false; // Fail safe
}

/**
 * Check if an entire LED capsule (rotated rectangle) is inside a path.
 * Validates center + both endpoints to ensure full containment.
 */
export function isCapsuleInside(
  pathElement: SVGPathElement,
  centerX: number,
  centerY: number,
  rotation: number, // degrees
  halfLength: number = 6 // half capsule width (12px total)
): boolean {
  // Convert rotation to radians
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Calculate both endpoints
  const endpoint1X = centerX - halfLength * cos;
  const endpoint1Y = centerY - halfLength * sin;
  const endpoint2X = centerX + halfLength * cos;
  const endpoint2Y = centerY + halfLength * sin;

  // All three points must be inside
  return (
    isPointInside(pathElement, centerX, centerY) &&
    isPointInside(pathElement, endpoint1X, endpoint1Y) &&
    isPointInside(pathElement, endpoint2X, endpoint2Y)
  );
}

/**
 * Ray-casting helper to find distance from a point to the nearest edge in a specific direction.
 * Uses binary search ray-marching.
 */
export function findDistanceToEdge(
  pathElement: SVGPathElement,
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxDist: number = 1000
): number {
  // First check if we are inside at start
  if (!isPointInside(pathElement, startX, startY)) {
    return 0;
  }

  // LINEAR MARCH to find the first exit.
  // Pure binary search fails on concave shapes (like 'S') because it might
  // sample a point in a different segment of the letter and think we are still "inside" the same stroke.
  // We expect stroke widths to be reasonable (e.g. < 500px).
  const stepSize = 10;
  let firstOutside = -1;

  for (let d = stepSize; d <= maxDist; d += stepSize) {
    const px = startX + dirX * d;
    const py = startY + dirY * d;
    if (!isPointInside(pathElement, px, py)) {
      firstOutside = d;
      break;
    }
  }

  // If we never exited, we might be efficiently bounded or stuck.
  if (firstOutside === -1) {
    return maxDist; // Assumed infinite/large fill
  }

  // BINARY REFINEMENT
  // We know the edge is between (firstOutside - stepSize) and firstOutside.
  let low = firstOutside - stepSize;
  let high = firstOutside;

  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2;
    const px = startX + dirX * mid;
    const py = startY + dirY * mid;

    if (isPointInside(pathElement, px, py)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high; // The 'high' value is the first confirmed outside point (approx)
}
