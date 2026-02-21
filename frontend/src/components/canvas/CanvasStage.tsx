import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  useProjectStore,
  type BlockCharPaths,
  type CharLEDData,
  type ManualLED,
} from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import {
  DEFAULT_QUALITY_THRESHOLDS,
  evaluatePlacementQuality,
  gradePlacement,
} from '../../core/math/placementQuality';
import { generatePositionedCharacterPath, type CharacterPath } from '../../core/math/characterPaths';
import type { BoundingBox } from '../../core/math/dimensions';
import { DesignerKonvaStage } from './konva/DesignerKonvaStage';
import { createPathRegistry } from './geometry/pathRegistry';
import { USE_KONVA_DESIGNER_STAGE } from '../../config/featureFlags';
import {
  createIdentityShapeOverride,
  normalizeShapeOverride,
  resolveShapePath,
} from '../../core/math/shapeWarp';

interface CanvasStageProps {
  onCharacterMutate?: () => void;
}

const FIXED_STAGE_VIEWBOX = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
};

export const CanvasStage: React.FC<CanvasStageProps> = ({ onCharacterMutate }) => {
  const {
    blocks,
    charactersByBlock,
    updateEngineeringData,
    selectedCharId,
    manualLedOverrides,
    charShapeOverrides,
    selectChar,
    getCharacter,
    updateCharacter,
    getCharManualLeds,
    showDimensions,
    dimensionUnit,
  } = useProjectStore();

  const [charLeds, setCharLeds] = useState<CharLEDData[]>([]);
  const pathRegistryRef = useRef<ReturnType<typeof createPathRegistry> | null>(null);
  const activePathIdsRef = useRef<Set<string>>(new Set());

  const prevBlockCharPathsRef = useRef<BlockCharPaths[] | null>(null);
  const prevManualOverridesRef = useRef(manualLedOverrides);

  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);
  const { fonts, loading } = useFonts(neededLanguages);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const registry = createPathRegistry();
    pathRegistryRef.current = registry;
    return () => {
      registry.dispose();
      pathRegistryRef.current = null;
    };
  }, []);

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
        const fallbackBBox = positioned.bbox ?? {
          x: positioned.x,
          y: char.baselineY - char.fontSize,
          width: Math.max(1, positioned.width || char.fontSize * 0.7),
          height: Math.max(1, char.fontSize),
        };
        const shape =
          normalizeShapeOverride(charShapeOverrides[char.id], fallbackBBox) ??
          createIdentityShapeOverride(fallbackBBox);
        const warped = resolveShapePath(positioned.pathData, shape, fallbackBBox);
        return {
          ...positioned,
          charIndex: index,
          charId: char.id,
          pathData: warped.pathData,
          bbox: warped.bbox,
        };
      });
      return {
        blockId: block.id,
        charPaths,
      };
    });
  }, [blocks, charactersByBlock, charShapeOverrides, fonts]);

  useLayoutEffect(() => {
    const registry = pathRegistryRef.current;
    if (!registry) return;
    const next = new Set<string>();

    blockCharPaths.forEach(({ charPaths }) => {
      charPaths.forEach((cp) => {
        if (!cp.charId || !cp.pathData) return;
        registry.setPath(cp.charId, cp.pathData);
        next.add(cp.charId);
      });
    });

    activePathIdsRef.current.forEach((id) => {
      if (!next.has(id)) registry.removePath(id);
    });
    activePathIdsRef.current = next;
  }, [blockCharPaths]);

  const charPathMap = useMemo(() => {
    const map = new Map<string, CharacterPath>();
    blockCharPaths.forEach(({ charPaths }) => {
      charPaths.forEach((cp) => {
        if (cp.charId) map.set(cp.charId, cp);
      });
    });
    return map;
  }, [blockCharPaths]);

  const getCharBBox = useCallback(
    (charId: string): BoundingBox | null => {
      const registry = pathRegistryRef.current;
      const svgBBox = registry?.getBBox(charId) ?? null;
      if (svgBBox) return svgBBox;
      const cp = charPathMap.get(charId);
      if (cp?.bbox) return cp.bbox;
      return null;
    },
    [charPathMap]
  );

  const toAbsoluteLED = useCallback((led: ManualLED, bbox: BoundingBox) => {
    const hasUv = Number.isFinite(led.u) && Number.isFinite(led.v);
    const x = hasUv ? bbox.x + led.u * bbox.width : (led.x ?? bbox.x);
    const y = hasUv ? bbox.y + led.v * bbox.height : (led.y ?? bbox.y);
    return {
      x,
      y,
      rotation: led.rotation,
      id: led.id,
      ...(typeof led.scale === 'number' ? { scale: led.scale } : {}),
      source: 'manual' as const,
    };
  }, []);

  useEffect(() => {
    const blockPathsChanged =
      !prevBlockCharPathsRef.current || blockCharPaths !== prevBlockCharPathsRef.current;
    const manualOverridesChanged = manualLedOverrides !== prevManualOverridesRef.current;

    if (!blockPathsChanged && !manualOverridesChanged) return;

    prevBlockCharPathsRef.current = blockCharPaths;
    prevManualOverridesRef.current = manualLedOverrides;

    const registry = pathRegistryRef.current;
    if (!registry || blockCharPaths.length === 0) return;

    const allCharLeds: CharLEDData[] = [];

    blockCharPaths.forEach(({ charPaths }) => {
      charPaths.forEach((charPath) => {
        if (!charPath.pathData || !charPath.charId) return;
        const charId = charPath.charId;
        const pathEl = registry.getPathElement(charId);
        if (!pathEl) return;

        const bbox = charPath.bbox || getCharBBox(charId);
        const manualLeds = getCharManualLeds(charId);
        if (!bbox) return;
        const positions = manualLeds.map((led) => toAbsoluteLED(led, bbox));
        allCharLeds.push({ charId, leds: positions });
      });
    });

    queueMicrotask(() => setCharLeds(allCharLeds));
    const totalLeds = allCharLeds.reduce((sum, c) => sum + c.leds.length, 0);
    updateEngineeringData(totalLeds);
    useProjectStore.getState().setComputedLayoutData({
      blockCharPaths,
      charLeds: allCharLeds,
    });
  }, [
    blockCharPaths,
    manualLedOverrides,
    updateEngineeringData,
    getCharManualLeds,
    getCharBBox,
    toAbsoluteLED,
  ]);

  const allLeds = useMemo(() => charLeds.flatMap((c) => c.leds), [charLeds]);

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

  const getCharVisualScale = useCallback((charId: string) => charScaleMap.get(charId) ?? 1, [charScaleMap]);

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

    const registry = pathRegistryRef.current;
    if (!registry) return;
    const results: QAResultItem[] = [];
    charLeds.forEach((charData) => {
      const path = registry.getPathElement(charData.charId);
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

  const viewBox = FIXED_STAGE_VIEWBOX;

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--surface-panel)]">
        <div className="flex items-center gap-3 text-[var(--text-3)]">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading Font Engine...
        </div>
      </div>
    );
  }

  if (!USE_KONVA_DESIGNER_STAGE) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-none bg-[var(--stage-bg)] text-sm text-[var(--text-3)]">
        Designer SVG fallback disabled.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <DesignerKonvaStage
        viewBox={viewBox}
        blockCharPaths={blockCharPaths}
        charLeds={charLeds}
        selectedCharId={selectedCharId}
        showDimensions={showDimensions}
        dimensionUnit={dimensionUnit}
        getCharacter={getCharacter}
        getCharBBox={getCharBBox}
        updateCharacter={updateCharacter}
        onSelectChar={selectChar}
        onClearSelection={() => selectChar(null)}
        onCharacterMutate={onCharacterMutate}
        getCharVisualScale={getCharVisualScale}
        allLedCount={allLeds.length}
      />

      {showQA && qaResults.length > 0 && (
        <div className="absolute right-3 top-3 z-50 max-w-[360px] rounded-lg border border-[var(--border-1)] bg-[var(--surface-panel)]/95 p-3 text-xs text-[var(--text-2)]">
          <div className="mb-2 text-sm font-semibold text-[var(--text-1)]">Placement QA</div>
          <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
            {qaResults.map((result) => (
              <div
                key={result.charId}
                className={`rounded border px-2 py-1 ${
                  result.grade.pass
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-rose-500/30 bg-rose-500/10'
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
