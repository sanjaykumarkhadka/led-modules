/**
 * Technical Drawing Generator for PDF Export
 * Draws clean technical-style visualizations directly to jsPDF
 */

import { jsPDF } from 'jspdf';
import type { BlockCharPaths, CharLEDData, TextBlock } from '../data/store';

interface TechnicalDrawingData {
  blockCharPaths: BlockCharPaths[];
  charLeds: CharLEDData[];
  blocks: TextBlock[];
}

interface DrawingOptions {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

// Visual specs
const SPECS = {
  letterStrokeWidth: 0.5, // pt
  letterStrokeColor: '#000000',
  ledModuleWidth: 3, // mm
  ledModuleHeight: 1.5, // mm
  ledModuleRadius: 0.3, // mm
  ledModuleFill: '#cccccc',
  ledModuleStroke: '#666666',
  labelFontSize: 8, // pt
  dimensionFontSize: 9, // pt
  dimensionColor: '#333333',
  extensionLineOffset: 3, // mm
  arrowSize: 2, // mm
};

// SVG viewBox dimensions (from CanvasStage)
const SVG_WIDTH = 800;
const SVG_HEIGHT = 600;
const PIXELS_PER_INCH = 12.5;

/**
 * Calculate overall bounding box from all character paths
 */
function calculateBoundingBox(blockCharPaths: BlockCharPaths[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  blockCharPaths.forEach(({ charPaths }) => {
    charPaths.forEach((cp) => {
      if (cp.bbox) {
        minX = Math.min(minX, cp.bbox.x);
        minY = Math.min(minY, cp.bbox.y);
        maxX = Math.max(maxX, cp.bbox.x + cp.bbox.width);
        maxY = Math.max(maxY, cp.bbox.y + cp.bbox.height);
      }
    });
  });

  // Fallback if no bboxes
  if (!isFinite(minX)) {
    return {
      minX: 0,
      minY: 0,
      maxX: SVG_WIDTH,
      maxY: SVG_HEIGHT,
      width: SVG_WIDTH,
      height: SVG_HEIGHT,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Parse SVG path and draw to jsPDF
 * Supports M, L, C, Q, Z commands (most common from opentype.js)
 */
function drawSVGPath(
  doc: jsPDF,
  pathData: string,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  if (!pathData) return;

  // Parse path commands
  const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];

  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  const transformX = (x: number) => offsetX + x * scale;
  const transformY = (y: number) => offsetY + y * scale;

  commands.forEach((cmd) => {
    const type = cmd[0].toUpperCase();
    const isRelative = cmd[0] === cmd[0].toLowerCase();
    const params = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter((p) => p !== '')
      .map(parseFloat);

    switch (type) {
      case 'M': {
        // MoveTo
        if (isRelative) {
          currentX += params[0];
          currentY += params[1];
        } else {
          currentX = params[0];
          currentY = params[1];
        }
        startX = currentX;
        startY = currentY;

        // Handle implicit LineTo commands after MoveTo
        for (let i = 2; i < params.length; i += 2) {
          const x = isRelative ? currentX + params[i] : params[i];
          const y = isRelative ? currentY + params[i + 1] : params[i + 1];
          doc.line(transformX(currentX), transformY(currentY), transformX(x), transformY(y));
          currentX = x;
          currentY = y;
        }
        break;
      }
      case 'L': {
        // LineTo
        for (let i = 0; i < params.length; i += 2) {
          const x = isRelative ? currentX + params[i] : params[i];
          const y = isRelative ? currentY + params[i + 1] : params[i + 1];
          doc.line(transformX(currentX), transformY(currentY), transformX(x), transformY(y));
          currentX = x;
          currentY = y;
        }
        break;
      }
      case 'H': {
        // Horizontal LineTo
        params.forEach((x) => {
          const newX = isRelative ? currentX + x : x;
          doc.line(
            transformX(currentX),
            transformY(currentY),
            transformX(newX),
            transformY(currentY)
          );
          currentX = newX;
        });
        break;
      }
      case 'V': {
        // Vertical LineTo
        params.forEach((y) => {
          const newY = isRelative ? currentY + y : y;
          doc.line(
            transformX(currentX),
            transformY(currentY),
            transformX(currentX),
            transformY(newY)
          );
          currentY = newY;
        });
        break;
      }
      case 'C': {
        // Cubic Bezier - approximate with line segments
        for (let i = 0; i < params.length; i += 6) {
          const x1 = isRelative ? currentX + params[i] : params[i];
          const y1 = isRelative ? currentY + params[i + 1] : params[i + 1];
          const x2 = isRelative ? currentX + params[i + 2] : params[i + 2];
          const y2 = isRelative ? currentY + params[i + 3] : params[i + 3];
          const x = isRelative ? currentX + params[i + 4] : params[i + 4];
          const y = isRelative ? currentY + params[i + 5] : params[i + 5];

          // Draw bezier as multiple line segments
          drawCubicBezier(doc, currentX, currentY, x1, y1, x2, y2, x, y, offsetX, offsetY, scale);
          currentX = x;
          currentY = y;
        }
        break;
      }
      case 'Q': {
        // Quadratic Bezier - approximate with line segments
        for (let i = 0; i < params.length; i += 4) {
          const x1 = isRelative ? currentX + params[i] : params[i];
          const y1 = isRelative ? currentY + params[i + 1] : params[i + 1];
          const x = isRelative ? currentX + params[i + 2] : params[i + 2];
          const y = isRelative ? currentY + params[i + 3] : params[i + 3];

          // Draw quadratic bezier as multiple line segments
          drawQuadraticBezier(doc, currentX, currentY, x1, y1, x, y, offsetX, offsetY, scale);
          currentX = x;
          currentY = y;
        }
        break;
      }
      case 'Z': {
        // ClosePath
        doc.line(
          transformX(currentX),
          transformY(currentY),
          transformX(startX),
          transformY(startY)
        );
        currentX = startX;
        currentY = startY;
        break;
      }
    }
  });
}

/**
 * Draw cubic bezier curve as line segments
 */
function drawCubicBezier(
  doc: jsPDF,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  const segments = 12;
  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;

    doc.line(
      offsetX + prevX * scale,
      offsetY + prevY * scale,
      offsetX + x * scale,
      offsetY + y * scale
    );

    prevX = x;
    prevY = y;
  }
}

/**
 * Draw quadratic bezier curve as line segments
 */
function drawQuadraticBezier(
  doc: jsPDF,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  const segments = 10;
  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;

    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;

    doc.line(
      offsetX + prevX * scale,
      offsetY + prevY * scale,
      offsetX + x * scale,
      offsetY + y * scale
    );

    prevX = x;
    prevY = y;
  }
}

/**
 * Draw letter outlines (stroke only, no fill)
 */
function drawLetterOutlines(
  doc: jsPDF,
  blockCharPaths: BlockCharPaths[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  doc.setDrawColor(SPECS.letterStrokeColor);
  doc.setLineWidth(SPECS.letterStrokeWidth * 0.352778); // pt to mm

  blockCharPaths.forEach(({ charPaths }) => {
    charPaths.forEach((cp) => {
      if (cp.pathData) {
        drawSVGPath(doc, cp.pathData, offsetX, offsetY, scale);
      }
    });
  });
}

/**
 * Draw LED modules as capsule shapes with end dots
 */
function drawLEDModules(
  doc: jsPDF,
  charLeds: CharLEDData[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  // Capsule dimensions (matching canvas: 12x5 px capsule)
  const moduleW = SPECS.ledModuleWidth; // 3mm width
  const moduleH = SPECS.ledModuleHeight; // 1.5mm height
  const capsuleRadius = moduleH / 2; // Fully rounded ends for pill shape
  const dotRadius = 0.35; // Small dots at each end
  const dotOffset = moduleW / 2 - capsuleRadius; // Position dots near ends

  charLeds.forEach(({ leds }) => {
    leds.forEach((led) => {
      const cx = offsetX + led.x * scale;
      const cy = offsetY + led.y * scale;

      doc.saveGraphicsState();

      // 1. Capsule outline (stroke only, no fill)
      doc.setDrawColor(SPECS.ledModuleStroke);
      doc.setLineWidth(0.15);
      doc.roundedRect(
        cx - moduleW / 2,
        cy - moduleH / 2,
        moduleW,
        moduleH,
        capsuleRadius,
        capsuleRadius,
        'S' // Stroke only
      );

      // 2. Left dot
      doc.setFillColor(SPECS.ledModuleStroke);
      doc.circle(cx - dotOffset, cy, dotRadius, 'F');

      // 3. Right dot
      doc.circle(cx + dotOffset, cy, dotRadius, 'F');

      doc.restoreGraphicsState();
    });
  });
}

/**
 * Draw per-character LED count labels below each letter
 */
function drawLEDCountLabels(
  doc: jsPDF,
  blockCharPaths: BlockCharPaths[],
  charLeds: CharLEDData[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  doc.setFontSize(SPECS.labelFontSize);
  doc.setTextColor('#333333');
  doc.setFont('helvetica', 'normal');

  // Create LED count lookup
  const ledCounts = new Map<string, number>();
  charLeds.forEach(({ charId, leds }) => {
    ledCounts.set(charId, leds.length);
  });

  blockCharPaths.forEach(({ blockId, charPaths }) => {
    charPaths.forEach((cp) => {
      if (!cp.bbox || !cp.pathData) return; // Skip spaces

      const charId = `${blockId}-${cp.charIndex}`;
      const count = ledCounts.get(charId) || 0;

      // Position label below the character
      const labelX = offsetX + (cp.bbox.x + cp.bbox.width / 2) * scale;
      const labelY = offsetY + (cp.bbox.y + cp.bbox.height) * scale + 4; // 4mm below

      doc.text(String(count), labelX, labelY, { align: 'center' });
    });
  });
}

/**
 * Draw per-character height dimension annotations above each letter
 */
function drawPerCharacterHeightDimensions(
  doc: jsPDF,
  blockCharPaths: BlockCharPaths[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  doc.setDrawColor(SPECS.dimensionColor);
  doc.setLineWidth(0.15);
  doc.setFillColor(SPECS.dimensionColor);

  const arrowH = SPECS.arrowSize * 0.7;
  const arrowW = SPECS.arrowSize * 0.35;

  blockCharPaths.forEach(({ charPaths }) => {
    charPaths.forEach((cp) => {
      if (!cp.bbox || !cp.pathData) return; // Skip spaces

      // Calculate character height in inches
      const charHeightInches = cp.bbox.height / PIXELS_PER_INCH;

      // Position for the dimension line (to the left of the character)
      const charLeftX = offsetX + cp.bbox.x * scale;
      const dimLineX = charLeftX - 2; // 2mm to the left of the character
      const topY = offsetY + cp.bbox.y * scale;
      const bottomY = offsetY + (cp.bbox.y + cp.bbox.height) * scale;

      // Extension lines (short horizontal lines at top and bottom)
      doc.line(charLeftX - 0.5, topY, dimLineX - 1, topY);
      doc.line(charLeftX - 0.5, bottomY, dimLineX - 1, bottomY);

      // Main vertical dimension line
      doc.line(dimLineX, topY + arrowH, dimLineX, bottomY - arrowH);

      // Top arrow pointing up
      doc.triangle(
        dimLineX,
        topY,
        dimLineX - arrowW,
        topY + arrowH,
        dimLineX + arrowW,
        topY + arrowH,
        'F'
      );

      // Bottom arrow pointing down
      doc.triangle(
        dimLineX,
        bottomY,
        dimLineX - arrowW,
        bottomY - arrowH,
        dimLineX + arrowW,
        bottomY - arrowH,
        'F'
      );

      // Dimension text (placed above the character, centered)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(SPECS.dimensionColor);

      const dimText = `${charHeightInches.toFixed(1)}"`;
      const labelX = offsetX + (cp.bbox.x + cp.bbox.width / 2) * scale;
      const labelY = topY - 2; // 2mm above the character

      doc.text(dimText, labelX, labelY, { align: 'center' });
    });
  });
}

/**
 * Main function: Draw technical layout to PDF
 */
export function drawTechnicalLayout(
  doc: jsPDF,
  data: TechnicalDrawingData,
  options: DrawingOptions
): void {
  const { blockCharPaths, charLeds } = data;
  const { x, y, maxWidth, maxHeight } = options;

  if (blockCharPaths.length === 0) {
    // No content to draw
    doc.setFontSize(12);
    doc.setTextColor('#666666');
    doc.text('No LED layout generated', x + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
    return;
  }

  // Calculate bounding box of all content
  const bbox = calculateBoundingBox(blockCharPaths);

  // Calculate scale factor to fit in available space
  // Leave some padding for dimension annotations
  const leftPadding = 8; // mm for per-character dimension lines
  const topPadding = 8; // mm for height labels above letters
  const bottomPadding = 10; // mm for LED count labels
  const availableWidth = maxWidth - leftPadding;
  const availableHeight = maxHeight - bottomPadding - topPadding;

  const scaleX = availableWidth / bbox.width;
  const scaleY = availableHeight / bbox.height;
  const scale = Math.min(scaleX, scaleY);

  // Calculate offset to center the drawing
  const drawingWidth = bbox.width * scale;
  const drawingHeight = bbox.height * scale;

  const offsetX = x + leftPadding + (availableWidth - drawingWidth) / 2 - bbox.minX * scale;
  const offsetY = y + topPadding + (availableHeight - drawingHeight) / 2 - bbox.minY * scale;

  // Draw components in order (back to front)

  // 1. Letter outlines (stroke only)
  drawLetterOutlines(doc, blockCharPaths, offsetX, offsetY, scale);

  // 2. LED modules
  drawLEDModules(doc, charLeds, offsetX, offsetY, scale);

  // 3. LED count labels below letters
  drawLEDCountLabels(doc, blockCharPaths, charLeds, offsetX, offsetY, scale);

  // 4. Per-character height dimensions
  drawPerCharacterHeightDimensions(doc, blockCharPaths, offsetX, offsetY, scale);
}
