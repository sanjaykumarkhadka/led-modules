import type { Font } from 'opentype.js';

// Fallback letter paths (block letters at scale 100)
const FALLBACK_LETTERS: Record<string, string> = {
  A: 'M0,100 L20,0 L40,0 L60,100 L48,100 L42,75 L18,75 L12,100 Z M22,60 L38,60 L30,25 Z',
  B: 'M0,0 L40,0 Q60,0 60,20 Q60,40 45,45 Q65,50 65,70 Q65,100 40,100 L0,100 Z M15,15 L15,40 L35,40 Q45,40 45,27.5 Q45,15 35,15 Z M15,55 L15,85 L38,85 Q50,85 50,70 Q50,55 38,55 Z',
  C: 'M60,20 Q60,0 35,0 Q0,0 0,50 Q0,100 35,100 Q60,100 60,80 L45,80 Q45,85 35,85 Q15,85 15,50 Q15,15 35,15 Q45,15 45,20 Z',
  D: 'M0,0 L30,0 Q65,0 65,50 Q65,100 30,100 L0,100 Z M15,15 L15,85 L28,85 Q50,85 50,50 Q50,15 28,15 Z',
  E: 'M0,0 L60,0 L60,15 L15,15 L15,42 L50,42 L50,57 L15,57 L15,85 L60,85 L60,100 L0,100 Z',
  F: 'M0,0 L60,0 L60,15 L15,15 L15,42 L50,42 L50,57 L15,57 L15,100 L0,100 Z',
  G: 'M60,20 Q60,0 35,0 Q0,0 0,50 Q0,100 35,100 Q65,100 65,60 L35,60 L35,75 L50,75 L50,85 Q50,85 35,85 Q15,85 15,50 Q15,15 35,15 Q45,15 45,20 Z',
  H: 'M0,0 L15,0 L15,42 L45,42 L45,0 L60,0 L60,100 L45,100 L45,57 L15,57 L15,100 L0,100 Z',
  I: 'M0,0 L40,0 L40,15 L27.5,15 L27.5,85 L40,85 L40,100 L0,100 L0,85 L12.5,85 L12.5,15 L0,15 Z',
  J: 'M30,0 L60,0 L60,15 L45,15 L45,70 Q45,85 30,85 Q15,85 15,70 L0,70 Q0,100 30,100 Q60,100 60,70 L60,0 Z',
  K: 'M0,0 L15,0 L15,40 L40,0 L60,0 L30,45 L60,100 L40,100 L18,55 L15,58 L15,100 L0,100 Z',
  L: 'M0,0 L15,0 L15,85 L60,85 L60,100 L0,100 Z',
  M: 'M0,0 L15,0 L30,40 L45,0 L60,0 L60,100 L45,100 L45,30 L30,65 L15,30 L15,100 L0,100 Z',
  N: 'M0,0 L15,0 L45,70 L45,0 L60,0 L60,100 L45,100 L15,30 L15,100 L0,100 Z',
  O: 'M30,0 Q65,0 65,50 Q65,100 30,100 Q-5,100 -5,50 Q-5,0 30,0 Z M30,15 Q12,15 12,50 Q12,85 30,85 Q48,85 48,50 Q48,15 30,15 Z',
  P: 'M0,0 L40,0 Q65,0 65,30 Q65,60 40,60 L15,60 L15,100 L0,100 Z M15,15 L15,45 L38,45 Q50,45 50,30 Q50,15 38,15 Z',
  Q: 'M30,0 Q65,0 65,50 Q65,85 50,95 L60,105 L50,115 L38,100 Q35,100 30,100 Q-5,100 -5,50 Q-5,0 30,0 Z M30,15 Q12,15 12,50 Q12,85 30,85 Q48,85 48,50 Q48,15 30,15 Z',
  R: 'M0,0 L40,0 Q65,0 65,30 Q65,55 50,58 L65,100 L48,100 L35,60 L15,60 L15,100 L0,100 Z M15,15 L15,45 L38,45 Q50,45 50,30 Q50,15 38,15 Z',
  S: 'M55,20 Q55,0 30,0 Q5,0 5,25 Q5,45 25,50 L40,55 Q50,58 50,70 Q50,85 30,85 Q15,85 15,75 L0,75 Q0,100 30,100 Q60,100 60,70 Q60,52 40,47 L25,42 Q15,39 15,27 Q15,15 30,15 Q45,15 45,25 Z',
  T: 'M0,0 L60,0 L60,15 L37.5,15 L37.5,100 L22.5,100 L22.5,15 L0,15 Z',
  U: 'M0,0 L15,0 L15,65 Q15,85 30,85 Q45,85 45,65 L45,0 L60,0 L60,65 Q60,100 30,100 Q0,100 0,65 Z',
  V: 'M0,0 L15,0 L30,75 L45,0 L60,0 L35,100 L25,100 Z',
  W: 'M0,0 L12,0 L20,65 L30,20 L40,65 L48,0 L60,0 L45,100 L35,100 L30,55 L25,100 L15,100 Z',
  X: 'M0,0 L18,0 L30,35 L42,0 L60,0 L40,50 L60,100 L42,100 L30,65 L18,100 L0,100 L20,50 Z',
  Y: 'M0,0 L18,0 L30,40 L42,0 L60,0 L37.5,55 L37.5,100 L22.5,100 L22.5,55 Z',
  Z: 'M0,0 L60,0 L60,15 L20,85 L60,85 L60,100 L0,100 L0,85 L40,15 L0,15 Z',
  '0': 'M30,0 Q65,0 65,50 Q65,100 30,100 Q-5,100 -5,50 Q-5,0 30,0 Z M30,15 Q12,15 12,50 Q12,85 30,85 Q48,85 48,50 Q48,15 30,15 Z',
  '1': 'M15,0 L35,0 L35,85 L50,85 L50,100 L10,100 L10,85 L20,85 L20,20 L10,25 L10,10 Z',
  '2': 'M5,25 Q5,0 30,0 Q55,0 55,25 Q55,45 30,60 L10,75 L10,85 L55,85 L55,100 L0,100 L0,70 L35,45 Q40,40 40,30 Q40,15 30,15 Q20,15 20,25 Z',
  '3': 'M5,25 Q5,0 30,0 Q55,0 55,25 Q55,42 42,47 Q55,52 55,70 Q55,100 30,100 Q5,100 5,75 L20,75 Q20,85 30,85 Q40,85 40,70 Q40,55 25,55 L25,42 Q40,42 40,30 Q40,15 30,15 Q20,15 20,25 Z',
  '4': 'M40,0 L55,0 L55,100 L40,100 L40,70 L0,70 L0,55 L40,0 Z M40,20 L15,55 L40,55 Z',
  '5': 'M5,0 L55,0 L55,15 L20,15 L20,40 L40,40 Q60,40 60,70 Q60,100 30,100 Q5,100 5,80 L20,80 Q20,85 30,85 Q45,85 45,70 Q45,55 30,55 L5,55 Z',
  '6': 'M55,25 Q55,0 30,0 Q5,0 5,50 Q5,100 30,100 Q55,100 55,75 Q55,50 30,50 Q20,50 20,55 L20,50 Q20,15 30,15 Q40,15 40,25 Z M30,65 Q40,65 40,75 Q40,85 30,85 Q20,85 20,75 Q20,65 30,65 Z',
  '7': 'M0,0 L60,0 L60,15 L25,100 L10,100 L42,20 L42,15 L0,15 Z',
  '8': 'M30,0 Q55,0 55,22 Q55,40 42,47 Q55,54 55,75 Q55,100 30,100 Q5,100 5,75 Q5,54 18,47 Q5,40 5,22 Q5,0 30,0 Z M30,15 Q20,15 20,25 Q20,38 30,42 Q40,38 40,25 Q40,15 30,15 Z M30,58 Q20,58 20,72 Q20,85 30,85 Q40,85 40,72 Q40,58 30,58 Z',
  '9': 'M5,75 Q5,100 30,100 Q55,100 55,50 Q55,0 30,0 Q5,0 5,25 Q5,50 30,50 Q40,50 40,45 L40,50 Q40,85 30,85 Q20,85 20,75 Z M30,35 Q20,35 20,25 Q20,15 30,15 Q40,15 40,25 Q40,35 30,35 Z',
  ' ': '',
};

