import type { ManualLED } from '../../data/store';

export interface ManualLedBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hasFiniteUv(led: Pick<ManualLED, 'u' | 'v'>): boolean {
  return Number.isFinite(led.u) && Number.isFinite(led.v);
}

export function resolveManualLedPoint(
  led: ManualLED,
  bbox: ManualLedBBox
): { x: number; y: number } {
  if (hasFiniteUv(led)) {
    return {
      x: bbox.x + led.u * bbox.width,
      y: bbox.y + led.v * bbox.height,
    };
  }
  return {
    x: led.x ?? bbox.x,
    y: led.y ?? bbox.y,
  };
}

