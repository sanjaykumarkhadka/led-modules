import { isCapsuleInside, isPointInside } from '../../../core/math/geometry';

export interface ShapeBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeGeometryAdapter {
  setPath(pathData: string): void;
  getPathElement(): SVGPathElement | null;
  getBBox(): ShapeBBox | null;
  isPointInside(x: number, y: number): boolean;
  isCapsuleInside(centerX: number, centerY: number, rotation: number, halfLength: number): boolean;
  dispose(): void;
}

/**
 * Hidden SVG-backed geometry adapter. Keeps SVG-native geometry correctness
 * while allowing alternate render/interaction layers (e.g. Konva).
 */
export function createShapeGeometryAdapter(): ShapeGeometryAdapter {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'fixed';
  svg.style.left = '-100000px';
  svg.style.top = '-100000px';
  svg.style.opacity = '0';
  svg.style.pointerEvents = 'none';

  path.setAttribute('fill', '#000');
  path.setAttribute('stroke', 'none');
  svg.appendChild(path);
  document.body.appendChild(svg);

  return {
    setPath(pathData: string) {
      path.setAttribute('d', pathData || '');
    },
    getPathElement() {
      return path;
    },
    getBBox() {
      try {
        const bbox = path.getBBox();
        if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      } catch {
        return null;
      }
    },
    isPointInside(x: number, y: number) {
      try {
        return isPointInside(path, x, y);
      } catch {
        return false;
      }
    },
    isCapsuleInside(centerX: number, centerY: number, rotation: number, halfLength: number) {
      try {
        return isCapsuleInside(path, centerX, centerY, rotation, halfLength);
      } catch {
        return false;
      }
    },
    dispose() {
      if (svg.parentNode) {
        svg.parentNode.removeChild(svg);
      }
    },
  };
}

