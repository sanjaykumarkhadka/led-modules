import { findDistanceToEdge, type Point } from './geometry';

export interface StrokeMetric {
  center: Point;
  width: number; // The visual width of the stroke at this point
  leftDist: number; // Distance to "left" edge (relative to normal)
  rightDist: number; // Distance to "right" edge
}

/**
 * Calculates the stroke width at a specific point on the path skeleton.
 * uses ray-casting along the normal vector.
 */
export function measureStrokeWidth(
  pathElement: SVGPathElement,
  point: Point,
  normal: Point
): StrokeMetric {
  // Normal points "inward" or "outward" - we check both directions along the normal line.
  // The "Normal" from calculateNormal usually points orthogonal to the path direction.

  // Check "Forward" direction along normal
  const dist1 = findDistanceToEdge(pathElement, point.x, point.y, normal.x, normal.y);

  // Check "Backward" direction (opposite normal)
  const dist2 = findDistanceToEdge(pathElement, point.x, point.y, -normal.x, -normal.y);

  return {
    center: point,
    width: dist1 + dist2,
    leftDist: dist2, // purely convention
    rightDist: dist1,
  };
}
