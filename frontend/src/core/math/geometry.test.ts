import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNormal } from './geometry';

describe('Geometry Utils', () => {
  let pathElement: SVGPathElement;

  beforeEach(() => {
    // Create a real DOM element
    pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Mock unimplemented methods in jsdom
    pathElement.getTotalLength = vi.fn().mockReturnValue(100);
    pathElement.getPointAtLength = vi.fn(
      (dist) =>
        ({
          x: dist,
          y: 0,
          w: 1,
          z: 0,
          matrixTransform: vi.fn(),
          toJSON: vi.fn(),
        }) as unknown as DOMPoint
    ); // Straight horizontal line logic for simplicity
  });

  it('should calculate normal for a horizontal line', () => {
    // Line going from (0,0) to (100,0)
    // Tangent is (1, 0)
    // Normal should be (0, -1) [Up] in our coordinate system logic

    const normal = calculateNormal(pathElement, 50);

    expect(normal.x).toBeCloseTo(0);
    expect(normal.y).toBeCloseTo(-1);
  });

  it('should handle edge cases at start of path', () => {
    const normal = calculateNormal(pathElement, 0);
    expect(normal.x).toBeCloseTo(0);
    expect(normal.y).toBeCloseTo(-1);
  });
});