export interface CharacterPath {
  char: string;
  charIndex: number;
  charId?: string;
  pathData: string;
  x: number;
  width: number;
  advanceWidth: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export function generatePositionedCharacterPath(
  glyph: string,
  font: Font | null,
  startX: number,
  baselineY: number,
  fontSize: number,
  charId?: string
): CharacterPath {
  if (font) {
    const glyphModel = font.charToGlyph(glyph);
    const path = glyphModel.getPath(startX, baselineY, fontSize);
    const pathData = path.toPathData(2);
    const scale = fontSize / font.unitsPerEm;
    const glyphBbox = glyphModel.getBoundingBox();
    const glyphWidth = (glyphBbox.x2 - glyphBbox.x1) * scale;
    const advanceWidth = (glyphModel.advanceWidth || font.unitsPerEm * 0.6) * scale;
    const bboxX = startX + glyphBbox.x1 * scale;
    const bboxY = baselineY - glyphBbox.y2 * scale;
    const bboxHeight = (glyphBbox.y2 - glyphBbox.y1) * scale;
    return {
      char: glyph,
      charIndex: 0,
      charId,
      pathData,
      x: startX,
      width: glyphWidth,
      advanceWidth,
      bbox: {
        x: bboxX,
        y: bboxY,
        width: glyphWidth,
        height: bboxHeight,
      },
    };
  }

  const fallbackPathData = generateFallbackCharPath(glyph, startX, baselineY, fontSize);
  const width = fontSize * 0.7;
  return {
    char: glyph,
    charIndex: 0,
    charId,
    pathData: fallbackPathData,
    x: startX,
    width,
    advanceWidth: width + fontSize * 0.1,
    bbox: {
      x: startX,
      y: baselineY - fontSize,
      width,
      height: fontSize,
    },
  };
}

/**
 * Generate path for a single character with transformation (fallback method)
 */
function generateFallbackCharPath(char: string, x: number, y: number, scale: number): string {
  const basePath = FALLBACK_LETTERS[char.toUpperCase()] || FALLBACK_LETTERS['O'];
  if (!basePath) return '';

  const scaleFactor = scale / 100;

  return basePath.replace(/([MLQZ])\s*([-\d.,\s]*)/gi, (_match, cmd, coords) => {
    if (cmd === 'Z') return 'Z';

    const numbers = coords
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const transformed: number[] = [];

    for (let i = 0; i < numbers.length; i += 2) {
      if (i + 1 < numbers.length) {
        transformed.push(x + numbers[i] * scaleFactor);
        transformed.push(y + (numbers[i + 1] - 100) * scaleFactor);
      }
    }

    return cmd + ' ' + transformed.join(' ');
  });
}

/**
 * Generate individual character paths using OpenType font
 */
export function generateCharacterPaths(
  text: string,
  font: Font,
  startX: number,
  baselineY: number,
  fontSize: number
): CharacterPath[] {
  const paths: CharacterPath[] = [];
  let currentX = startX;
  const scale = fontSize / font.unitsPerEm;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      const spaceGlyph = font.charToGlyph(' ');
      const spaceAdvance = (spaceGlyph.advanceWidth || font.unitsPerEm * 0.25) * scale;
      paths.push({
        char,
        charIndex: i,
        pathData: '',
        x: currentX,
        width: spaceAdvance,
        advanceWidth: spaceAdvance,
      });
      currentX += spaceAdvance;
      continue;
    }

    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(currentX, baselineY, fontSize);
    const pathData = path.toPathData(2);

