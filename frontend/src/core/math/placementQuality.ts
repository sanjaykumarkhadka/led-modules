import { findDistanceToEdge, isCapsuleInside } from './geometry';
import type { LEDPosition } from './placement';

export interface PlacementQuality {
  insideRate: number;
  minClearance: number;
  meanClearance: number;
  symmetryMean: number;
  nnMean: number;
  nnCv: number;
  count: number;
}

export interface PlacementQualityThresholds {
  insideRate: number;
  minClearance: number;
  symmetryMean: number;
  nnCv: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: PlacementQualityThresholds = {
  insideRate: 0.98,
  minClearance: 0.6,
  symmetryMean: 0.45,
  nnCv: 0.45,
};

const LED_RENDER_LENGTH = 12;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], meanValue: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - meanValue) * (v - meanValue), 0) / values.length;
  return Math.sqrt(variance);
}

function nearestNeighborDistances(points: LEDPosition[]): number[] {
  const distances: number[] = [];
  for (let i = 0; i < points.length; i++) {
    let best = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const d = Math.hypot(dx, dy);
      if (d < best) best = d;
    }
    if (isFinite(best)) distances.push(best);
  }
  return distances;
}

export function evaluatePlacementQuality(
  pathElement: SVGPathElement,
  leds: LEDPosition[]
): PlacementQuality {
  const count = leds.length;
  if (count === 0) {
    return {
      insideRate: 0,
      minClearance: 0,
      meanClearance: 0,
      symmetryMean: 0,
      nnMean: 0,
      nnCv: 0,
      count: 0,
    };
  }

  const bbox = pathElement.getBBox();
  const maxDist = Math.max(bbox.width, bbox.height) * 1.5 + 20;

  let insideCount = 0;
  const clearances: number[] = [];
  const symmetries: number[] = [];

  for (const led of leds) {
    if (isCapsuleInside(pathElement, led.x, led.y, led.rotation, LED_RENDER_LENGTH / 2)) {
      insideCount += 1;
    }

    const dxp = findDistanceToEdge(pathElement, led.x, led.y, 1, 0, maxDist);
    const dxn = findDistanceToEdge(pathElement, led.x, led.y, -1, 0, maxDist);
    const dyp = findDistanceToEdge(pathElement, led.x, led.y, 0, 1, maxDist);
    const dyn = findDistanceToEdge(pathElement, led.x, led.y, 0, -1, maxDist);

    const clearance = Math.min(dxp, dxn, dyp, dyn);
    clearances.push(clearance);

    const symmetryX = (dxp + dxn) > 0 ? 1 - Math.abs(dxp - dxn) / (dxp + dxn) : 0;
    const symmetryY = (dyp + dyn) > 0 ? 1 - Math.abs(dyp - dyn) / (dyp + dyn) : 0;
    symmetries.push(Math.max(symmetryX, symmetryY));
  }

  const nnDistances = nearestNeighborDistances(leds);
  const nnMean = mean(nnDistances);
  const nnStd = stdDev(nnDistances, nnMean);

  return {
    insideRate: insideCount / count,
    minClearance: Math.min(...clearances),
    meanClearance: mean(clearances),
    symmetryMean: mean(symmetries),
    nnMean,
    nnCv: nnMean > 0 ? nnStd / nnMean : 0,
    count,
  };
}

export function gradePlacement(
  quality: PlacementQuality,
  thresholds: PlacementQualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];

  if (quality.insideRate < thresholds.insideRate) {
    failures.push(`insideRate < ${thresholds.insideRate.toFixed(2)}`);
  }
  if (quality.minClearance < thresholds.minClearance) {
    failures.push(`minClearance < ${thresholds.minClearance.toFixed(2)}`);
  }
  if (quality.symmetryMean < thresholds.symmetryMean) {
    failures.push(`symmetryMean < ${thresholds.symmetryMean.toFixed(2)}`);
  }
  if (quality.nnCv > thresholds.nnCv) {
    failures.push(`nnCv > ${thresholds.nnCv.toFixed(2)}`);
  }

  return { pass: failures.length === 0, failures };
}
