/**
 * Dimension calculation utilities for letter measurements
 * Scale: 12.5 pixels = 1 inch (from CanvasStage)
 */

const PIXELS_PER_INCH = 12.5;
const MM_PER_INCH = 25.4;

export interface LetterDimensions {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  widthIn: number;
  heightIn: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate letter dimensions from SVG bounding box
 */
export function calculateLetterDimensions(
  bbox: BoundingBox,
  pixelsPerInch: number = PIXELS_PER_INCH
): LetterDimensions {
  const widthIn = bbox.width / pixelsPerInch;
  const heightIn = bbox.height / pixelsPerInch;
  const widthMm = widthIn * MM_PER_INCH;
  const heightMm = heightIn * MM_PER_INCH;

  return {
    widthPx: bbox.width,
    heightPx: bbox.height,
    widthMm,
    heightMm,
    widthIn,
    heightIn,
  };
}

/**
 * Format dimension value with unit
 */
export function formatDimension(value: number, unit: 'mm' | 'in'): string {
  if (unit === 'mm') {
    return `${value.toFixed(1)} mm`;
  } else {
    return `${value.toFixed(2)}"`;
  }
}

/**
 * Get dimension value based on unit
 */
export function getDimensionValue(
  dimensions: LetterDimensions,
  dimension: 'width' | 'height',
  unit: 'mm' | 'in'
): number {
  if (unit === 'mm') {
    return dimension === 'width' ? dimensions.widthMm : dimensions.heightMm;
  } else {
    return dimension === 'width' ? dimensions.widthIn : dimensions.heightIn;
  }
}
