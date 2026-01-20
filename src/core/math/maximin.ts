import type { Point } from './geometry';

/**
 * Calculates Euclidean distance squared between two points.
 * (Squared is faster for comparisons)
 */
function distSq(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

/**
 * Selects a set of points from candidates that are maximally separated.
 * @param candidates Array of possible LED positions
 * @param minSpacing Minimum allowed distance between LEDs
 * @returns Array of selected indices from the candidates array
 */
export function selectWellSpacedPoints(candidates: Point[], minSpacing: number): number[] {
  if (candidates.length === 0) return [];

  const selectedIndices: number[] = [];
  const minSpacingSq = minSpacing * minSpacing;

  // 1. Pick the first point (usually the start of the path/stroke)
  // Heuristic: Pick the one closest to the 'start' if sorted, or just index 0
  selectedIndices.push(0);

  // 2. Greedy selection
  // For a pure maximin, we'd rescan everything every time (O(N^2)).
  // For this use case (streaming along a path), we can just check against the *last* selected point
  // IF the candidates are ordered along the path.
  // BUT, if candidates are a cloud (e.g. from multiple strokes or crossing paths), we need full check.

  // Let's assume ordered candidates (skeleton path) first for speed,
  // but check against ALL previously selected to avoid "loop closing" collisions (e.g. 'O' shape).

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    let tooClose = false;

    // Check against all existing points (robustness for loops)
    // Optimization: Check reverse order, as neighbors are most likely culprits
    for (let j = selectedIndices.length - 1; j >= 0; j--) {
      const existingIndex = selectedIndices[j];
      const existing = candidates[existingIndex];

      if (distSq(candidate, existing) < minSpacingSq) {
        tooClose = true;
        break;
      }

      // Optimization: If we are far away from the last point, but close to an old point (loop)?
      // We can't easily break early without spatial partitioning if strictly checking all.
      // But for simple letters, checking the last 5-10 points might be enough?
      // Let's stay safe and check all for now (N is small, < 100 leds).
    }

    if (!tooClose) {
      selectedIndices.push(i);
    }
  }

  return selectedIndices;
}
