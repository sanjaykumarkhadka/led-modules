import type { ShapeBBox } from '../../editor/geometry/shapeGeometryAdapter';

export interface PathGeometryAdapter {
  setPath(id: string, pathData: string): void;
  removePath(id: string): void;
  getPathElement(id: string): SVGPathElement | null;
  getBBox(id: string): ShapeBBox | null;
  clear(): void;
  dispose(): void;
}

export function createPathRegistry(): PathGeometryAdapter {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const paths = new Map<string, SVGPathElement>();

  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'fixed';
  svg.style.left = '-100000px';
  svg.style.top = '-100000px';
  svg.style.opacity = '0';
  svg.style.pointerEvents = 'none';
  document.body.appendChild(svg);

  const ensurePath = (id: string) => {
    const existing = paths.get(id);
    if (existing) return existing;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', '#000');
    path.setAttribute('stroke', 'none');
    svg.appendChild(path);
    paths.set(id, path);
    return path;
  };

  return {
    setPath(id, pathData) {
      const path = ensurePath(id);
      path.setAttribute('d', pathData || '');
    },
    removePath(id) {
      const path = paths.get(id);
      if (!path) return;
      if (path.parentNode) path.parentNode.removeChild(path);
      paths.delete(id);
    },
    getPathElement(id) {
      return paths.get(id) ?? null;
    },
    getBBox(id) {
      const path = paths.get(id);
      if (!path) return null;
      try {
        const bbox = path.getBBox();
        if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      } catch {
        return null;
      }
    },
    clear() {
      paths.forEach((path) => {
        if (path.parentNode) path.parentNode.removeChild(path);
      });
      paths.clear();
    },
    dispose() {
      paths.clear();
      if (svg.parentNode) {
        svg.parentNode.removeChild(svg);
      }
    },
  };
}

