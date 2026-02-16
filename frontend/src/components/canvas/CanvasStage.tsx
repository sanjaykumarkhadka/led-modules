import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  useProjectStore,
  type BlockCharPaths,
  type CharLEDData,
  type ManualLED,
} from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import { generateLEDPositions } from '../../core/math/placement';
import {
  DEFAULT_QUALITY_THRESHOLDS,
  evaluatePlacementQuality,
  gradePlacement,
} from '../../core/math/placementQuality';
import { DimensionAnnotations } from './DimensionAnnotations';
import { CharacterGroup } from './CharacterGroup';
import {
  generateCharacterPaths,
  generateFallbackCharacterPaths,
  type CharacterPath,
} from '../../core/math/characterPaths';
import type { BoundingBox } from '../../core/math/dimensions';

export const CanvasStage: React.FC = () => {
  const {
    blocks,
    populateVersion,
    getCurrentModule,
    updateEngineeringData,
    showDimensions,
    dimensionUnit,
    selectedCharId,
    ledCountOverrides,
    ledColumnOverrides,
    ledOrientationOverrides,
    placementModeOverrides,
    manualLedOverrides,
    selectChar,
    getCharLedCount,
    getCharLedColumns,
    getCharLedOrientation,
    getCharPlacementMode,
    getCharManualLeds,
  } = useProjectStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const [charLeds, setCharLeds] = useState<CharLEDData[]>([]);
  const [letterBboxes, setLetterBboxes] = useState<BoundingBox[]>([]);

  const prevVersionRef = useRef(populateVersion);
  const prevOverridesRef = useRef(ledCountOverrides);

  // Get unique languages from all blocks
  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);

  // Load fonts for all needed languages
  const { fonts, loading } = useFonts(neededLanguages);

  // Generate per-character paths for all blocks
  const blockCharPaths = useMemo((): BlockCharPaths[] => {
    return blocks.map((block) => {
      const blockFont = fonts.get(block.language);
      let charPaths: CharacterPath[];

      if (blockFont && block.text) {
        charPaths = generateCharacterPaths(block.text, blockFont, block.x, block.y, block.fontSize);
      } else if (block.text) {
        charPaths = generateFallbackCharacterPaths(block.text, block.x, block.y, block.fontSize);
      } else {
        charPaths = [];
      }

      return {
        blockId: block.id,
        charPaths,
      };
    });
  }, [fonts, blocks]);

  const charPathMap = useMemo(() => {
    const map = new Map<string, CharacterPath>();
    blockCharPaths.forEach(({ blockId, charPaths }) => {
      charPaths.forEach((cp) => {
        map.set(`${blockId}-${cp.charIndex}`, cp);
      });
    });
    return map;
  }, [blockCharPaths]);

  // Register path refs for LED placement
  const registerPathRef = useCallback((el: SVGPathElement | null, charId: string) => {
    if (el) {
      pathRefs.current.set(charId, el);
    } else {
      pathRefs.current.delete(charId);
    }
  }, []);

  const getCharBBox = useCallback(
    (charId: string) => {
      const cp = charPathMap.get(charId);
      if (cp?.bbox) return cp.bbox;
      const pathEl = pathRefs.current.get(charId);
      if (pathEl) {
        const bbox = pathEl.getBBox();
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      }
      return null;
    },
    [charPathMap]
  );

  const toAbsoluteLED = useCallback((led: ManualLED, bbox: BoundingBox) => {
    return {
      x: bbox.x + led.u * bbox.width,
      y: bbox.y + led.v * bbox.height,
      rotation: led.rotation,
      id: led.id,
      source: 'manual' as const,
    };
  }, []);

  // Handle character selection (position passed by CharacterGroup but not used here)
  const handleCharSelect = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (charId: string, _position: { x: number; y: number }) => {
      selectChar(charId);
    },
    [selectChar]
  );

  // Handle clicking on background to deselect
  const handleBackgroundClick = useCallback(() => {
    if (selectedCharId) {
      selectChar(null);
    }
  }, [selectedCharId, selectChar]);

  const prevColumnOverridesRef = useRef(ledColumnOverrides);
  const prevOrientationOverridesRef = useRef(ledOrientationOverrides);
  const prevManualOverridesRef = useRef(manualLedOverrides);
  const prevPlacementModeOverridesRef = useRef(placementModeOverrides);
  const showQA = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('qa');
  }, []);


  // Generate LEDs per character
  useEffect(() => {
    const versionChanged = populateVersion !== prevVersionRef.current || populateVersion === 0;
    const overridesChanged = ledCountOverrides !== prevOverridesRef.current;
    const columnOverridesChanged = ledColumnOverrides !== prevColumnOverridesRef.current;
    const orientationOverridesChanged =
      ledOrientationOverrides !== prevOrientationOverridesRef.current;
    const manualOverridesChanged = manualLedOverrides !== prevManualOverridesRef.current;
    const placementModeChanged =
      placementModeOverrides !== prevPlacementModeOverridesRef.current;

    if (
      !versionChanged &&
      !overridesChanged &&
      !columnOverridesChanged &&
      !orientationOverridesChanged &&
      !manualOverridesChanged &&
      !placementModeChanged
    )
      return;
    if (
      populateVersion === 0 &&
      prevVersionRef.current === 0 &&
      !manualOverridesChanged &&
      !placementModeChanged
    )
      return;

    prevVersionRef.current = populateVersion;
    prevOverridesRef.current = ledCountOverrides;
    prevColumnOverridesRef.current = ledColumnOverrides;
    prevOrientationOverridesRef.current = ledOrientationOverrides;
    prevManualOverridesRef.current = manualLedOverrides;
    prevPlacementModeOverridesRef.current = placementModeOverrides;

    const currentModule = getCurrentModule();
    const visualPixelsPerInch = 12.5;

    if (svgRef.current && blockCharPaths.length > 0) {
      const allCharLeds: CharLEDData[] = [];

      blockCharPaths.forEach(({ blockId, charPaths }) => {
        charPaths.forEach((charPath) => {
          if (!charPath.pathData) return; // Skip spaces

          const charId = `${blockId}-${charPath.charIndex}`;
          const placementMode = getCharPlacementMode(charId);

          if (placementMode === 'manual') {
            const bbox = charPath.bbox || getCharBBox(charId);
            const manualLeds = getCharManualLeds(charId);
            const positions =
              bbox && manualLeds.length > 0
                ? manualLeds.map((led) => toAbsoluteLED(led, bbox))
                : [];
            allCharLeds.push({
              charId,
              leds: positions,
            });
            return;
          }

          const targetCount = getCharLedCount(charId);
          const columnCount = getCharLedColumns(charId);
          const orientation = getCharLedOrientation(charId);

          // Create temp path for LED generation
          const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          tempPath.setAttribute('d', charPath.pathData);
          tempPath.style.visibility = 'hidden';
          svgRef.current?.appendChild(tempPath);

          const positions = generateLEDPositions(tempPath, {
            targetModule: currentModule,
            strokeWidth: 2,
            pixelsPerInch: visualPixelsPerInch,
            targetCount: targetCount,
            columnCount: columnCount,
            orientation: orientation,
          });

          allCharLeds.push({
            charId,
            leds: positions.map((led) => ({ ...led, source: 'auto' as const })),
          });

          svgRef.current?.removeChild(tempPath);
        });
      });

      // This setState is intentionally triggered by user action (Populate button)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharLeds(allCharLeds);

      // Update total count
      const totalLeds = allCharLeds.reduce((sum, c) => sum + c.leds.length, 0);
      updateEngineeringData(totalLeds);

      // Store layout data for PDF export
      useProjectStore.getState().setComputedLayoutData({
        blockCharPaths,
        charLeds: allCharLeds,
      });
    }
  }, [
    populateVersion,
    blockCharPaths,
    ledCountOverrides,
    ledColumnOverrides,
    ledOrientationOverrides,
    manualLedOverrides,
    placementModeOverrides,
    getCurrentModule,
    updateEngineeringData,
    getCharLedCount,
    getCharLedColumns,
    getCharLedOrientation,
    getCharManualLeds,
    getCharPlacementMode,
    getCharBBox,
    toAbsoluteLED,
  ]);

  // Calculate bounding boxes for dimension annotations - synchronizing with SVG DOM
  useEffect(() => {
    if (!svgRef.current || blockCharPaths.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLetterBboxes([]);
      return;
    }

    const bboxes: BoundingBox[] = [];

    blockCharPaths.forEach(({ charPaths }) => {
      // Combine all character paths into one path for the block
      const combinedPath = charPaths
        .map((cp) => cp.pathData)
        .filter(Boolean)
        .join(' ');
      if (!combinedPath) return;

      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', combinedPath);
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
  }, [blockCharPaths]);

  // Flatten all LEDs for rendering
  const allLeds = useMemo(() => {
    return charLeds.flatMap((c) => c.leds);
  }, [charLeds]);

  type QAResultItem = {
    charId: string;
    char: string;
    quality: ReturnType<typeof evaluatePlacementQuality>;
    grade: ReturnType<typeof gradePlacement>;
  };
  const [qaResults, setQaResults] = useState<QAResultItem[]>([]);

  useLayoutEffect(() => {
    if (!showQA) {
      queueMicrotask(() => setQaResults([]));
      return;
    }
    const charLabelMap = new Map<string, string>();
    blockCharPaths.forEach(({ blockId, charPaths }) => {
      charPaths.forEach((cp) => {
        charLabelMap.set(`${blockId}-${cp.charIndex}`, cp.char || '');
      });
    });
    const results: QAResultItem[] = [];
    charLeds.forEach((charData) => {
      const path = pathRefs.current.get(charData.charId);
      if (!path || charData.leds.length === 0) return;
      const quality = evaluatePlacementQuality(path, charData.leds);
      const grade = gradePlacement(quality, DEFAULT_QUALITY_THRESHOLDS);
      results.push({
        charId: charData.charId,
        char: charLabelMap.get(charData.charId) || '',
        quality,
        grade,
      });
    });
    queueMicrotask(() => setQaResults(results));
  }, [showQA, charLeds, blockCharPaths]);

  // Calculate dynamic viewBox based on content bounds
  const viewBox = useMemo(() => {
    const padding = 40; // Padding around content
    const minWidth = 800;
    const minHeight = 600;

    if (blockCharPaths.length === 0) {
      return { x: 0, y: 0, width: minWidth, height: minHeight };
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

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

    if (!isFinite(minX)) {
      return { x: 0, y: 0, width: minWidth, height: minHeight };
    }

    // Add padding and ensure minimum size
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    return {
      x: Math.min(0, minX - padding),
      y: Math.min(0, minY - padding),
      width: Math.max(minWidth, contentWidth + Math.abs(Math.min(0, minX - padding))),
      height: Math.max(minHeight, contentHeight + Math.abs(Math.min(0, minY - padding))),
    };
  }, [blockCharPaths]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--surface-panel)]">
        <div className="text-[var(--text-3)] flex items-center gap-3">
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
    <div className="canvas-stage-container relative w-full h-full flex items-center justify-center rounded-none bg-[var(--stage-bg)] overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="drop-shadow-2xl"
        onClick={handleBackgroundClick}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="var(--stage-grid-line)"
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
        <rect width="100%" height="100%" fill="var(--stage-bg)" />
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Per-character letter rendering */}
        {blockCharPaths.map(({ blockId, charPaths }) =>
          charPaths.map((charPath) => (
            <CharacterGroup
              key={`${blockId}-${charPath.charIndex}`}
              charPath={charPath}
              blockId={blockId}
              isSelected={selectedCharId === `${blockId}-${charPath.charIndex}`}
              onSelect={handleCharSelect}
              pathRef={registerPathRef}
            />
          ))
        )}


        {/* Dimension Annotations */}
        {showDimensions &&
          letterBboxes.map((bbox, i) => (
            <DimensionAnnotations key={`dim-${i}`} bbox={bbox} unit={dimensionUnit} />
          ))}

        {/* LEDs - Capsule style with end dots */}
        {charLeds.map(({ charId, leds }) =>
          leds.map((led, i) => {
            const isManual =
              led.source === 'manual' && getCharPlacementMode(charId) === 'manual';
            const key = led.id ? `led-${led.id}` : `${charId}-${i}`;

            return (
              <g key={key} transform={`rotate(${led.rotation} ${led.x} ${led.y})`}>
                <rect
                  x={led.x - 6}
                  y={led.y - 2.5}
                  width={12}
                  height={5}
                  rx={2.5}
                  ry={2.5}
                  fill="none"
                  stroke={isManual ? '#3b82f6' : '#94a3b8'}
                  strokeWidth={0.8}
                />
                <circle cx={led.x - 3.5} cy={led.y} r={1.2} fill="#64748b" />
                <circle cx={led.x + 3.5} cy={led.y} r={1.2} fill="#64748b" />
              </g>
            );
          })
        )}

        {/* Status Badge */}
        <g transform={`translate(${viewBox.x + 20}, ${viewBox.y + viewBox.height - 40})`}>
          <rect
            x="0"
            y="0"
            width="140"
            height="28"
            rx="14"
            fill="rgba(37, 99, 235, 0.12)"
            stroke="#2563eb"
            strokeWidth="1"
          />
          <text
            x="70"
            y="18"
            textAnchor="middle"
            fill="#1d4ed8"
            fontSize="12"
            fontFamily="system-ui"
            fontWeight="600"
          >
            {allLeds.length} LEDs Placed
          </text>
        </g>

        {/* Font Status */}
        <g
          transform={`translate(${viewBox.x + viewBox.width - 150}, ${viewBox.y + viewBox.height - 40})`}
        >
          <rect
            x="0"
            y="0"
            width="130"
            height="28"
            rx="14"
            fill={fonts.size > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.14)'}
            stroke={fonts.size > 0 ? '#16a34a' : '#d97706'}
            strokeWidth="1"
          />
          <text
            x="65"
            y="18"
            textAnchor="middle"
            fill={fonts.size > 0 ? '#15803d' : '#92400e'}
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

      {showQA && qaResults.length > 0 && (
        <div className="absolute top-3 right-3 z-50 max-w-[360px] bg-slate-950/90 border border-slate-700 rounded-lg p-3 text-xs text-slate-200">
          <div className="font-semibold text-sm mb-2">Placement QA</div>
          <div className="text-[11px] text-slate-400 mb-2">
            Thresholds: inside ≥ {DEFAULT_QUALITY_THRESHOLDS.insideRate}, nnCv ≤{' '}
            {DEFAULT_QUALITY_THRESHOLDS.nnCv}, minClear ≥ {DEFAULT_QUALITY_THRESHOLDS.minClearance}
            , symmetry ≥ {DEFAULT_QUALITY_THRESHOLDS.symmetryMean}
          </div>
          <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
            {qaResults.map((result) => (
              <div
                key={result.charId}
                className={`rounded border px-2 py-1 ${
                  result.grade.pass
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{result.char || '·'}</span>
                  <span className={result.grade.pass ? 'text-emerald-300' : 'text-rose-300'}>
                    {result.grade.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-300">
                  <span>inside: {(result.quality.insideRate * 100).toFixed(0)}%</span>
                  <span>nnCv: {result.quality.nnCv.toFixed(2)}</span>
                  <span>minClear: {result.quality.minClearance.toFixed(2)}</span>
                  <span>sym: {result.quality.symmetryMean.toFixed(2)}</span>
                </div>
                {!result.grade.pass && result.grade.failures.length > 0 && (
                  <div className="mt-1 text-[10px] text-rose-200">
                    {result.grade.failures.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