    // Get glyph metrics
    const advanceWidth = (glyph.advanceWidth || font.unitsPerEm * 0.6) * scale;
    const glyphBbox = glyph.getBoundingBox();
    const glyphWidth = (glyphBbox.x2 - glyphBbox.x1) * scale;

    // Calculate transformed bbox
    const bboxX = currentX + glyphBbox.x1 * scale;
    const bboxY = baselineY - glyphBbox.y2 * scale; // Y is inverted in fonts
    const bboxHeight = (glyphBbox.y2 - glyphBbox.y1) * scale;

    paths.push({
      char,
      charIndex: i,
      pathData,
      x: currentX,
      width: glyphWidth,
      advanceWidth,
      bbox: {
        x: bboxX,
        y: bboxY,
        width: glyphWidth,
        height: bboxHeight,
      },
    });

    currentX += advanceWidth;
  }

  return paths;
}

/**
 * Generate individual character paths using fallback block letters
 */
export function generateFallbackCharacterPaths(
  text: string,
  startX: number,
  baselineY: number,
  fontSize: number
): CharacterPath[] {
  const paths: CharacterPath[] = [];
  const charWidth = fontSize * 0.7;
  const spacing = fontSize * 0.1;
  let currentX = startX;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      const spaceWidth = charWidth * 0.5;
      paths.push({
        char,
        charIndex: i,
        pathData: '',
        x: currentX,
        width: spaceWidth,
        advanceWidth: spaceWidth,
      });
      currentX += spaceWidth;
      continue;
    }

    const pathData = generateFallbackCharPath(char, currentX, baselineY, fontSize);
    const effectiveWidth = charWidth;

    paths.push({
      char,
      charIndex: i,
      pathData,
      x: currentX,
      width: effectiveWidth,
      advanceWidth: effectiveWidth + spacing,
      bbox: {
        x: currentX,
        y: baselineY - fontSize,
        width: effectiveWidth,
        height: fontSize,
      },
    });

    currentX += effectiveWidth + spacing;
  }

  return paths;
}
