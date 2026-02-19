import type { EditorViewportTransform, RectBounds } from './types';

export function getViewportTransform(
  viewport: { width: number; height: number },
  viewBox: RectBounds
): EditorViewportTransform {
  const scale = Math.min(
    viewport.width / Math.max(1, viewBox.width),
    viewport.height / Math.max(1, viewBox.height)
  );

  return {
    scale,
    x: (viewport.width - viewBox.width * scale) / 2 - viewBox.x * scale,
    y: (viewport.height - viewBox.height * scale) / 2 - viewBox.y * scale,
  };
}

export function toWorldPoint(
  point: { x: number; y: number },
  transform: EditorViewportTransform
): { x: number; y: number } {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}

