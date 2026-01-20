import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useProjectStore } from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import { generateLEDPositions, type LEDPosition } from '../../core/math/placement';
import { DimensionAnnotations } from './DimensionAnnotations';
import type { BoundingBox } from '../../core/math/dimensions';

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

// Generate path for a single character with transformation
function generateCharPath(char: string, x: number, y: number, scale: number): string {
  const basePath = FALLBACK_LETTERS[char.toUpperCase()] || FALLBACK_LETTERS['O'];
  if (!basePath) return '';

  // Parse and transform the path
  // The fallback paths are designed at scale 100, so we need to scale and position
  const scaleFactor = scale / 100;

  // Transform path commands
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
        transformed.push(y + (numbers[i + 1] - 100) * scaleFactor); // Adjust baseline
      }
    }

    return cmd + ' ' + transformed.join(' ');
  });
}

// Generate full text path
function generateTextPath(
  text: string,
  startX: number,
  baselineY: number,
  fontSize: number
): string {
  const charWidth = fontSize * 0.7; // Approximate character width
  const spacing = fontSize * 0.1; // Letter spacing

  const paths: string[] = [];
  let currentX = startX;

  for (const char of text) {
    if (char === ' ') {
      currentX += charWidth * 0.5;
      continue;
    }
    const charPath = generateCharPath(char, currentX, baselineY, fontSize);
    if (charPath) {
      paths.push(charPath);
    }
    currentX += charWidth + spacing;
  }

  return paths.join(' ');
}

export const CanvasStage: React.FC = () => {
  const {
    blocks,
    populateVersion,
    getCurrentModule,
    updateEngineeringData,
    showDimensions,
    dimensionUnit,
  } = useProjectStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [leds, setLeds] = useState<LEDPosition[]>([]);
  const [letterBboxes, setLetterBboxes] = useState<BoundingBox[]>([]);

  const prevVersionRef = useRef(populateVersion);

  // Get unique languages from all blocks
  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);

  // Load fonts for all needed languages
  const { fonts, loading } = useFonts(neededLanguages);

  // Generate Outlines using useMemo (derived state)
  const outlines = useMemo(() => {
    const newOutlines: string[] = [];

    blocks.forEach((block) => {
      let d = '';
      // Get the font for this block's specific language
      const blockFont = fonts.get(block.language);
      if (blockFont && block.text) {
        const path = blockFont.getPath(block.text, block.x, block.y, block.fontSize);
        d = path.toPathData(2);
      } else if (block.text) {
        // Use comprehensive fallback letter paths
        d = generateTextPath(block.text, block.x, block.y, block.fontSize);
      }
      if (d) {
        newOutlines.push(d);
      }
    });

    return newOutlines;
  }, [fonts, blocks]);

  // Generate LEDs (On Demand via Populate button - user-triggered action)
  useEffect(() => {
    if (populateVersion === prevVersionRef.current && populateVersion === 0) return;
    prevVersionRef.current = populateVersion;

    const currentModule = getCurrentModule();
    const visualPixelsPerInch = 12.5;

    if (svgRef.current && outlines.length > 0) {
      let allPositions: LEDPosition[] = [];

      outlines.forEach((d) => {
        if (!d) return;

        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('d', d);
        tempPath.style.visibility = 'hidden';
        svgRef.current?.appendChild(tempPath);

        const positions = generateLEDPositions(tempPath, {
          targetModule: currentModule,
          strokeWidth: 2,
          pixelsPerInch: visualPixelsPerInch,
        });

        allPositions = [...allPositions, ...positions];
        svgRef.current?.removeChild(tempPath);
      });

      // This setState is intentionally triggered by user action (Populate button)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeds(allPositions);
      updateEngineeringData(allPositions.length);
    }
  }, [populateVersion, outlines, getCurrentModule, updateEngineeringData]);

  // Calculate bounding boxes for dimension annotations - synchronizing with SVG DOM
  useEffect(() => {
    if (!svgRef.current || outlines.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLetterBboxes([]);
      return;
    }

    const bboxes: BoundingBox[] = [];

    outlines.forEach((d) => {
      if (!d) return;

      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', d);
      tempPath.style.visibility = 'hidden';
      svgRef.current?.appendChild(tempPath);

      const bbox = tempPath.getBBox();
      bboxes.push({
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });

      svgRef.current?.removeChild(tempPath);
    });

    setLetterBboxes(bboxes);
  }, [outlines]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 flex items-center gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading Font Engine...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <svg ref={svgRef} width="800" height="600" viewBox="0 0 800 600" className="drop-shadow-2xl">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="0.5"
            />
          </pattern>

          <filter id="ledGlowIntense" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3" result="blur1" />
            <feGaussianBlur stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="letterShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.5" />
          </filter>

          <linearGradient id="metallic" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <radialGradient id="ledCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="70%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="#0f172a" />
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Letter Outlines */}
        {outlines.map((d, i) => (
          <g key={i}>
            <path
              d={d}
              fill="url(#metallic)"
              stroke="#94a3b8"
              strokeWidth="2"
              filter="url(#letterShadow)"
            />
            <path d={d} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          </g>
        ))}

        {/* Dimension Annotations */}
        {showDimensions &&
          letterBboxes.map((bbox, i) => (
            <DimensionAnnotations key={`dim-${i}`} bbox={bbox} unit={dimensionUnit} />
          ))}

        {/* LEDs with Glow */}
        {leds.map((led, i) => (
          <g key={i} transform={`rotate(${led.rotation} ${led.x} ${led.y})`}>
            <ellipse
              cx={led.x}
              cy={led.y}
              rx={5}
              ry={2.5}
              fill="#3b82f6"
              filter="url(#ledGlowIntense)"
              opacity={0.7}
            />
            <rect
              x={led.x - 4}
              y={led.y - 2}
              width={8}
              height={4}
              fill="url(#ledCenter)"
              rx={1}
              className="cursor-pointer transition-opacity hover:opacity-80"
            />
            <ellipse cx={led.x} cy={led.y} rx={1.5} ry={0.75} fill="white" opacity={0.9} />
          </g>
        ))}

        {/* Status Badge */}
        <g transform="translate(20, 560)">
          <rect
            x="0"
            y="0"
            width="140"
            height="28"
            rx="14"
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <text
            x="70"
            y="18"
            textAnchor="middle"
            fill="#60a5fa"
            fontSize="12"
            fontFamily="system-ui"
            fontWeight="600"
          >
            {leds.length} LEDs Placed
          </text>
        </g>

        {/* Font Status */}
        <g transform="translate(650, 560)">
          <rect
            x="0"
            y="0"
            width="130"
            height="28"
            rx="14"
            fill={fonts.size > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)'}
            stroke={fonts.size > 0 ? '#22c55e' : '#eab308'}
            strokeWidth="1"
          />
          <text
            x="65"
            y="18"
            textAnchor="middle"
            fill={fonts.size > 0 ? '#22c55e' : '#eab308'}
            fontSize="11"
            fontFamily="system-ui"
            fontWeight="500"
          >
            {fonts.size > 0
              ? `${fonts.size} Font${fonts.size > 1 ? 's' : ''} Loaded`
              : 'Fallback Mode'}
          </text>
        </g>
      </svg>
    </div>
  );
};
