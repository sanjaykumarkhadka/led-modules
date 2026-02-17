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
  generatePositionedCharacterPath,
  type CharacterPath,
} from '../../core/math/characterPaths';
import type { BoundingBox } from '../../core/math/dimensions';

const MIN_CHAR_SIZE = 8;
const MAX_CHAR_SIZE = 96;

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface CanvasStageProps {
  onCharacterMutate?: () => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({ onCharacterMutate }) => {
  const {
    blocks,
    charactersByBlock,
    populateVersion,
    getCurrentModule,
    updateEngineeringData,
    showDimensions,
    dimensionUnit,
    selectedCharId,
    ledCountOverrides,
    ledColumnOverrides,
    ledOrientationOverrides,
    manualLedOverrides,
    selectChar,
    getCharacter,
    updateCharacter,
    getCharLedCount,
    getCharLedColumns,
    getCharLedOrientation,
    getCharManualLeds,
  } = useProjectStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const [charLeds, setCharLeds] = useState<CharLEDData[]>([]);
  const [letterBboxes, setLetterBboxes] = useState<BoundingBox[]>([]);

  const prevVersionRef = useRef(populateVersion);
  const prevOverridesRef = useRef(ledCountOverrides);
  const prevColumnOverridesRef = useRef(ledColumnOverrides);
  const prevOrientationOverridesRef = useRef(ledOrientationOverrides);
  const prevManualOverridesRef = useRef(manualLedOverrides);

  const dragRef = useRef<{
    pointerId: number;
    charId: string;
    startPointer: { x: number; y: number };
    startChar: { x: number; baselineY: number };
    startBBox: BoundingBox;
  } | null>(null);

  const resizeRef = useRef<{
    pointerId: number;
    charId: string;
    handle: ResizeHandle;
    startPointer: { x: number; y: number };
    startChar: { x: number; baselineY: number; fontSize: number };
    startBBox: BoundingBox;
  } | null>(null);

  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);
  const { fonts, loading } = useFonts(neededLanguages);

  const blockCharPaths = useMemo((): BlockCharPaths[] => {
    return blocks.map((block) => {
      const blockFont = fonts.get(block.language) ?? null;
      const chars = [...(charactersByBlock[block.id] ?? [])].sort((a, b) => a.order - b.order);
      const charPaths: CharacterPath[] = chars.map((char, index) => {
        const positioned = generatePositionedCharacterPath(
          char.glyph,
          blockFont,
          char.x,
          char.baselineY,
          char.fontSize,
          char.id
        );
        return {
          ...positioned,
          charIndex: index,
          charId: char.id,
        };
      });
      return {
        blockId: block.id,
        charPaths,
      };
    });
  }, [blocks, charactersByBlock, fonts]);

  const charPathMap = useMemo(() => {
    const map = new Map<string, CharacterPath>();
    blockCharPaths.forEach(({ charPaths }) => {
      charPaths.forEach((cp) => {
        if (cp.charId) map.set(cp.charId, cp);
      });
    });
    return map;
  }, [blockCharPaths]);

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
      ...(typeof led.scale === 'number' ? { scale: led.scale } : {}),
      source: 'manual' as const,
    };
  }, []);

  const handleCharSelect = useCallback(
    (charId: string) => {
      selectChar(charId);
    },
    [selectChar]
  );

  const handleBackgroundClick = useCallback(() => {
    if (selectedCharId) {
      selectChar(null);
    }
  }, [selectedCharId, selectChar]);

  useEffect(() => {
    const versionChanged = populateVersion !== prevVersionRef.current || populateVersion === 0;
    const overridesChanged = ledCountOverrides !== prevOverridesRef.current;
    const columnOverridesChanged = ledColumnOverrides !== prevColumnOverridesRef.current;
    const orientationOverridesChanged =
      ledOrientationOverrides !== prevOrientationOverridesRef.current;
    const manualOverridesChanged = manualLedOverrides !== prevManualOverridesRef.current;

    if (
      !versionChanged &&
      !overridesChanged &&
      !columnOverridesChanged &&
      !orientationOverridesChanged &&
      !manualOverridesChanged
    )
      return;
    if (populateVersion === 0 && prevVersionRef.current === 0 && !manualOverridesChanged)
      return;

    prevVersionRef.current = populateVersion;
    prevOverridesRef.current = ledCountOverrides;
    prevColumnOverridesRef.current = ledColumnOverrides;
    prevOrientationOverridesRef.current = ledOrientationOverrides;
    prevManualOverridesRef.current = manualLedOverrides;

    const currentModule = getCurrentModule();
    const visualPixelsPerInch = 12.5;

    if (svgRef.current && blockCharPaths.length > 0) {
      const allCharLeds: CharLEDData[] = [];

      blockCharPaths.forEach(({ charPaths }) => {
        charPaths.forEach((charPath) => {
          if (!charPath.pathData || !charPath.charId) return;

          const charId = charPath.charId;
          const bbox = charPath.bbox || getCharBBox(charId);
          const manualLeds = getCharManualLeds(charId);
          if (bbox && manualLeds.length > 0) {
            const positions = manualLeds.map((led) => toAbsoluteLED(led, bbox));
            allCharLeds.push({ charId, leds: positions });
            return;
          }

          const targetCount = getCharLedCount(charId);
          const columnCount = getCharLedColumns(charId);
          const orientation = getCharLedOrientation(charId);

          const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          tempPath.setAttribute('d', charPath.pathData);
          tempPath.style.visibility = 'hidden';
          svgRef.current?.appendChild(tempPath);

          const positions = generateLEDPositions(tempPath, {
            targetModule: currentModule,
            strokeWidth: 2,
            pixelsPerInch: visualPixelsPerInch,
            targetCount,
            columnCount,
            orientation,
          });

          allCharLeds.push({
            charId,
            leds: positions.map((led) => ({ ...led, source: 'auto' as const })),
          });

          svgRef.current?.removeChild(tempPath);
        });
      });

      queueMicrotask(() => setCharLeds(allCharLeds));
      const totalLeds = allCharLeds.reduce((sum, c) => sum + c.leds.length, 0);
      updateEngineeringData(totalLeds);
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
    getCurrentModule,
    updateEngineeringData,
    getCharLedCount,
    getCharLedColumns,
    getCharLedOrientation,
    getCharManualLeds,
    getCharBBox,
    toAbsoluteLED,
  ]);

  useEffect(() => {
    if (!svgRef.current || blockCharPaths.length === 0) {
      queueMicrotask(() => setLetterBboxes([]));
      return;
    }

    const bboxes: BoundingBox[] = [];

    blockCharPaths.forEach(({ charPaths }) => {
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

    queueMicrotask(() => setLetterBboxes(bboxes));
  }, [blockCharPaths]);

  const allLeds = useMemo(() => {
    return charLeds.flatMap((c) => c.leds);
  }, [charLeds]);

  const charScaleMap = useMemo(() => {
    const baseFontSize = 150;
    const map = new Map<string, number>();
    Object.values(charactersByBlock).forEach((chars) => {
      chars.forEach((char) => {
        map.set(char.id, Math.max(0.05, Math.min(3, char.fontSize / baseFontSize)));
      });
    });
    return map;
  }, [charactersByBlock]);

  const getCharVisualScale = useCallback(
    (charId: string) => {
      return charScaleMap.get(charId) ?? 1;
    },
    [charScaleMap]
  );

  type QAResultItem = {
    charId: string;
    char: string;
    quality: ReturnType<typeof evaluatePlacementQuality>;
    grade: ReturnType<typeof gradePlacement>;
  };
  const [qaResults, setQaResults] = useState<QAResultItem[]>([]);

  const showQA = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('qa');
  }, []);

  useLayoutEffect(() => {
    if (!showQA) {
      queueMicrotask(() => setQaResults([]));
      return;
    }
    const charLabelMap = new Map<string, string>();
    blockCharPaths.forEach(({ charPaths }) => {
      charPaths.forEach((cp) => {
        if (cp.charId) charLabelMap.set(cp.charId, cp.char || '');
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

  const viewBox = useMemo(() => {
    const padding = 40;
    const minWidth = 800;
    const minHeight = 600;

    if (blockCharPaths.length === 0) {
      return { x: 0, y: 0, width: minWidth, height: minHeight };
    }

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

    if (!isFinite(minX)) {
      return { x: 0, y: 0, width: minWidth, height: minHeight };
    }

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    return {
      x: Math.min(0, minX - padding),
      y: Math.min(0, minY - padding),
      width: Math.max(minWidth, contentWidth + Math.abs(Math.min(0, minX - padding))),
      height: Math.max(minHeight, contentHeight + Math.abs(Math.min(0, minY - padding))),
    };
  }, [blockCharPaths]);

  const getSvgPoint = useCallback((event: React.PointerEvent<SVGElement | SVGGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  const beginDrag = useCallback(
    (event: React.PointerEvent<SVGGElement>, charId: string) => {
      const point = getSvgPoint(event);
      if (!point) return;
      const char = getCharacter(charId);
      const bbox = getCharBBox(charId);
      if (!char || !bbox) return;
      dragRef.current = {
        pointerId: event.pointerId,
        charId,
        startPointer: point,
        startChar: { x: char.x, baselineY: char.baselineY },
        startBBox: bbox,
      };
      const svg = svgRef.current;
      if (svg) svg.setPointerCapture(event.pointerId);
    },
    [getCharacter, getCharBBox, getSvgPoint]
  );

  const beginResize = useCallback(
    (event: React.PointerEvent<SVGRectElement>, charId: string, handle: ResizeHandle) => {
      const point = getSvgPoint(event);
      if (!point) return;
      const char = getCharacter(charId);
      const bbox = getCharBBox(charId);
      if (!char || !bbox) return;
      resizeRef.current = {
        pointerId: event.pointerId,
        charId,
        handle,
        startPointer: point,
        startChar: { x: char.x, baselineY: char.baselineY, fontSize: char.fontSize },
        startBBox: bbox,
      };
      const svg = svgRef.current;
      if (svg) svg.setPointerCapture(event.pointerId);
    },
    [getCharacter, getCharBBox, getSvgPoint]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const point = getSvgPoint(event);
      if (!point) return;

      const drag = dragRef.current;
      if (drag && drag.pointerId === event.pointerId) {
        const dx = point.x - drag.startPointer.x;
        const dy = point.y - drag.startPointer.y;
        const minDx = viewBox.x - drag.startBBox.x;
        const maxDx = viewBox.x + viewBox.width - (drag.startBBox.x + drag.startBBox.width);
        const minDy = viewBox.y - drag.startBBox.y;
        const maxDy = viewBox.y + viewBox.height - (drag.startBBox.y + drag.startBBox.height);
        const clampedDx = Math.max(minDx, Math.min(maxDx, dx));
        const clampedDy = Math.max(minDy, Math.min(maxDy, dy));

        updateCharacter(drag.charId, {
          x: drag.startChar.x + clampedDx,
          baselineY: drag.startChar.baselineY + clampedDy,
        });
        return;
      }

      const resize = resizeRef.current;
      if (resize && resize.pointerId === event.pointerId) {
        const dx = point.x - resize.startPointer.x;
        const dy = point.y - resize.startPointer.y;
        const base = Math.max(resize.startBBox.width, resize.startBBox.height, 1);
        let delta = 0;
        switch (resize.handle) {
          case 'se':
            delta = (dx + dy) / 2;
            break;
          case 'nw':
            delta = (-dx - dy) / 2;
            break;
          case 'ne':
            delta = (dx - dy) / 2;
            break;
          case 'sw':
            delta = (-dx + dy) / 2;
            break;
        }

        const nextFontSize = Math.max(
          MIN_CHAR_SIZE,
          Math.min(MAX_CHAR_SIZE, (resize.startChar.fontSize * (base + delta)) / base)
        );
        const scale = nextFontSize / resize.startChar.fontSize;
        const targetWidth = resize.startBBox.width * scale;
        const targetHeight = resize.startBBox.height * scale;

        let targetBboxX = resize.startBBox.x;
        let targetBboxY = resize.startBBox.y;

        if (resize.handle === 'nw') {
          targetBboxX = resize.startBBox.x + resize.startBBox.width - targetWidth;
          targetBboxY = resize.startBBox.y + resize.startBBox.height - targetHeight;
        } else if (resize.handle === 'ne') {
          targetBboxY = resize.startBBox.y + resize.startBBox.height - targetHeight;
        } else if (resize.handle === 'sw') {
          targetBboxX = resize.startBBox.x + resize.startBBox.width - targetWidth;
        }

        targetBboxX = Math.max(viewBox.x, Math.min(viewBox.x + viewBox.width - targetWidth, targetBboxX));
        targetBboxY = Math.max(viewBox.y, Math.min(viewBox.y + viewBox.height - targetHeight, targetBboxY));

        const bboxDx = targetBboxX - resize.startBBox.x;
        const bboxDy = targetBboxY - resize.startBBox.y;

        updateCharacter(resize.charId, {
          x: resize.startChar.x + bboxDx,
          baselineY: resize.startChar.baselineY + bboxDy,
          fontSize: nextFontSize,
        });
      }
    },
    [getSvgPoint, updateCharacter, viewBox]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
        dragRef.current = null;
        if (svg?.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        onCharacterMutate?.();
      }
      if (resizeRef.current && resizeRef.current.pointerId === event.pointerId) {
        resizeRef.current = null;
        if (svg?.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        onCharacterMutate?.();
      }
    },
    [onCharacterMutate]
  );

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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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

          <filter id="letterShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="var(--stage-bg)" />
        <rect width="100%" height="100%" fill="url(#grid)" />

        {blockCharPaths.map(({ charPaths }) =>
          charPaths.map((charPath) => {
            const charId = charPath.charId ?? `${charPath.charIndex}`;
            return (
              <CharacterGroup
                key={charId}
                charPath={charPath}
                charId={charId}
                isSelected={selectedCharId === charId}
                onSelect={handleCharSelect}
                onDragStart={beginDrag}
                onResizeStart={beginResize}
                pathRef={registerPathRef}
              />
            );
          })
        )}

        {showDimensions &&
          letterBboxes.map((bbox, i) => (
            <DimensionAnnotations key={`dim-${i}`} bbox={bbox} unit={dimensionUnit} />
          ))}

        {charLeds.map(({ charId, leds }) =>
          leds.map((led, i) => {
            const isManual = led.source === 'manual';
            const charScale = getCharVisualScale(charId);
            const ledScale =
              'scale' in led && typeof (led as { scale?: number }).scale === 'number'
                ? (led as { scale?: number }).scale || 1
                : 1;
            const width = 12 * charScale * ledScale;
            const height = 5 * charScale * ledScale;
            const dotOffset = 3.5 * charScale * ledScale;
            const dotRadius = Math.max(0.7, 1.2 * charScale * ledScale);
            const key = led.id ? `led-${led.id}` : `${charId}-${i}`;

            return (
              <g key={key} transform={`rotate(${led.rotation} ${led.x} ${led.y})`}>
                <rect
                  x={led.x - width / 2}
                  y={led.y - height / 2}
                  width={width}
                  height={height}
                  rx={height / 2}
                  ry={height / 2}
                  fill="none"
                  stroke={isManual ? '#3b82f6' : '#94a3b8'}
                  strokeWidth={0.8}
                />
                <circle cx={led.x - dotOffset} cy={led.y} r={dotRadius} fill="#64748b" />
                <circle cx={led.x + dotOffset} cy={led.y} r={dotRadius} fill="#64748b" />
              </g>
            );
          })
        )}

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
      </svg>

      {showQA && qaResults.length > 0 && (
        <div className="absolute top-3 right-3 z-50 max-w-[360px] bg-slate-950/90 border border-slate-700 rounded-lg p-3 text-xs text-slate-200">
          <div className="font-semibold text-sm mb-2">Placement QA</div>
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
