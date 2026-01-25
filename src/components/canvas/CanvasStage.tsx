import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useProjectStore, type BlockCharPaths, type CharLEDData } from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import { generateLEDPositions } from '../../core/math/placement';
import { DimensionAnnotations } from './DimensionAnnotations';
import { CharacterGroup } from './CharacterGroup';
import { CharacterLEDPanel } from '../ui/CharacterLEDPanel';
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
    selectChar,
    setCharLedCount,
    resetCharLedCount,
    getCharLedCount,
    setCharLedColumns,
    getCharLedColumns,
    setCharLedOrientation,
    getCharLedOrientation,
  } = useProjectStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const [charLeds, setCharLeds] = useState<CharLEDData[]>([]);
  const [letterBboxes, setLetterBboxes] = useState<BoundingBox[]>([]);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);

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

  // Register path refs for LED placement
  const registerPathRef = useCallback((el: SVGPathElement | null, charId: string) => {
    if (el) {
      pathRefs.current.set(charId, el);
    } else {
      pathRefs.current.delete(charId);
    }
  }, []);

  // Handle character selection
  const handleCharSelect = useCallback(
    (charId: string, position: { x: number; y: number }) => {
      selectChar(charId);
      setPanelPosition(position);
    },
    [selectChar]
  );

  // Handle applying LED count
  const handleApplyLedCount = useCallback(
    (charId: string, count: number) => {
      setCharLedCount(charId, count);
      // Re-trigger population to update LEDs
      useProjectStore.getState().triggerPopulation();
    },
    [setCharLedCount]
  );

  // Handle applying LED columns
  const handleApplyLedColumns = useCallback(
    (charId: string, columns: number) => {
      setCharLedColumns(charId, columns);
      // Re-trigger population to update LEDs
      useProjectStore.getState().triggerPopulation();
    },
    [setCharLedColumns]
  );

  // Handle applying LED orientation
  const handleApplyLedOrientation = useCallback(
    (charId: string, orientation: 'horizontal' | 'vertical') => {
      setCharLedOrientation(charId, orientation);
      // Re-trigger population to update LEDs
      useProjectStore.getState().triggerPopulation();
    },
    [setCharLedOrientation]
  );

  // Handle reset LED count
  const handleResetLedCount = useCallback(
    (charId: string) => {
      resetCharLedCount(charId);
      useProjectStore.getState().triggerPopulation();
    },
    [resetCharLedCount]
  );

  // Handle cancel/close panel
  const handleClosePanel = useCallback(() => {
    selectChar(null);
    setPanelPosition(null);
  }, [selectChar]);

  // Handle clicking on background to deselect
  const handleBackgroundClick = useCallback(() => {
    if (selectedCharId) {
      selectChar(null);
      setPanelPosition(null);
    }
  }, [selectedCharId, selectChar]);

  const prevColumnOverridesRef = useRef(ledColumnOverrides);
  const prevOrientationOverridesRef = useRef(ledOrientationOverrides);

  // Generate LEDs per character
  useEffect(() => {
    const versionChanged = populateVersion !== prevVersionRef.current || populateVersion === 0;
    const overridesChanged = ledCountOverrides !== prevOverridesRef.current;
    const columnOverridesChanged = ledColumnOverrides !== prevColumnOverridesRef.current;
    const orientationOverridesChanged =
      ledOrientationOverrides !== prevOrientationOverridesRef.current;

    if (
      !versionChanged &&
      !overridesChanged &&
      !columnOverridesChanged &&
      !orientationOverridesChanged
    )
      return;
    if (populateVersion === 0 && prevVersionRef.current === 0) return;

    prevVersionRef.current = populateVersion;
    prevOverridesRef.current = ledCountOverrides;
    prevColumnOverridesRef.current = ledColumnOverrides;
    prevOrientationOverridesRef.current = ledOrientationOverrides;

    const currentModule = getCurrentModule();
    const visualPixelsPerInch = 12.5;

    if (svgRef.current && blockCharPaths.length > 0) {
      const allCharLeds: CharLEDData[] = [];

      blockCharPaths.forEach(({ blockId, charPaths }) => {
        charPaths.forEach((charPath) => {
          if (!charPath.pathData) return; // Skip spaces

          const charId = `${blockId}-${charPath.charIndex}`;
          const targetCount = ledCountOverrides[charId];
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
            leds: positions,
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
    getCurrentModule,
    updateEngineeringData,
    getCharLedColumns,
    getCharLedOrientation,
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

  // Get selected character info for panel
  const selectedCharInfo = useMemo(() => {
    if (!selectedCharId) return null;

    const [blockId, charIndexStr] = selectedCharId.split('-');
    const charIndex = parseInt(charIndexStr, 10);

    const blockPaths = blockCharPaths.find((bp) => bp.blockId === blockId);
    if (!blockPaths) return null;

    const charPath = blockPaths.charPaths.find((cp) => cp.charIndex === charIndex);
    if (!charPath) return null;

    return {
      char: charPath.char,
      currentCount: getCharLedCount(selectedCharId),
      currentColumns: getCharLedColumns(selectedCharId),
      currentOrientation: getCharLedOrientation(selectedCharId),
    };
  }, [selectedCharId, blockCharPaths, getCharLedCount, getCharLedColumns, getCharLedOrientation]);

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
    <div className="canvas-stage-container relative w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-lg overflow-hidden">
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
        {allLeds.map((led, i) => (
          <g key={i} transform={`rotate(${led.rotation} ${led.x} ${led.y})`}>
            {/* Capsule body - rounded rectangle outline */}
            <rect
              x={led.x - 6}
              y={led.y - 2.5}
              width={12}
              height={5}
              rx={2.5}
              ry={2.5}
              fill="none"
              stroke="#334155"
              strokeWidth={0.8}
            />
            {/* Left dot */}
            <circle cx={led.x - 3.5} cy={led.y} r={1.2} fill="#334155" />
            {/* Right dot */}
            <circle cx={led.x + 3.5} cy={led.y} r={1.2} fill="#334155" />
          </g>
        ))}

        {/* Status Badge */}
        <g transform={`translate(${viewBox.x + 20}, ${viewBox.y + viewBox.height - 40})`}>
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

      {/* Character LED Panel (popup) */}
      {selectedCharId && panelPosition && selectedCharInfo && (
        <CharacterLEDPanel
          charId={selectedCharId}
          char={selectedCharInfo.char}
          currentCount={selectedCharInfo.currentCount}
          currentColumns={selectedCharInfo.currentColumns}
          currentOrientation={selectedCharInfo.currentOrientation}
          position={panelPosition}
          onApply={handleApplyLedCount}
          onApplyColumns={handleApplyLedColumns}
          onApplyOrientation={handleApplyLedOrientation}
          onCancel={handleClosePanel}
          onReset={handleResetLedCount}
        />
      )}
    </div>
  );
};
