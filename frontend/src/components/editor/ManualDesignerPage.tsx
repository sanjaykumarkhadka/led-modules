import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import {
  generateCharacterPaths,
  generateFallbackCharacterPaths,
  type CharacterPath,
} from '../../core/math/characterPaths';
import type { ManualLED } from '../../data/store';
import { isCapsuleInside } from '../../core/math/geometry';
import { useToast } from '../ui/ToastProvider';
import { useConfirm } from '../ui/ConfirmProvider';
import { useProjectsStore } from '../../state/projectsStore';
import { useAuthStore } from '../../state/authStore';
import { createShapeGeometryAdapter } from './geometry/shapeGeometryAdapter';
import { ManualKonvaCanvas } from './konva/ManualKonvaCanvas';
import { ShapePaperCanvas } from './paper/ShapePaperCanvas';
import { USE_KONVA_MANUAL_EDITOR } from '../../config/featureFlags';
import { MAX_LED_SCALE, MIN_LED_SCALE } from '../canvas/konva/editorPolicies';
import {
  createPathShapeOverride,
  normalizeShapeOverride,
  pathBBoxFromPathData,
  resolveShapePath,
  type CharacterShapeOverride,
} from '../../core/math/shapeWarp';
import {
  buildEditableAnchorPoints,
  moveEditableAnchorPointSafe,
  type EditablePathPoint,
} from '../../core/math/pathEditor';
import { resolveManualLedPoint } from '../../core/math/manualLedCoordinates';
import { commitCharacterShapeOverride } from '../../api/projectShapes';
import type { ShapeModulePreviewLed } from './paper/ShapePaperCanvas';
import { generateLEDPositions, estimateGridCount, createDefaultAutofillConfig } from '../../core/math/placement';

// Path from assets/rotating-arrow-to-the-left-svgrepo-com.svg (viewBox 0 0 305.836 305.836)
const ROTATE_ARROW_PATH =
  'M152.924,300.748c84.319,0,152.912-68.6,152.912-152.918c0-39.476-15.312-77.231-42.346-105.564 c0,0,3.938-8.857,8.814-19.783c4.864-10.926-2.138-18.636-15.648-17.228l-79.125,8.289c-13.511,1.411-17.999,11.467-10.021,22.461 l46.741,64.393c7.986,10.992,17.834,12.31,22.008,2.937l7.56-16.964c12.172,18.012,18.976,39.329,18.976,61.459 c0,60.594-49.288,109.875-109.87,109.875c-60.591,0-109.882-49.287-109.882-109.875c0-19.086,4.96-37.878,14.357-54.337 c5.891-10.325,2.3-23.467-8.025-29.357c-10.328-5.896-23.464-2.3-29.36,8.031C6.923,95.107,0,121.27,0,147.829 C0,232.148,68.602,300.748,152.924,300.748z';
const ROTATE_ARROW_VIEWBOX_CENTER = 152.918;
const ROTATE_ARROW_VIEWBOX_SIZE = 305.836;
const MAX_ZOOM_IN_FACTOR = 0.05;
const MAX_MODULES_PER_CHARACTER = 600;
const MANUAL_EDITOR_FIT_PADDING = 0.05;
const MANUAL_EDITOR_HEADER_HEIGHT = 64;
const MANUAL_EDITOR_OUTER_PADDING = 16;
const MANUAL_EDITOR_MIN_VIEWPORT_HEIGHT = 420;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const createLedId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ShapeSessionFrame {
  bounds: { x: number; y: number; width: number; height: number };
  pathOffset: { x: number; y: number };
}

const expandBox = (
  bbox: { x: number; y: number; width: number; height: number },
  pad = MANUAL_EDITOR_FIT_PADDING
) => {
  const paddingX = bbox.width * pad;
  const paddingY = bbox.height * pad;
  return {
    x: bbox.x - paddingX,
    y: bbox.y - paddingY,
    width: bbox.width + paddingX * 2,
    height: bbox.height + paddingY * 2,
  };
};

const fitViewBoxToContainer = (
  bbox: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number,
  padding = MANUAL_EDITOR_FIT_PADDING
) => {
  const expanded = expandBox(bbox, padding);
  if (containerWidth <= 1 || containerHeight <= 1) return expanded;

  const containerAspect = containerWidth / containerHeight;
  const boxAspect = expanded.width / Math.max(1e-6, expanded.height);

  if (boxAspect > containerAspect) {
    const targetHeight = expanded.width / containerAspect;
    const dy = (targetHeight - expanded.height) / 2;
    return {
      x: expanded.x,
      y: expanded.y - dy,
      width: expanded.width,
      height: targetHeight,
    };
  }

  const targetWidth = expanded.height * containerAspect;
  const dx = (targetWidth - expanded.width) / 2;
  return {
    x: expanded.x - dx,
    y: expanded.y,
    width: targetWidth,
    height: expanded.height,
  };
};

const zoomViewBox = (viewBox: ViewBox, factor: number, anchor: { x: number; y: number }) => {
  const nextWidth = viewBox.width * factor;
  const nextHeight = viewBox.height * factor;
  const nextX = anchor.x - (anchor.x - viewBox.x) * factor;
  const nextY = anchor.y - (anchor.y - viewBox.y) * factor;
  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight,
  };
};

interface ManualDesignerPageProps {
  projectId: string;
  charId: string;
  mode: 'module' | 'shape';
  onSwitchMode: (mode: 'module' | 'shape') => void;
  onBack: () => void;
}

export const ManualDesignerPage: React.FC<ManualDesignerPageProps> = ({
  projectId,
  charId,
  mode,
  onSwitchMode,
  onBack,
}) => {
  // Set `VITE_MANUAL_ZOOM_DEBUG=1` to enable verbose zoom diagnostics in dev.
  const DEBUG_ZOOM = import.meta.env.DEV && import.meta.env.VITE_MANUAL_ZOOM_DEBUG === '1';
  const blocks = useProjectStore((state) => state.blocks);
  const charactersByBlock = useProjectStore((state) => state.charactersByBlock);
  const getCharManualLeds = useProjectStore((state) => state.getCharManualLeds);
  const setCharManualLeds = useProjectStore((state) => state.setCharManualLeds);
  const getCharShapeOverride = useProjectStore((state) => state.getCharShapeOverride);
  const setCharShapeOverride = useProjectStore((state) => state.setCharShapeOverride);
  const currentModule = useProjectStore((state) => state.getCurrentModule());
  const projects = useProjectsStore((state) => state.projects);
  const saveCurrentProject = useProjectsStore((state) => state.saveCurrentProject);
  const projectsSaving = useProjectsStore((state) => state.loading);
  const { notify } = useToast();
  const { confirm } = useConfirm();
  const editorCharId = charId;
  const editorMode = mode;

  const [snapEnabled] = useState(false);
  const [gridSize] = useState(2);
  const [tool, setTool] = useState<'select' | 'pan' | 'add' | 'boxSelect'>('select');
  const [isPanning, setIsPanning] = useState(false);
  const [selectedLedIds, setSelectedLedIds] = useState<Set<string>>(new Set());
  const [draftLeds, setDraftLeds] = useState<ManualLED[]>([]);

  const primarySelectedId = selectedLedIds.size === 1 ? Array.from(selectedLedIds)[0] : null;
  const clearSelection = useCallback(() => setSelectedLedIds(new Set()), []);
  const selectOnly = useCallback((id: string) => setSelectedLedIds(new Set([id])), []);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [baseViewBox, setBaseViewBox] = useState<ViewBox | null>(null);
  const [fixedLocalBounds, setFixedLocalBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [invalidLedIds, setInvalidLedIds] = useState<Set<string>>(new Set());
  const [draftShapeOverride, setDraftShapeOverride] = useState<CharacterShapeOverride | null>(null);
  const [selectedShapePointId, setSelectedShapePointId] = useState<string | null>(null);
  const [shapeSessionFrame, setShapeSessionFrame] = useState<ShapeSessionFrame | null>(null);
  const [groupSpacing, setGroupSpacing] = useState(1);
  const [groupScale, setGroupScale] = useState(1);
  const [groupAngle, setGroupAngle] = useState(0);
  const [showShapeModulePreview, setShowShapeModulePreview] = useState(true);

  // Autofill configuration state
  const [autofillOrientation, setAutofillOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [autofillModuleScale, setAutofillModuleScale] = useState(1.0);
  const [autofillSpacing, setAutofillSpacing] = useState(2);
  const [autofillInset, setAutofillInset] = useState(1);
  const [autofillRunning, setAutofillRunning] = useState(false);
  const groupSpacingRef = useRef(1);
  const lastValidShapePathRef = useRef<string | null>(null);
  const shapeAnchorOriginRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const shapeAnchorOriginCharIdRef = useRef<string | null>(null);
  const selectedLedIdsRef = useRef<Set<string>>(new Set());
  const seededViewportCharIdRef = useRef<string | null>(null);
  const moduleFitSignatureRef = useRef<string | null>(null);
  const userViewportInteractionRef = useRef(false);
  const warnedRefitDuringInteractionRef = useRef(false);
  useEffect(() => {
    selectedLedIdsRef.current = selectedLedIds;
  }, [selectedLedIds]);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const geometryAdapterRef = useRef<ReturnType<typeof createShapeGeometryAdapter> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    leadId: string;
    allIds: string[];
    startPositions: Map<string, { u: number; v: number }>;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    start: { x: number; y: number };
    viewBox: ViewBox;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    ledId: string;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startScale: number;
    startU: number;
    startV: number;
  } | null>(null);
  type RotateRefSingle = {
    kind: 'single';
    pointerId: number;
    ledId: string;
    startRotation: number;
    startAngleDeg: number;
  };
  type RotateRefGroup = {
    kind: 'group';
    pointerId: number;
    ledIds: string[];
    startRotations: Map<string, number>;
    startPositions: Map<string, { x: number; y: number }>;
    centerX: number;
    centerY: number;
    startAngleDeg: number;
  };
  const rotateRef = useRef<RotateRefSingle | RotateRefGroup | null>(null);
  const marqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [availableHeightPx, setAvailableHeightPx] = useState(() =>
    typeof window === 'undefined'
      ? 760
      : Math.max(
          MANUAL_EDITOR_MIN_VIEWPORT_HEIGHT,
          window.innerHeight - MANUAL_EDITOR_HEADER_HEIGHT - MANUAL_EDITOR_OUTER_PADDING
        )
  );
  const [moduleHostSize, setModuleHostSize] = useState({ width: 0, height: 0 });
  const prevViewBoxRef = useRef<ViewBox | null>(null);

  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);
  const { fonts, loading } = useFonts(neededLanguages);

  const blockCharPaths = useMemo(() => {
    return blocks.map((block) => {
      const blockFont = fonts.get(block.language);
      const chars = [...(charactersByBlock[block.id] ?? [])].sort((a, b) => a.order - b.order);
      let charPaths: CharacterPath[] = [];
      if (chars.length > 0) {
        charPaths = chars.map((char, index) => {
          const single = blockFont
            ? generateCharacterPaths(char.glyph, blockFont, char.x, char.baselineY, char.fontSize)
            : generateFallbackCharacterPaths(char.glyph, char.x, char.baselineY, char.fontSize);
          return {
            ...single[0],
            charIndex: index,
            charId: char.id,
          };
        });
      } else if (block.text) {
        charPaths = generateFallbackCharacterPaths(block.text, block.x, block.y, block.fontSize);
      }
      return { blockId: block.id, charPaths };
    });
  }, [blocks, charactersByBlock, fonts]);

  const baseCharPath = useMemo(() => {
    if (!editorCharId) return null;
    for (const block of blockCharPaths) {
      const matched = block.charPaths.find((cp) => cp.charId === editorCharId);
      if (matched) return matched;
    }
    return null;
  }, [blockCharPaths, editorCharId]);

  const activeBlockFontSize = useMemo(() => {
    if (!editorCharId) return 150;
    for (const chars of Object.values(charactersByBlock)) {
      const found = chars.find((char) => char.id === editorCharId);
      if (found) return found.fontSize;
    }
    return 150;
  }, [charactersByBlock, editorCharId]);

  const charVisualScale = useMemo(() => clamp(activeBlockFontSize / 150, 0.05, 3), [activeBlockFontSize]);

  const baseBBox = useMemo(() => {
    if (!baseCharPath) return null;
    return (
      baseCharPath.bbox ?? {
        x: baseCharPath.x,
        y: 0,
        width: Math.max(1, baseCharPath.width || activeBlockFontSize * 0.7),
        height: Math.max(1, activeBlockFontSize),
      }
    );
  }, [activeBlockFontSize, baseCharPath]);

  useEffect(() => {
    if (!editorCharId || !baseBBox) return;
    const persisted = normalizeShapeOverride(
      getCharShapeOverride(editorCharId) ?? undefined,
      baseBBox,
      baseCharPath?.pathData
    );
    queueMicrotask(() => {
      setDraftShapeOverride(persisted);
      lastValidShapePathRef.current = persisted.outerPath ?? '';
      setSelectedShapePointId(null);
    });
  }, [baseBBox, baseCharPath?.pathData, editorCharId, getCharShapeOverride]);

  const renderedPath = useMemo(() => {
    if (!baseCharPath || !baseBBox) return null;
    const persisted = normalizeShapeOverride(
      getCharShapeOverride(editorCharId) ?? undefined,
      baseBBox,
      baseCharPath.pathData
    );
    const active =
      editorMode === 'shape'
        ? normalizeShapeOverride(draftShapeOverride ?? undefined, baseBBox, persisted.outerPath ?? baseCharPath.pathData)
        : persisted;
    return resolveShapePath(baseCharPath.pathData, active, baseBBox);
  }, [baseBBox, baseCharPath, draftShapeOverride, editorCharId, editorMode, getCharShapeOverride]);

  const editableShapePoints = useMemo<EditablePathPoint[]>(() => {
    if (editorMode !== 'shape') return [];
    const pathData = draftShapeOverride?.outerPath || renderedPath?.pathData || '';
    if (!pathData) return [];
    return buildEditableAnchorPoints(pathData);
  }, [draftShapeOverride?.outerPath, editorMode, renderedPath?.pathData]);

  useEffect(() => {
    if (editorMode !== 'shape') {
      shapeAnchorOriginRef.current.clear();
      shapeAnchorOriginCharIdRef.current = null;
      return;
    }
    if (!editorCharId || editableShapePoints.length === 0) return;
    if (shapeAnchorOriginCharIdRef.current === editorCharId && shapeAnchorOriginRef.current.size > 0) return;
    const nextOrigins = new Map<string, { x: number; y: number }>();
    editableShapePoints.forEach((point) => {
      nextOrigins.set(point.id, { x: point.x, y: point.y });
    });
    shapeAnchorOriginRef.current = nextOrigins;
    shapeAnchorOriginCharIdRef.current = editorCharId;
  }, [editableShapePoints, editorCharId, editorMode]);

  const bbox = renderedPath?.bbox || baseBBox || null;
  const [pathBounds, setPathBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!editorCharId) return;
    const initial = getCharManualLeds(editorCharId);
    queueMicrotask(() => {
      setDraftLeds(initial.map((led) => ({ ...led })));
      clearSelection();
      setIsDirty(false);
      setInvalidLedIds(new Set());
    });
  }, [clearSelection, editorCharId, getCharManualLeds]);

  useLayoutEffect(() => {
    if (!pathRef.current) return;
    if (editorMode === 'shape') return;
    const handle = requestAnimationFrame(() => {
      try {
        const bounds = pathRef.current?.getBBox();
        if (bounds && isFinite(bounds.x) && isFinite(bounds.y)) {
          setPathBounds({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          });
        }
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [editorMode, renderedPath?.pathData, editorCharId]);

  useEffect(() => {
    const updateAvailableHeight = () => {
      const next = Math.max(
        MANUAL_EDITOR_MIN_VIEWPORT_HEIGHT,
        window.innerHeight - MANUAL_EDITOR_HEADER_HEIGHT - MANUAL_EDITOR_OUTER_PADDING
      );
      setAvailableHeightPx(next);
    };
    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);
    return () => window.removeEventListener('resize', updateAvailableHeight);
  }, []);

  useEffect(() => {
    const target = canvasViewportRef.current ?? canvasContainerRef.current;
    if (!target) return;

    const updateHostSize = () => {
      const rect = target.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(rect.width));
      const nextHeight = Math.max(0, Math.floor(rect.height));
      setModuleHostSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : {
              width: nextWidth,
              height: nextHeight,
            }
      );
    };

    updateHostSize();
    const ro = new ResizeObserver(updateHostSize);
    ro.observe(target);
    return () => ro.disconnect();
  }, [availableHeightPx, editorMode, loading]);

  useEffect(() => {
    seededViewportCharIdRef.current = null;
    moduleFitSignatureRef.current = null;
    userViewportInteractionRef.current = false;
    warnedRefitDuringInteractionRef.current = false;
    setFixedLocalBounds(null);
    setBaseViewBox(null);
    setViewBox(null);
    setShapeSessionFrame(null);
  }, [editorCharId]);

  useEffect(() => {
    if (editorMode !== 'module') {
      moduleFitSignatureRef.current = null;
      userViewportInteractionRef.current = false;
      warnedRefitDuringInteractionRef.current = false;
    }
  }, [editorMode]);

  useEffect(() => {
    if (editorMode !== 'shape') {
      if (shapeSessionFrame) setShapeSessionFrame(null);
      // Clear the baseline so ShapePaperCanvas re-seeds it when shape mode is
      // entered again (Paper.js may produce a different normalised string next time).
      lastValidShapePathRef.current = null;
      return;
    }
    if (shapeSessionFrame) return;
    const source = bbox;
    if (!source) return;
    setShapeSessionFrame({
      bounds: {
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
      },
      pathOffset: { x: source.x, y: source.y },
    });
  }, [bbox, editorMode, shapeSessionFrame]);

  useEffect(() => {
    if (editorMode !== 'module') return;
    const source = bbox ?? pathBounds;
    if (!source || !editorCharId) return;
    if (moduleHostSize.width <= 1 || moduleHostSize.height <= 1) return;
    const fitSignature = [
      editorCharId,
      Math.round(source.x * 1000),
      Math.round(source.y * 1000),
      Math.round(source.width * 1000),
      Math.round(source.height * 1000),
      moduleHostSize.width,
      moduleHostSize.height,
    ].join('|');
    if (moduleFitSignatureRef.current === fitSignature) return;
    if (userViewportInteractionRef.current) {
      if (DEBUG_ZOOM && !warnedRefitDuringInteractionRef.current) {
        warnedRefitDuringInteractionRef.current = true;
        console.warn('[manual-zoom] skipped refit during active viewport interaction', {
          fitSignature,
          prevSignature: moduleFitSignatureRef.current,
        });
      }
      return;
    }

    const local = { x: 0, y: 0, width: source.width, height: source.height };
    const base = fitViewBoxToContainer(
      local,
      moduleHostSize.width,
      moduleHostSize.height,
      MANUAL_EDITOR_FIT_PADDING
    );
    seededViewportCharIdRef.current = editorCharId;
    moduleFitSignatureRef.current = fitSignature;
    warnedRefitDuringInteractionRef.current = false;
    if (DEBUG_ZOOM) {
      console.debug('[manual-zoom] applying module refit', {
        fitSignature,
        local,
        base,
      });
    }
    queueMicrotask(() => {
      setFixedLocalBounds(local);
      setBaseViewBox(base);
      setViewBox(base);
    });
  }, [DEBUG_ZOOM, bbox, editorCharId, editorMode, moduleHostSize.height, moduleHostSize.width, pathBounds]);

  const clampViewBoxToBase = useCallback(
    (next: ViewBox) => {
      if (!baseViewBox) return next;
      const minWidth = baseViewBox.width * MAX_ZOOM_IN_FACTOR;
      const minHeight = baseViewBox.height * MAX_ZOOM_IN_FACTOR;
      const clampedWidth = Math.max(minWidth, Math.min(next.width, baseViewBox.width));
      const clampedHeight = Math.max(minHeight, Math.min(next.height, baseViewBox.height));
      const minX = baseViewBox.x;
      const minY = baseViewBox.y;
      const maxX = baseViewBox.x + baseViewBox.width - clampedWidth;
      const maxY = baseViewBox.y + baseViewBox.height - clampedHeight;
      return {
        width: clampedWidth,
        height: clampedHeight,
        x: clamp(next.x, minX, maxX),
        y: clamp(next.y, minY, maxY),
      };
    },
    [baseViewBox]
  );

  useEffect(() => {
    if (!DEBUG_ZOOM || editorMode !== 'module') return;
    if (!viewBox) return;
    const prev = prevViewBoxRef.current;
    console.debug('[manual-zoom:viewBox-change]', {
      prev,
      next: viewBox,
      interactionActive: userViewportInteractionRef.current,
      fitSignature: moduleFitSignatureRef.current,
      hostSize: moduleHostSize,
      bbox,
      pathBounds,
    });
    prevViewBoxRef.current = viewBox;
  }, [DEBUG_ZOOM, bbox, editorMode, moduleHostSize, pathBounds, viewBox]);

  useEffect(() => {
    if (USE_KONVA_MANUAL_EDITOR) return;
    if (editorMode !== 'module') return;
    const container = canvasContainerRef.current;
    if (!container || !viewBox) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const transformed = pt.matrixTransform(ctm.inverse());
      const point = { x: transformed.x, y: transformed.y };
      const factor = e.deltaY > 0 ? 1.03 : 0.97;
      const next = zoomViewBox(viewBox, factor, point);
      setViewBox(clampViewBoxToBase(next));
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [editorMode, viewBox, clampViewBoxToBase]);

  const canonicalFrame = useMemo(() => bbox ?? pathBounds ?? null, [bbox, pathBounds]);

  const localBounds = useMemo(() => {
    const source = fixedLocalBounds || canonicalFrame;
    if (!source) return null;
    return {
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
    };
  }, [canonicalFrame, fixedLocalBounds]);

  const shapeEditBounds = useMemo(() => {
    const source = shapeSessionFrame?.bounds ?? canonicalFrame;
    if (!source) return null;
    return {
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
    };
  }, [canonicalFrame, shapeSessionFrame?.bounds]);

  const pathTransform = useMemo(() => {
    const source = canonicalFrame;
    if (!source) return undefined;
    return `translate(${-source.x} ${-source.y})`;
  }, [canonicalFrame]);

  const pathOffset = useMemo(() => {
    const source = shapeSessionFrame?.pathOffset ?? canonicalFrame;
    if (!source) return { x: 0, y: 0 };
    return { x: source.x, y: source.y };
  }, [canonicalFrame, shapeSessionFrame?.pathOffset]);

  useEffect(() => {
    if (!geometryAdapterRef.current) {
      geometryAdapterRef.current = createShapeGeometryAdapter();
    }
    return () => {
      geometryAdapterRef.current?.dispose();
      geometryAdapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const adapter = geometryAdapterRef.current;
    if (!adapter) return;
    adapter.setPath(renderedPath?.pathData || '');
  }, [renderedPath?.pathData]);

  const BASE_LED_WIDTH = 12;
  const BASE_LED_HEIGHT = 5;

  const absoluteLeds = useMemo(() => {
    if (!localBounds) return [];
    return draftLeds.map((led) => {
      let scale = led.scale ?? 1;
      const leg = led as ManualLED & { width?: number; height?: number };
      if (scale === 1 && (leg.width != null || leg.height != null))
        scale =
          ((leg.width ?? BASE_LED_WIDTH) / BASE_LED_WIDTH +
            (leg.height ?? BASE_LED_HEIGHT) / BASE_LED_HEIGHT) /
          2;
      const w = BASE_LED_WIDTH * scale * charVisualScale;
      const h = BASE_LED_HEIGHT * scale * charVisualScale;
      const { x, y } = resolveManualLedPoint(led, localBounds);
      return {
        ...led,
        x,
        y,
        w,
        h,
        scale,
      };
    });
  }, [charVisualScale, draftLeds, localBounds]);

  const shapePreviewLeds = useMemo<ShapeModulePreviewLed[]>(
    () =>
      absoluteLeds.map((led) => ({
        id: led.id,
        x: led.x + pathOffset.x,
        y: led.y + pathOffset.y,
        w: led.w,
        h: led.h,
        rotation: led.rotation ?? 0,
        invalid: invalidLedIds.has(led.id),
      })),
    [absoluteLeds, invalidLedIds, pathOffset.x, pathOffset.y]
  );

  /** Render order: draw lower LEDs first so higher ones (smaller y) are on top and get clicks. */
  const absoluteLedsRenderOrder = useMemo(
    () => [...absoluteLeds].sort((a, b) => b.y - a.y),
    [absoluteLeds]
  );

  /** Group LEDs that are literally on top of each other (same spot, indistinguishable). */
  const ledStacks = useMemo(() => {
    const groups: string[][] = [];
    const used = new Set<string>();
    for (let i = 0; i < absoluteLeds.length; i++) {
      const a = absoluteLeds[i];
      if (used.has(a.id)) continue;
      const stack: string[] = [a.id];
      used.add(a.id);
      for (let j = i + 1; j < absoluteLeds.length; j++) {
        const b = absoluteLeds[j];
        if (used.has(b.id)) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const size = Math.min(a.w, a.h, b.w, b.h);
        // Treat as a true stack only when centers are almost identical.
        const stackThreshold = size * 0.3;
        if (Math.hypot(dx, dy) < stackThreshold) {
          stack.push(b.id);
          used.add(b.id);
        }
      }
      if (stack.length > 0) groups.push(stack);
    }
    return groups;
  }, [absoluteLeds]);

  const stackCountByLedId = useMemo(() => {
    const map = new Map<string, number>();
    for (const stack of ledStacks) {
      for (const id of stack) map.set(id, stack.length);
    }
    return map;
  }, [ledStacks]);

  /** For each stack, the topmost LED (drawn last) shows the indicator. */
  const topmostLedIdPerStack = useMemo(() => {
    const set = new Set<string>();
    for (const stack of ledStacks) {
      if (stack.length < 2) continue;
      const topmost = absoluteLeds.filter((led) => stack.includes(led.id)).pop();
      if (topmost) set.add(topmost.id);
    }
    return set;
  }, [absoluteLeds, ledStacks]);

  /** Group center (average of selected LEDs) when 2+ selected. */
  const groupCenter = useMemo(() => {
    if (selectedLedIds.size < 2) return null;
    const selected = absoluteLeds.filter((led) => selectedLedIds.has(led.id));
    if (selected.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const led of selected) {
      sx += led.x;
      sy += led.y;
    }
    return { x: sx / selected.length, y: sy / selected.length };
  }, [absoluteLeds, selectedLedIds]);

  const getSvgPoint = useCallback((event: React.PointerEvent<SVGElement>) => {
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

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (!snapEnabled) return point;
      const size = gridSize || 1;
      return {
        x: Math.round(point.x / size) * size,
        y: Math.round(point.y / size) * size,
      };
    },
    [gridSize, snapEnabled]
  );

  const toManual = useCallback(
    (point: { x: number; y: number }) => {
      if (!localBounds) return { u: 0, v: 0 };
      const u = clamp01((point.x - localBounds.x) / localBounds.width);
      const v = clamp01((point.y - localBounds.y) / localBounds.height);
      return { u, v };
    },
    [localBounds]
  );

  /** Same as toManual but no clamping — for group ops so positions can go outside [0,1]. */
  const toManualUnclamped = useCallback(
    (point: { x: number; y: number }) => {
      if (!localBounds) return { u: 0, v: 0 };
      const u = (point.x - localBounds.x) / localBounds.width;
      const v = (point.y - localBounds.y) / localBounds.height;
      return { u, v };
    },
    [localBounds]
  );

  const addLedAtPoint = useCallback(
    (point: { x: number; y: number }, rotation = 0, scale?: number) => {
      if (!localBounds) return;
      const snapped = snapPoint(point);
      const normalized = toManualUnclamped(snapped);
      const newLed: ManualLED = {
        id: createLedId(),
        u: normalized.u,
        v: normalized.v,
        x: snapped.x,
        y: snapped.y,
        rotation,
        ...(scale != null && scale !== 1 && { scale }),
      };
      setDraftLeds((prev) => [...prev, newLed]);
      setSelectedLedIds(new Set([newLed.id]));
      setIsDirty(true);
    },
    [localBounds, snapPoint, toManualUnclamped]
  );

  const handleLedPointerDown = useCallback(
    (event: React.PointerEvent<SVGGElement>, ledId: string, ledX: number, ledY: number) => {
      event.stopPropagation();
      setInvalidLedIds((prev) => {
        if (!prev.has(ledId)) return prev;
        const next = new Set(prev);
        next.delete(ledId);
        return next;
      });
      const alreadyMultiSelected = selectedLedIds.has(ledId) && selectedLedIds.size >= 2;
      const idsToMove = alreadyMultiSelected ? Array.from(selectedLedIds) : [ledId];
      if (!alreadyMultiSelected) selectOnly(ledId);
      const point = getSvgPoint(event);
      if (!point) return;
      if (idsToMove.length === 0) return;
      const startPositions = new Map<string, { u: number; v: number }>();
      for (const id of idsToMove) {
        const led = draftLeds.find((l) => l.id === id);
        if (led) startPositions.set(id, { u: led.u, v: led.v });
      }
      dragRef.current = {
        pointerId: event.pointerId,
        leadId: ledId,
        allIds: idsToMove,
        startPositions,
        offsetX: point.x - ledX,
        offsetY: point.y - ledY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [draftLeds, getSvgPoint, selectedLedIds, selectOnly]
  );

  const handleLedPointerMove = useCallback(
    (event: React.PointerEvent<SVGGElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (event.pointerId !== drag.pointerId) return;
      if (!localBounds) return;

      const point = getSvgPoint(event);
      if (!point) return;

      const target = snapPoint({
        x: point.x - drag.offsetX,
        y: point.y - drag.offsetY,
      });
      const isGroupDrag = drag.allIds.length >= 2;
      const leadNorm = isGroupDrag ? toManualUnclamped(target) : toManual(target);
      const startLead = drag.startPositions.get(drag.leadId);
      if (!startLead) return;
      const deltaU = leadNorm.u - startLead.u;
      const deltaV = leadNorm.v - startLead.v;

      setDraftLeds((prev) =>
        prev.map((led) => {
          if (!drag.allIds.includes(led.id)) return led;
          const start = drag.startPositions.get(led.id);
          if (!start) return led;
          const nu = start.u + deltaU;
          const nv = start.v + deltaV;
          return {
            ...led,
            u: isGroupDrag ? nu : clamp01(nu),
            v: isGroupDrag ? nv : clamp01(nv),
            x: localBounds.x + (isGroupDrag ? nu : clamp01(nu)) * localBounds.width,
            y: localBounds.y + (isGroupDrag ? nv : clamp01(nv)) * localBounds.height,
          };
        })
      );
      setIsDirty(true);
    },
    [getSvgPoint, localBounds, snapPoint, toManual, toManualUnclamped]
  );

  const handleLedPointerUp = useCallback((event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<SVGElement>, ledId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      event.stopPropagation();
      const led = absoluteLeds.find((l) => l.id === ledId);
      if (!led || !localBounds) return;
      const point = getSvgPoint(event);
      if (!point) return;
      resizeRef.current = {
        pointerId: event.pointerId,
        ledId,
        handle,
        startX: point.x,
        startY: point.y,
        startScale: led.scale ?? 1,
        startU: led.u,
        startV: led.v,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [absoluteLeds, getSvgPoint, localBounds]
  );

  const handleResizePointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const resize = resizeRef.current;
      if (!resize || event.pointerId !== resize.pointerId || !localBounds) return;
      const point = getSvgPoint(event);
      if (!point) return;
      const led = absoluteLeds.find((l) => l.id === resize.ledId);
      if (!led) return;
      const rad = (led.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = point.x - resize.startX;
      const dy = point.y - resize.startY;
      const localDx = dx * cos + dy * sin;
      const localDy = -dx * sin + dy * cos;
      const minScale = MIN_LED_SCALE;
      let scaleDelta = 0;
      switch (resize.handle) {
        case 'se':
          scaleDelta = (localDx / BASE_LED_WIDTH + localDy / BASE_LED_HEIGHT) / 2;
          break;
        case 'sw':
          scaleDelta = (-localDx / BASE_LED_WIDTH + localDy / BASE_LED_HEIGHT) / 2;
          break;
        case 'ne':
          scaleDelta = (localDx / BASE_LED_WIDTH - localDy / BASE_LED_HEIGHT) / 2;
          break;
        case 'nw':
          scaleDelta = (-localDx / BASE_LED_WIDTH - localDy / BASE_LED_HEIGHT) / 2;
          break;
      }
      const newScale = Math.min(MAX_LED_SCALE, Math.max(minScale, resize.startScale + scaleDelta));
      setDraftLeds((prev) =>
        prev.map((l) => (l.id === resize.ledId ? { ...l, scale: newScale } : l))
      );
      setIsDirty(true);
    },
    [absoluteLeds, getSvgPoint, localBounds]
  );

  const handleResizePointerUp = useCallback((event: React.PointerEvent<SVGElement>) => {
    if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
      resizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleRotationHandlePointerDown = useCallback(
    (event: React.PointerEvent<SVGElement>, ledId: string, centerX: number, centerY: number) => {
      event.stopPropagation();
      const point = getSvgPoint(event);
      if (!point) return;
      const led = absoluteLeds.find((l) => l.id === ledId);
      if (!led) return;
      const startAngleRad = Math.atan2(point.y - centerY, point.x - centerX);
      const startAngleDeg = (startAngleRad * 180) / Math.PI;
      rotateRef.current = {
        kind: 'single',
        pointerId: event.pointerId,
        ledId,
        startRotation: led.rotation,
        startAngleDeg,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [absoluteLeds, getSvgPoint]
  );

  const handleGroupRotationHandlePointerDown = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      event.stopPropagation();
      if (!groupCenter || selectedLedIds.size < 2) return;
      const point = getSvgPoint(event);
      if (!point) return;
      const startAngleRad = Math.atan2(point.y - groupCenter.y, point.x - groupCenter.x);
      const startAngleDeg = (startAngleRad * 180) / Math.PI;
      const selected = absoluteLeds.filter((led) => selectedLedIds.has(led.id));
      const startRotations = new Map<string, number>();
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const led of selected) {
        startRotations.set(led.id, led.rotation);
        startPositions.set(led.id, { x: led.x, y: led.y });
      }
      rotateRef.current = {
        kind: 'group',
        pointerId: event.pointerId,
        ledIds: selected.map((l) => l.id),
        startRotations,
        startPositions,
        centerX: groupCenter.x,
        centerY: groupCenter.y,
        startAngleDeg,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [absoluteLeds, getSvgPoint, groupCenter, selectedLedIds]
  );

  const handleRotationHandlePointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const rot = rotateRef.current;
      if (!rot || event.pointerId !== rot.pointerId) return;
      const point = getSvgPoint(event);
      if (!point) return;
      if (rot.kind === 'single') {
        const led = absoluteLeds.find((l) => l.id === rot.ledId);
        if (!led) return;
        const currentAngleRad = Math.atan2(point.y - led.y, point.x - led.x);
        const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
        let newRotation = rot.startRotation + (currentAngleDeg - rot.startAngleDeg);
        newRotation = ((newRotation % 360) + 360) % 360;
        setDraftLeds((prev) =>
          prev.map((l) => (l.id === rot.ledId ? { ...l, rotation: newRotation } : l))
        );
      } else {
        const currentAngleRad = Math.atan2(point.y - rot.centerY, point.x - rot.centerX);
        const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
        const deltaDeg = currentAngleDeg - rot.startAngleDeg;
        const cos = Math.cos((deltaDeg * Math.PI) / 180);
        const sin = Math.sin((deltaDeg * Math.PI) / 180);
        setDraftLeds((prev) =>
          prev.map((led) => {
            if (!rot.ledIds.includes(led.id)) return led;
            const start = rot.startPositions.get(led.id);
            const startRot = rot.startRotations.get(led.id);
            if (start == null || startRot == null) return led;
            const dx = start.x - rot.centerX;
            const dy = start.y - rot.centerY;
            const newX = rot.centerX + dx * cos - dy * sin;
            const newY = rot.centerY + dx * sin + dy * cos;
            const { u, v } = toManualUnclamped({ x: newX, y: newY });
            let newRotation = startRot + deltaDeg;
            newRotation = ((newRotation % 360) + 360) % 360;
            return { ...led, u, v, x: newX, y: newY, rotation: newRotation };
          })
        );
      }
      setIsDirty(true);
    },
    [absoluteLeds, getSvgPoint, toManualUnclamped]
  );

  const handleRotationHandlePointerUp = useCallback((event: React.PointerEvent<SVGElement>) => {
    if (rotateRef.current && event.pointerId === rotateRef.current.pointerId) {
      rotateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleCanvasPointerDown = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const target = event.target as Element | null;
      const onResizeHandle = Boolean(target?.closest('[data-resize-handle]'));
      const onRotationHandle = Boolean(target?.closest('[data-rotation-handle]'));
      const onLed = Boolean(target && target.closest('[data-led]'));
      if (!onResizeHandle && !onRotationHandle && !onLed) {
        const point = getSvgPoint(event);
        if (!point) return;
        if (tool === 'add') {
          addLedAtPoint(point, 0);
          return;
        }
        if (!viewBox) return;
        if (tool === 'boxSelect') {
          // Don't clear selection until marquee finishes — keeps group visible while drawing box
          marqueeRef.current = {
            pointerId: event.pointerId,
            startX: point.x,
            startY: point.y,
          };
          setMarqueeRect({
            startX: point.x,
            startY: point.y,
            endX: point.x,
            endY: point.y,
          });
          event.currentTarget.setPointerCapture(event.pointerId);
        } else {
          clearSelection();
          if (tool === 'pan') {
            panRef.current = {
              pointerId: event.pointerId,
              start: point,
              viewBox,
            };
            setIsPanning(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }
      }
    },
    [clearSelection, getSvgPoint, tool, viewBox, addLedAtPoint]
  );

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const mq = marqueeRef.current;
      if (mq && event.pointerId === mq.pointerId) {
        const point = getSvgPoint(event);
        if (point)
          setMarqueeRect((prev) => (prev ? { ...prev, endX: point.x, endY: point.y } : null));
        return;
      }
      if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
        handleResizePointerMove(event);
        return;
      }
      if (rotateRef.current && event.pointerId === rotateRef.current.pointerId) {
        handleRotationHandlePointerMove(event);
        return;
      }
      if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
        handleLedPointerMove(event as unknown as React.PointerEvent<SVGGElement>);
        return;
      }
      const pan = panRef.current;
      if (!pan || event.pointerId !== pan.pointerId) return;
      const point = getSvgPoint(event);
      if (!point) return;
      const dx = point.x - pan.start.x;
      const dy = point.y - pan.start.y;
      const next = {
        ...pan.viewBox,
        x: pan.viewBox.x - dx,
        y: pan.viewBox.y - dy,
      };
      setViewBox(clampViewBoxToBase(next));
    },
    [
      clampViewBoxToBase,
      getSvgPoint,
      handleLedPointerMove,
      handleResizePointerMove,
      handleRotationHandlePointerMove,
    ]
  );

  const handleCanvasPointerUp = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const mq = marqueeRef.current;
      if (mq && event.pointerId === mq.pointerId) {
        const rect = marqueeRect ?? {
          startX: mq.startX,
          startY: mq.startY,
          endX: mq.startX,
          endY: mq.startY,
        };
        const left = Math.min(rect.startX, rect.endX);
        const right = Math.max(rect.startX, rect.endX);
        const top = Math.min(rect.startY, rect.endY);
        const bottom = Math.max(rect.startY, rect.endY);
        const minSize = 2;
        if (right - left < minSize && bottom - top < minSize) {
          setSelectedLedIds(new Set());
        } else {
          const ids = absoluteLeds
            .filter((led) => {
              const halfW = led.w / 2;
              const halfH = led.h / 2;
              const ledLeft = led.x - halfW;
              const ledRight = led.x + halfW;
              const ledTop = led.y - halfH;
              const ledBottom = led.y + halfH;
              return !(ledRight < left || ledLeft > right || ledBottom < top || ledTop > bottom);
            })
            .map((led) => led.id);
          setSelectedLedIds(new Set(ids));
        }
        marqueeRef.current = null;
        setMarqueeRect(null);
        setTool('select');
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
        handleResizePointerUp(event);
        return;
      }
      if (rotateRef.current && event.pointerId === rotateRef.current.pointerId) {
        handleRotationHandlePointerUp(event);
        return;
      }
      if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
        handleLedPointerUp(event as unknown as React.PointerEvent<SVGGElement>);
        return;
      }
      const pan = panRef.current;
      if (pan && event.pointerId === pan.pointerId) {
        panRef.current = null;
        setIsPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [
      absoluteLeds,
      handleLedPointerUp,
      handleResizePointerUp,
      handleRotationHandlePointerUp,
      marqueeRect,
    ]
  );

  const handleFit = useCallback(() => {
    if (!baseViewBox) return;
    userViewportInteractionRef.current = false;
    warnedRefitDuringInteractionRef.current = false;
    setViewBox(baseViewBox);
  }, [baseViewBox]);

  const handleAddAtCenter = useCallback(() => {
    if (!localBounds) return;
    const center = viewBox
      ? { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 }
      : {
          x: localBounds.x + localBounds.width / 2,
          y: localBounds.y + localBounds.height / 2,
        };
    addLedAtPoint(center, 0);
  }, [addLedAtPoint, localBounds, viewBox]);

  const handleDuplicateSelected = useCallback(() => {
    if (!localBounds || selectedLedIds.size === 0) return;
    const selected = draftLeds.filter((led) => selectedLedIds.has(led.id));
    if (selected.length === 0) return;
    const offset = 6;
    const isGroup = selected.length >= 2;
    setDraftLeds((prev) => {
      const next = [...prev];
      const newLeds: ManualLED[] = [];
      for (const led of selected) {
        const nu = led.u + offset / localBounds.width;
        const nv = led.v + offset / localBounds.height;
        const clampedU = isGroup ? nu : clamp01(nu);
        const clampedV = isGroup ? nv : clamp01(nv);
        newLeds.push({
          id: createLedId(),
          u: clampedU,
          v: clampedV,
          x: localBounds.x + clampedU * localBounds.width,
          y: localBounds.y + clampedV * localBounds.height,
          rotation: led.rotation,
          ...(led.scale != null && led.scale !== 1 && { scale: led.scale }),
        });
      }
      return [...next, ...newLeds];
    });
    setIsDirty(true);
  }, [draftLeds, localBounds, selectedLedIds]);

  const handleClearAll = useCallback(() => {
    setDraftLeds([]);
    clearSelection();
    setIsDirty(true);
  }, [clearSelection]);

  const buildAutofillConfig = useCallback(() => {
    const cfg = createDefaultAutofillConfig();
    cfg.scale = clamp(autofillModuleScale, MIN_LED_SCALE, MAX_LED_SCALE);
    cfg.spacing = autofillSpacing;
    cfg.orientation = autofillOrientation;
    cfg.inset = autofillInset;
    return cfg;
  }, [autofillInset, autofillModuleScale, autofillOrientation, autofillSpacing]);

  const handleAutofill = useCallback(async () => {
    const pathEl =
      pathRef.current ?? geometryAdapterRef.current?.getPathElement() ?? null;
    if (!pathEl || !localBounds) {
      notify({ variant: 'error', title: 'Autofill failed', description: 'Character path not ready.' });
      return;
    }
    const estimatedCount = estimateGridCount(pathEl, buildAutofillConfig());
    if (estimatedCount > MAX_MODULES_PER_CHARACTER) {
      notify({
        variant: 'error',
        title: 'Too many modules',
        description: `Estimated modules (${estimatedCount}) exceed the maximum of ${MAX_MODULES_PER_CHARACTER}. Reduce size/density.`,
      });
      return;
    }

    if (draftLeds.length > 0) {
      const ok = await confirm({
        title: 'Replace all modules?',
        description: 'Autofill will remove all existing modules and fill the character automatically.',
        confirmText: 'Autofill',
        variant: 'danger',
      });
      if (!ok) return;
    }

    setAutofillRunning(true);
    try {
      const positions = generateLEDPositions(pathEl, buildAutofillConfig());
      if (positions.length > MAX_MODULES_PER_CHARACTER) {
        notify({
          variant: 'error',
          title: 'Too many modules',
          description: `Estimated modules must be ${MAX_MODULES_PER_CHARACTER} or fewer.`,
        });
        return;
      }

      if (positions.length === 0) {
        notify({ variant: 'error', title: 'Autofill produced no modules', description: 'Try reducing spacing or inset.' });
        return;
      }

      const newLeds: ManualLED[] = positions.map((pos) => {
        const localX = pos.x - pathOffset.x;
        const localY = pos.y - pathOffset.y;
        const u = localBounds.width > 0 ? (localX - localBounds.x) / localBounds.width : 0;
        const v = localBounds.height > 0 ? (localY - localBounds.y) / localBounds.height : 0;
        return {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          u,
          v,
          x: localX,
          y: localY,
          rotation: pos.rotation,
          scale: autofillModuleScale !== 1 ? autofillModuleScale : undefined,
        };
      });

      setDraftLeds(newLeds);
      clearSelection();
      setIsDirty(true);
      notify({ variant: 'success', title: `Autofill complete — ${newLeds.length} modules placed` });
    } finally {
      setAutofillRunning(false);
    }
  }, [
    autofillModuleScale,
    buildAutofillConfig,
    clearSelection,
    confirm,
    draftLeds.length,
    localBounds,
    notify,
    pathOffset.x,
    pathOffset.y,
  ]);

  /** Estimated LED count preview for the autofill panel */
  const autofillEstimatedCount = useMemo(() => {
    const pathEl =
      pathRef.current ?? geometryAdapterRef.current?.getPathElement() ?? null;
    if (!pathEl || !localBounds) return null;
    try {
      return estimateGridCount(pathEl, buildAutofillConfig());
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildAutofillConfig, localBounds, draftLeds.length]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedLedIds.size === 0) return;
    const toRemove = new Set(selectedLedIds);
    setDraftLeds((prev) => prev.filter((led) => !toRemove.has(led.id)));
    clearSelection();
    setIsDirty(true);
  }, [clearSelection, selectedLedIds]);

  const selectedAbsoluteLeds = useMemo(
    () => absoluteLeds.filter((led) => selectedLedIds.has(led.id)),
    [absoluteLeds, selectedLedIds]
  );

  const alignBounds = useMemo(() => {
    if (selectedAbsoluteLeds.length < 2) return null;
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const led of selectedAbsoluteLeds) {
      const halfW = led.w / 2;
      const halfH = led.h / 2;
      left = Math.min(left, led.x - halfW);
      right = Math.max(right, led.x + halfW);
      top = Math.min(top, led.y - halfH);
      bottom = Math.max(bottom, led.y + halfH);
    }
    return {
      left,
      right,
      top,
      bottom,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    };
  }, [selectedAbsoluteLeds]);

  /** Sync group scale and angle from selection when selection changes */
  useLayoutEffect(() => {
    if (selectedLedIds.size < 2) return;
    const selected = draftLeds.filter((l) => selectedLedIds.has(l.id));
    if (selected.length === 0) return;
    const avgScale = selected.reduce((sum, l) => sum + (l.scale ?? 1), 0) / selected.length;
    const avgRotation = selected.reduce((sum, l) => sum + l.rotation, 0) / selected.length;
    queueMicrotask(() => {
      setGroupScale(avgScale);
      setGroupAngle(((avgRotation % 360) + 360) % 360);
    });
  }, [selectedLedIds, draftLeds]);

  useEffect(() => {
    groupSpacingRef.current = groupSpacing;
  }, [groupSpacing]);

  const GROUP_SPACING_MIN = 0.5;
  const GROUP_SPACING_MAX = 1.2;
  const GROUP_SCALE_MIN = MIN_LED_SCALE;
  const GROUP_SCALE_MAX = MAX_LED_SCALE;
  const GROUP_ANGLE_MIN = 0;
  const GROUP_ANGLE_MAX = 360;

  /** Apply spacing to current selection.
   *  - Slider (no layout arg): preserve current arrangement, scale distances from group center.
   *  - Explicit layout actions: arrange in horizontal/vertical line.
   */
  const applyGroupSpacing = useCallback(
    (spacingOrFactor: number, layout?: 'horizontal' | 'vertical') => {
      if (!localBounds || !alignBounds || selectedAbsoluteLeds.length < 2) return;
      if (layout == null) {
        const centerX =
          selectedAbsoluteLeds.reduce((sum, led) => sum + led.x, 0) / selectedAbsoluteLeds.length;
        const centerY =
          selectedAbsoluteLeds.reduce((sum, led) => sum + led.y, 0) / selectedAbsoluteLeds.length;
        const factor = spacingOrFactor;
        const updates = new Map<string, { u: number; v: number; x: number; y: number }>();
        for (const led of selectedAbsoluteLeds) {
          const x = centerX + (led.x - centerX) * factor;
          const y = centerY + (led.y - centerY) * factor;
          updates.set(led.id, {
            u: (x - localBounds.x) / localBounds.width,
            v: (y - localBounds.y) / localBounds.height,
            x,
            y,
          });
        }
        setDraftLeds((prev) =>
          prev.map((led) => {
            const uv = updates.get(led.id);
            if (uv == null) return led;
            return { ...led, ...uv };
          })
        );
      } else if (layout === 'horizontal') {
        const sorted = [...selectedAbsoluteLeds].sort((a, b) => a.x - b.x);
        const totalWidth =
          sorted.reduce((sum, led) => sum + led.w, 0) + (sorted.length - 1) * spacingOrFactor;
        let x = alignBounds.centerX - totalWidth / 2;
        const y = alignBounds.centerY;
        const updates = new Map<string, { u: number; v: number; x: number; y: number }>();
        for (const led of sorted) {
          x += led.w / 2;
          updates.set(led.id, {
            u: clamp01((x - localBounds.x) / localBounds.width),
            v: clamp01((y - localBounds.y) / localBounds.height),
            x,
            y,
          });
          x += led.w / 2 + spacingOrFactor;
        }
        setDraftLeds((prev) =>
          prev.map((led) => {
            const uv = updates.get(led.id);
            if (uv == null) return led;
            return { ...led, ...uv };
          })
        );
      } else if (layout === 'vertical') {
        const sorted = [...selectedAbsoluteLeds].sort((a, b) => a.y - b.y);
        const totalHeight =
          sorted.reduce((sum, led) => sum + led.h, 0) + (sorted.length - 1) * spacingOrFactor;
        let y = alignBounds.centerY - totalHeight / 2;
        const x = alignBounds.centerX;
        const updates = new Map<string, { u: number; v: number; x: number; y: number }>();
        for (const led of sorted) {
          y += led.h / 2;
          updates.set(led.id, {
            u: clamp01((x - localBounds.x) / localBounds.width),
            v: clamp01((y - localBounds.y) / localBounds.height),
            x,
            y,
          });
          y += led.h / 2 + spacingOrFactor;
        }
        setDraftLeds((prev) =>
          prev.map((led) => {
            const uv = updates.get(led.id);
            if (uv == null) return led;
            return { ...led, ...uv };
          })
        );
      }
      setIsDirty(true);
    },
    [alignBounds, localBounds, selectedAbsoluteLeds]
  );

  /** Align horizontal = arrange in a horizontal line (same Y, spaced X). */
  const handleAlignCenterH = useCallback(() => {
    applyGroupSpacing(groupSpacing, 'horizontal');
  }, [applyGroupSpacing, groupSpacing]);

  /** Align vertical = arrange in a vertical line (same X, spaced Y). */
  const handleAlignMiddleV = useCallback(() => {
    applyGroupSpacing(groupSpacing, 'vertical');
  }, [applyGroupSpacing, groupSpacing]);

  const handleGroupScaleChange = useCallback((value: number) => {
    const clamped = Math.max(GROUP_SCALE_MIN, Math.min(GROUP_SCALE_MAX, Number(value)));
    if (!Number.isFinite(clamped)) return;
    setGroupScale(clamped);
    const ids = selectedLedIdsRef.current;
    // Only update local draftLeds — never touch the store during edit (fixes group disappearing)
    setDraftLeds((prev) => prev.map((led) => (ids.has(led.id) ? { ...led, scale: clamped } : led)));
    setIsDirty(true);
  }, []);

  const handleGroupSpacingInput = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return;
      const prev = groupSpacingRef.current || 1;
      const factor = value / prev;
      groupSpacingRef.current = value;
      setGroupSpacing(value);
      if (selectedAbsoluteLeds.length >= 2 && Math.abs(factor - 1) > 0.0001) {
        applyGroupSpacing(factor);
      }
    },
    [applyGroupSpacing, selectedAbsoluteLeds.length]
  );

  const handleGroupAngleChange = useCallback((value: number) => {
    const deg = Number(value);
    if (!Number.isFinite(deg)) return;
    const angle = ((deg % 360) + 360) % 360;
    setGroupAngle(angle);
    const ids = selectedLedIdsRef.current;
    setDraftLeds((prev) =>
      prev.map((led) => (ids.has(led.id) ? { ...led, rotation: angle } : led))
    );
    setIsDirty(true);
  }, []);

  const arrangeGrid = useCallback(
    (spacingOverride?: number) => {
      if (!localBounds || selectedAbsoluteLeds.length < 2) return;

      const count = selectedAbsoluteLeds.length;
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);

      const avgW =
        selectedAbsoluteLeds.reduce((sum, led) => sum + led.w, 0) / count || BASE_LED_WIDTH;
      const avgH =
        selectedAbsoluteLeds.reduce((sum, led) => sum + led.h, 0) / count || BASE_LED_HEIGHT;

      const spacing =
        spacingOverride != null
          ? spacingOverride
          : groupSpacing > 0
            ? groupSpacing
            : Math.min(avgW, avgH) * 0.5;

      const gridWidth = cols * avgW + (cols - 1) * spacing;
      const gridHeight = rows * avgH + (rows - 1) * spacing;

      const centerX = alignBounds ? alignBounds.centerX : localBounds.x + localBounds.width / 2;
      const centerY = alignBounds ? alignBounds.centerY : localBounds.y + localBounds.height / 2;

      const originX = centerX - gridWidth / 2 + avgW / 2;
      const originY = centerY - gridHeight / 2 + avgH / 2;

      const ordered = [...selectedAbsoluteLeds].sort((a, b) =>
        a.y === b.y ? a.x - b.x : a.y - b.y
      );

      const updates = new Map<string, { u: number; v: number; x: number; y: number }>();

      ordered.forEach((led, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = originX + col * (avgW + spacing);
        const y = originY + row * (avgH + spacing);

        updates.set(led.id, {
          u: clamp01((x - localBounds.x) / localBounds.width),
          v: clamp01((y - localBounds.y) / localBounds.height),
          x,
          y,
        });
      });

      setDraftLeds((prev) =>
        prev.map((led) => {
          const uv = updates.get(led.id);
          if (!uv) return led;
          return { ...led, ...uv };
        })
      );
      setIsDirty(true);
    },
    [alignBounds, groupSpacing, localBounds, selectedAbsoluteLeds]
  );

  const handleArrangeGrid = useCallback(() => {
    arrangeGrid();
  }, [arrangeGrid]);

  /**
   * Returns the effective LED scale matching the absoluteLeds computation.
   * Handles both the modern `scale` field and legacy `width`/`height` fields.
   */
  const getLedEffectiveScale = useCallback((led: ManualLED): number => {
    let s = led.scale ?? 1;
    const leg = led as ManualLED & { width?: number; height?: number };
    if (s === 1 && (leg.width != null || leg.height != null)) {
      s = ((leg.width ?? BASE_LED_WIDTH) / BASE_LED_WIDTH + (leg.height ?? BASE_LED_HEIGHT) / BASE_LED_HEIGHT) / 2;
    }
    return s;
  }, []);

  /**
   * Returns the capsule half-length used for containment testing.
   * We test at (halfWidth - cornerRadius) which is the *centre* of each rounded end-cap
   * rather than the outermost geometric tip. This avoids false positives when a module's
   * rounded tip barely grazes the character outline at a curve.
   */
  const getLedCapsuleHalfLength = useCallback(
    (led: ManualLED): number => {
      const s = getLedEffectiveScale(led);
      const halfW = (BASE_LED_WIDTH / 2) * s * charVisualScale; // = 6 * s * cVS
      const cornerR = (BASE_LED_HEIGHT / 2) * s * charVisualScale; // = 2.5 * s * cVS
      return Math.max(0, halfW - cornerR); // center of end-cap circle = 3.5 * s * cVS
    },
    [charVisualScale, getLedEffectiveScale]
  );

  const getOutOfBoundsLedIds = useCallback(
    (leds: ManualLED[]) => {
      const failedIds = new Set<string>();
      if (!localBounds) return failedIds;
      const pathEl = pathRef.current ?? geometryAdapterRef.current?.getPathElement() ?? null;
      if (!pathEl) return failedIds;

      for (const led of leds) {
        const { x, y } = resolveManualLedPoint(led, localBounds);
        const worldX = x + pathOffset.x;
        const worldY = y + pathOffset.y;
        const rotation = led.rotation ?? 0;
        if (!isCapsuleInside(pathEl, worldX, worldY, rotation, getLedCapsuleHalfLength(led))) {
          failedIds.add(led.id);
        }
      }
      return failedIds;
    },
    [getLedCapsuleHalfLength, localBounds, pathOffset.x, pathOffset.y]
  );

  const areAllModulesInsidePath = useCallback(
    (candidatePathData: string): { ok: boolean; failedCount: number } => {
      if (!localBounds || !candidatePathData || draftLeds.length === 0) {
        return { ok: true, failedCount: 0 };
      }
      const adapter = geometryAdapterRef.current;
      const pathEl = adapter?.getPathElement();
      if (!adapter || !pathEl) return { ok: true, failedCount: 0 };

      const originalPathData = pathEl.getAttribute('d') ?? '';
      let failedCount = 0;
      try {
        adapter.setPath(candidatePathData);
        for (const led of draftLeds) {
          const { x, y } = resolveManualLedPoint(led, localBounds);
          const worldX = x + pathOffset.x;
          const worldY = y + pathOffset.y;
          const rotation = led.rotation ?? 0;
          if (!isCapsuleInside(pathEl, worldX, worldY, rotation, getLedCapsuleHalfLength(led))) {
            failedCount += 1;
          }
        }
      } finally {
        adapter.setPath(originalPathData);
      }
      return { ok: failedCount === 0, failedCount };
    },
    [draftLeds, getLedCapsuleHalfLength, localBounds, pathOffset.x, pathOffset.y]
  );

  useEffect(() => {
    // Show invalid highlight only after an explicit save attempt.
    if (invalidLedIds.size > 0) {
      queueMicrotask(() => setInvalidLedIds(new Set()));
    }
  }, [draftLeds, invalidLedIds.size]);

  const handleUpdateShapePoint = useCallback(
    (pointId: string, point: { x: number; y: number }) => {
      setDraftShapeOverride((prev) => {
        const sourcePath = prev?.outerPath || renderedPath?.pathData || '';
        if (!sourcePath) return prev;
        const updated = moveEditableAnchorPointSafe(sourcePath, pointId, point);
        if (!updated.accepted) return prev;
        const nextBBox = pathBBoxFromPathData(updated.pathData) ?? baseBBox ?? prev?.bbox;
        if (!nextBBox) return prev;
        lastValidShapePathRef.current = updated.pathData;
        return createPathShapeOverride(updated.pathData, nextBBox, prev?.sourceType ?? 'custom_path');
      });
    },
    [baseBBox, renderedPath?.pathData]
  );

  /**
   * Called by ShapePaperCanvas after it has parsed the initial path data.
   * Paper.js normalises the SVG string (e.g. rounds coordinates, rewrites
   * commands), so we seed the validator baseline with that normalised form to
   * prevent the first real drag from being compared against a structurally
   * different string.
   */
  const handleShapeEditorReady = useCallback((normalizedPathData: string) => {
    if (!normalizedPathData) return;
    lastValidShapePathRef.current = normalizedPathData;
    // Also sync the draft so the rest of the app sees the normalised form.
    const nextBBox = pathBBoxFromPathData(normalizedPathData) ?? baseBBox;
    if (nextBBox) {
      setDraftShapeOverride((prev) =>
        createPathShapeOverride(normalizedPathData, nextBBox, prev?.sourceType ?? 'custom_path')
      );
    }
  }, [baseBBox]);

  const handleShapePathChange = useCallback(
    (newPathData: string): { accepted: boolean } => {
      const nextBBox = pathBBoxFromPathData(newPathData) ?? baseBBox ?? draftShapeOverride?.bbox;
      if (!nextBBox) return { accepted: true };
      lastValidShapePathRef.current = newPathData;
      setDraftShapeOverride((prev) =>
        createPathShapeOverride(newPathData, nextBBox, prev?.sourceType ?? 'custom_path')
      );
      return { accepted: true };
    },
    [baseBBox, draftShapeOverride?.bbox]
  );

  const handleResetShape = useCallback(() => {
    if (!baseCharPath || !baseBBox) return;
    lastValidShapePathRef.current = baseCharPath.pathData;
    const resetOrigins = new Map<string, { x: number; y: number }>();
    buildEditableAnchorPoints(baseCharPath.pathData).forEach((point) => {
      resetOrigins.set(point.id, { x: point.x, y: point.y });
    });
    shapeAnchorOriginRef.current = resetOrigins;
    shapeAnchorOriginCharIdRef.current = editorCharId;
    setDraftShapeOverride(createPathShapeOverride(baseCharPath.pathData, baseBBox, 'font_glyph'));
    setSelectedShapePointId(null);
  }, [baseBBox, baseCharPath, editorCharId]);

  const handleSaveShape = useCallback(async () => {
    if (!editorCharId || !baseCharPath || !baseBBox || !draftShapeOverride) return;
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      notify({
        variant: 'error',
        title: 'Failed to persist shape',
        description: 'You must be logged in.',
      });
      return;
    }

    const persistedShape = normalizeShapeOverride(
      getCharShapeOverride(editorCharId) ?? undefined,
      baseBBox,
      baseCharPath.pathData
    );
    const oldWarped = resolveShapePath(baseCharPath.pathData, persistedShape, baseBBox);
    const nextShape = normalizeShapeOverride(draftShapeOverride, baseBBox, oldWarped.pathData);
    const nextWarped = resolveShapePath(baseCharPath.pathData, nextShape, baseBBox);
    const shapeInsideVerdict = areAllModulesInsidePath(nextWarped.pathData);
    if (!shapeInsideVerdict.ok) {
      notify({
        variant: 'error',
        title: 'Cannot save shape',
        description: `${shapeInsideVerdict.failedCount} module(s) would be outside the shape. Adjust the outline first.`,
      });
      return;
    }
    const oldBBox = oldWarped.bbox;
    const newBBox = nextWarped.bbox;
    const safeW = Math.max(1e-6, newBBox.width);
    const safeH = Math.max(1e-6, newBBox.height);

    const remapped = draftLeds.map((led) => {
      const absX = oldBBox.x + led.u * oldBBox.width;
      const absY = oldBBox.y + led.v * oldBBox.height;
      return {
        ...led,
        u: (absX - newBBox.x) / safeW,
        v: (absY - newBBox.y) / safeH,
        x: absX,
        y: absY,
      };
    });

    setDraftLeds(remapped);
    setCharManualLeds(editorCharId, remapped);
    setCharShapeOverride(editorCharId, nextShape);
    setIsDirty(true);
    onSwitchMode('module');
    setSelectedShapePointId(null);
    lastValidShapePathRef.current = nextWarped.pathData;

    try {
      await commitCharacterShapeOverride(accessToken, projectId, editorCharId, nextShape, remapped);
    } catch (err) {
      const saveErr =
        typeof err === 'object' && err && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to persist shape and modules';
      notify({
        variant: 'error',
        title: 'Failed to persist shape',
        description: saveErr,
      });
      return;
    }

    setIsDirty(false);
    notify({
      variant: 'success',
      title: 'Shape saved',
      description: 'Character geometry updated and synced.',
    });
  }, [
    baseBBox,
    baseCharPath,
    draftLeds,
    draftShapeOverride,
    editorCharId,
    getCharShapeOverride,
    notify,
    areAllModulesInsidePath,
    onSwitchMode,
    projectId,
    setCharManualLeds,
    setCharShapeOverride,
  ]);

  const handleSave = useCallback(async () => {
    if (!editorCharId) return;
    const existingProject = projects.find((p) => p._id === projectId);
    const projectName = existingProject?.name?.trim() || 'Untitled project';
    const projectDescription = existingProject?.description;

    if (!localBounds) {
      setCharManualLeds(editorCharId, draftLeds);
      await saveCurrentProject(projectName, projectDescription);
      const persistenceError = useProjectsStore.getState().errorMessage;
      if (persistenceError) {
        notify({
          variant: 'error',
          title: 'Failed to persist manual layout',
          description: persistenceError,
        });
        return;
      }
      notify({ variant: 'success', title: 'Manual layout saved' });
      onBack();
      return;
    }
    const failedIds = getOutOfBoundsLedIds(draftLeds);

    if (failedIds.size > 0) {
      setInvalidLedIds(failedIds);
      notify({
        variant: 'error',
        title: 'Cannot save manual layout',
        description: `${failedIds.size} module(s) are outside the character. Move highlighted modules inside the outline before saving.`,
      });
      return;
    }
    const confirmed = await confirm({
      title: 'Save manual placement?',
      description: 'This character manual layout will be saved to the project.',
      confirmText: 'Save changes',
      cancelText: 'Continue editing',
    });
    if (!confirmed) return;
    setCharManualLeds(editorCharId, draftLeds);
    await saveCurrentProject(projectName, projectDescription);
    const persistenceError = useProjectsStore.getState().errorMessage;
    if (persistenceError) {
      notify({
        variant: 'error',
        title: 'Failed to persist manual layout',
        description: persistenceError,
      });
      return;
    }
    notify({ variant: 'success', title: 'Manual layout saved' });
    onBack();
  }, [
    confirm,
    draftLeds,
    editorCharId,
    localBounds,
    shapeEditBounds,
    notify,
    onBack,
    projectId,
    projects,
    saveCurrentProject,
    setCharManualLeds,
    getOutOfBoundsLedIds,
  ]);

  const handleCancel = useCallback(() => {
    onBack();
  }, [onBack]);

  const totalWatts = draftLeds.length * currentModule.wattsPerModule;

  return (
    <div className="relative isolate bg-[var(--surface-app)] p-0 text-[var(--text-1)] h-screen flex flex-col overflow-hidden">
      <div className="relative z-10 flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="h-16 shrink-0 border-b border-[var(--border-1)] bg-[var(--surface-canvas)] flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] flex items-center justify-center text-xl font-bold">
                {baseCharPath?.char || '·'}
              </div>
              <div>
                <div className="text-sm text-[var(--text-3)]">Manual Designer</div>
                <div className="text-lg font-semibold">
                  {baseCharPath?.char || 'Character'} · {editorCharId}
                </div>
                <div className="text-xs text-[var(--text-3)]">Project {projectId}</div>
              </div>
              {isDirty && <span className="text-xs text-[var(--warning-300)]">Unsaved changes</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="mr-2 inline-flex rounded-lg border border-[var(--border-1)] bg-[var(--surface-elevated)] p-1">
                <button
                  type="button"
                  onClick={() => onSwitchMode('module')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    editorMode === 'module'
                      ? 'bg-[var(--text-1)] text-[var(--surface-app)]'
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                >
                  Module Mode
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchMode('shape')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    editorMode === 'shape'
                      ? 'bg-[var(--text-1)] text-[var(--surface-app)]'
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                >
                  Shape Mode
                </button>
              </div>
              {editorMode === 'shape' ? (
                <>
                  <button
                    type="button"
                    onClick={handleResetShape}
                    className="px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-panel)] text-[var(--text-2)] text-sm"
                  >
                    Reset shape
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShapeModulePreview((prev) => !prev)}
                    aria-label={showShapeModulePreview ? 'Hide module preview' : 'Show module preview'}
                    title={showShapeModulePreview ? 'Hide module preview' : 'Show module preview'}
                    className="p-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-panel)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
                  >
                    {showShapeModulePreview ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.17-5.94" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.11 4.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveShape();
                    }}
                    className="px-3 py-2 rounded-lg bg-[var(--accent-500)] text-white text-sm font-semibold hover:bg-[var(--accent-600)]"
                  >
                    Save Shape
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-panel)] text-[var(--text-2)]"
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      void handleSave();
                    }}
                    disabled={projectsSaving}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-500)] text-white font-semibold hover:bg-[var(--accent-600)]"
                  >
                    {projectsSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--surface-panel)] text-[var(--text-2)]"
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid flex-1 min-h-0 grid-cols-[1fr_320px]">
            <div
              ref={canvasContainerRef}
              className={`relative flex min-h-0 min-w-0 ${
                tool === 'pan' && isPanning
                  ? 'cursor-grabbing'
                  : tool === 'pan'
                    ? 'cursor-grab'
                    : tool === 'add'
                      ? 'cursor-crosshair'
                      : tool === 'boxSelect'
                        ? 'cursor-crosshair'
                        : ''
              }`}
            >
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--text-3)]">
                  Loading font engine...
                </div>
              )}
              {!loading && localBounds && viewBox && (
                USE_KONVA_MANUAL_EDITOR ? (
                  editorMode === 'shape' ? (
                    <div ref={canvasViewportRef} className="w-full h-full">
                      <ShapePaperCanvas
                        pathData={renderedPath?.pathData ?? ''}
                        bounds={shapeEditBounds}
                        selectedPointId={selectedShapePointId}
                        onSelectPoint={setSelectedShapePointId}
                        onPathChange={handleShapePathChange}
                        showModulePreview={showShapeModulePreview}
                        modulePreviewLeds={shapePreviewLeds}
                        fitPaddingFactor={MANUAL_EDITOR_FIT_PADDING}
                        onEditorReady={handleShapeEditorReady}
                      />
                    </div>
                  ) : (
                  <div ref={canvasViewportRef} className="w-full h-full">
                    <ManualKonvaCanvas
                      editorMode={editorMode}
                      tool={tool}
                      setTool={setTool}
                      isPanning={isPanning}
                      setIsPanning={setIsPanning}
                      viewBox={viewBox}
                      setViewBox={setViewBox}
                      clampViewBoxToBase={clampViewBoxToBase}
                      localBounds={localBounds}
                      pathData={renderedPath?.pathData || ''}
                      pathOffset={pathOffset}
                      draftLeds={draftLeds}
                      setDraftLeds={setDraftLeds}
                      selectedLedIds={selectedLedIds}
                      setSelectedLedIds={setSelectedLedIds}
                      invalidLedIds={invalidLedIds}
                      charVisualScale={charVisualScale}
                      snapEnabled={snapEnabled}
                      gridSize={gridSize}
                      setIsDirty={setIsDirty}
                      onViewportInteractionStart={() => {
                        userViewportInteractionRef.current = true;
                      }}
                      shapePoints={[]}
                      selectedShapePointId={selectedShapePointId}
                      onSelectShapePoint={setSelectedShapePointId}
                      onUpdateShapePoint={handleUpdateShapePoint}
                      showShapeDebug={false}
                      anchorDebugCountById={{}}
                    />
                  </div>
                  )
                ) : (
                  <svg
                    ref={svgRef}
                    className="w-full h-full"
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ touchAction: 'none' }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                  >
                  <path
                    ref={pathRef}
                    d={renderedPath?.pathData || ''}
                    transform={pathTransform}
                    fill="rgba(148,163,184,0.08)"
                    stroke="rgba(148,163,184,0.5)"
                    strokeWidth={2}
                  />
                  {marqueeRect && (
                    <rect
                      x={Math.min(marqueeRect.startX, marqueeRect.endX)}
                      y={Math.min(marqueeRect.startY, marqueeRect.endY)}
                      width={Math.abs(marqueeRect.endX - marqueeRect.startX)}
                      height={Math.abs(marqueeRect.endY - marqueeRect.startY)}
                      fill="rgba(56, 189, 248, 0.12)"
                      stroke="rgba(56, 189, 248, 0.7)"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {absoluteLedsRenderOrder.map((led) => {
                    const selected = selectedLedIds.has(led.id);
                    const showPerLedHandles = selected && selectedLedIds.size === 1;
                    const w = led.w;
                    const h = led.h;
                    const halfW = w / 2;
                    const halfH = h / 2;
                    const stackCount = stackCountByLedId.get(led.id) ?? 1;
                    const inStack = stackCount > 1;
                    const showStackIndicator = inStack && topmostLedIdPerStack.has(led.id);
                    const isInvalid = invalidLedIds.has(led.id);
                    const strokeColor = isInvalid ? '#dc2626' : '#38bdf8';
                    const circleFill = isInvalid ? '#dc2626' : '#38bdf8';
                    return (
                      <g
                        key={led.id}
                        data-led
                        transform={`rotate(${led.rotation} ${led.x} ${led.y})`}
                        style={{ cursor: 'move' }}
                        onPointerDown={(event) => handleLedPointerDown(event, led.id, led.x, led.y)}
                        onPointerMove={handleLedPointerMove}
                        onPointerUp={handleLedPointerUp}
                      >
                        {/* Hit area matches module bounds so nearby modules don't steal the click */}
                        <rect
                          x={led.x - halfW}
                          y={led.y - halfH}
                          width={w}
                          height={h}
                          rx={halfH}
                          ry={halfH}
                          fill="transparent"
                          style={{ pointerEvents: 'all' }}
                        />
                        {selected &&
                          (() => {
                            const pad = Math.min(0.8, Math.max(0.15, h * 0.15));
                            const strokeW = Math.min(0.9, Math.max(0.25, h * 0.18));
                            return (
                              <rect
                                x={led.x - halfW - pad}
                                y={led.y - halfH - pad}
                                width={w + pad * 2}
                                height={h + pad * 2}
                                rx={halfH + pad}
                                ry={halfH + pad}
                                fill="none"
                                stroke="#60a5fa"
                                strokeWidth={strokeW}
                              />
                            );
                          })()}
                        {/* Resize handles — always present so you can resize without selecting first */}
                        {showPerLedHandles &&
                          (['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                            const hx =
                              handle === 'nw' || handle === 'sw'
                                ? led.x - halfW - 2
                                : led.x + halfW - 2;
                            const hy =
                              handle === 'nw' || handle === 'ne'
                                ? led.y - halfH - 2
                                : led.y + halfH - 2;
                            return (
                              <rect
                                key={handle}
                                data-resize-handle
                                x={hx}
                                y={hy}
                                width={4}
                                height={4}
                                fill="transparent"
                                style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  selectOnly(led.id);
                                  handleResizePointerDown(
                                    e as unknown as React.PointerEvent<SVGElement>,
                                    led.id,
                                    handle
                                  );
                                }}
                              />
                            );
                          })}
                        {showPerLedHandles &&
                          (() => {
                            const iconScale = Math.max(2, Math.min(3.5, w * 0.2));
                            const iconY = led.y - halfH - iconScale - 3;
                            const s = (iconScale * 2) / ROTATE_ARROW_VIEWBOX_SIZE;
                            return (
                              <g
                                data-rotation-handle
                                transform={`translate(${led.x}, ${iconY}) scale(${s}) translate(${-ROTATE_ARROW_VIEWBOX_CENTER}, ${-ROTATE_ARROW_VIEWBOX_CENTER})`}
                                style={{ cursor: 'grab', pointerEvents: 'all' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  selectOnly(led.id);
                                  handleRotationHandlePointerDown(
                                    e as unknown as React.PointerEvent<SVGElement>,
                                    led.id,
                                    led.x,
                                    led.y
                                  );
                                }}
                              >
                                <circle
                                  cx={ROTATE_ARROW_VIEWBOX_CENTER}
                                  cy={ROTATE_ARROW_VIEWBOX_CENTER}
                                  r={ROTATE_ARROW_VIEWBOX_CENTER}
                                  fill="transparent"
                                />
                                <path
                                  d={ROTATE_ARROW_PATH}
                                  fill="#60a5fa"
                                  stroke="#e2e8f0"
                                  strokeWidth={8}
                                  strokeLinejoin="round"
                                />
                              </g>
                            );
                          })()}
                        <rect
                          x={led.x - halfW}
                          y={led.y - halfH}
                          width={w}
                          height={h}
                          rx={halfH}
                          ry={halfH}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isInvalid ? 1.2 : 0.9}
                        />
                        {(() => {
                          const r = Math.min(1.0, h * 0.18);
                          return (
                            <>
                              <circle cx={led.x - w * 0.29} cy={led.y} r={r} fill={circleFill} />
                              <circle cx={led.x + w * 0.29} cy={led.y} r={r} fill={circleFill} />
                            </>
                          );
                        })()}
                        {showStackIndicator && (
                          <g transform={`translate(${led.x + halfW + 3}, ${led.y - halfH - 2})`}>
                            <title>{stackCount} modules stacked here</title>
                            <rect
                              x={-4}
                              y={-3.5}
                              width={8}
                              height={7}
                              rx={2}
                              fill="#475569"
                              stroke="#64748b"
                              strokeWidth={0.6}
                            />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#e2e8f0"
                              fontSize={4.5}
                              fontWeight="600"
                            >
                              {stackCount}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                  {/* Group rotation handle when 2+ selected */}
                  {selectedLedIds.size >= 2 &&
                    groupCenter &&
                    (() => {
                      const iconScale = 3;
                      const iconY = groupCenter.y - iconScale - 4;
                      const s = (iconScale * 2) / ROTATE_ARROW_VIEWBOX_SIZE;
                      return (
                        <g
                          data-rotation-handle
                          transform={`translate(${groupCenter.x}, ${iconY}) scale(${s}) translate(${-ROTATE_ARROW_VIEWBOX_CENTER}, ${-ROTATE_ARROW_VIEWBOX_CENTER})`}
                          style={{ cursor: 'grab', pointerEvents: 'all' }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            handleGroupRotationHandlePointerDown(
                              e as unknown as React.PointerEvent<SVGElement>
                            );
                          }}
                        >
                          <circle
                            cx={ROTATE_ARROW_VIEWBOX_CENTER}
                            cy={ROTATE_ARROW_VIEWBOX_CENTER}
                            r={ROTATE_ARROW_VIEWBOX_CENTER}
                            fill="transparent"
                          />
                          <path
                            d={ROTATE_ARROW_PATH}
                            fill="#60a5fa"
                            stroke="#e2e8f0"
                            strokeWidth={8}
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })()}

                  {/* Group extend plus buttons temporarily disabled */}
                  {/* Selected LED handles on top so they work when overlapping another module (single only) */}
                  {primarySelectedId &&
                    (() => {
                      const led = absoluteLeds.find((l) => l.id === primarySelectedId);
                      if (!led) return null;
                      const w = led.w;
                      const h = led.h;
                      const halfW = w / 2;
                      const halfH = h / 2;
                      return (
                        <g
                          key="selected-handles-overlay"
                          transform={`rotate(${led.rotation} ${led.x} ${led.y})`}
                        >
                          {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                            const hx =
                              handle === 'nw' || handle === 'sw'
                                ? led.x - halfW - 2
                                : led.x + halfW - 2;
                            const hy =
                              handle === 'nw' || handle === 'ne'
                                ? led.y - halfH - 2
                                : led.y + halfH - 2;
                            return (
                              <rect
                                key={handle}
                                data-resize-handle
                                x={hx}
                                y={hy}
                                width={4}
                                height={4}
                                fill="transparent"
                                style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  handleResizePointerDown(
                                    e as unknown as React.PointerEvent<SVGElement>,
                                    led.id,
                                    handle
                                  );
                                }}
                              />
                            );
                          })}
                          {(() => {
                            const iconScale = Math.max(2, Math.min(3.5, w * 0.2));
                            const iconY = led.y - halfH - iconScale - 3;
                            const s = (iconScale * 2) / ROTATE_ARROW_VIEWBOX_SIZE;
                            return (
                              <g
                                data-rotation-handle
                                transform={`translate(${led.x}, ${iconY}) scale(${s}) translate(${-ROTATE_ARROW_VIEWBOX_CENTER}, ${-ROTATE_ARROW_VIEWBOX_CENTER})`}
                                style={{ cursor: 'grab', pointerEvents: 'all' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  handleRotationHandlePointerDown(
                                    e as unknown as React.PointerEvent<SVGElement>,
                                    led.id,
                                    led.x,
                                    led.y
                                  );
                                }}
                              >
                                <circle
                                  cx={ROTATE_ARROW_VIEWBOX_CENTER}
                                  cy={ROTATE_ARROW_VIEWBOX_CENTER}
                                  r={ROTATE_ARROW_VIEWBOX_CENTER}
                                  fill="transparent"
                                />
                                <path
                                  d={ROTATE_ARROW_PATH}
                                  fill="#60a5fa"
                                  stroke="#e2e8f0"
                                  strokeWidth={8}
                                  strokeLinejoin="round"
                                />
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })()}
                  </svg>
                )
              )}
            </div>

            <div className="min-h-0 bg-[var(--surface-panel)] border-l border-[var(--border-1)] overflow-y-auto">
              <div className="p-5 space-y-5">
              {editorMode === 'module' ? (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">Module Specs</div>
                  <div className="bg-[var(--surface-elevated)] rounded-xl p-4 text-sm space-y-1 border border-[var(--border-1)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Module</span>
                      <span className="text-[var(--text-1)] font-semibold">{currentModule.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Voltage</span>
                      <span className="text-[var(--text-1)]">{currentModule.voltage}V</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Watts</span>
                      <span className="text-[var(--text-1)]">{currentModule.wattsPerModule} W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Total</span>
                      <span className="text-[var(--text-1)]">{totalWatts.toFixed(1)} W</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">Shape Properties</div>
                  <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-elevated)] p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Mode</span>
                      <span className="text-[var(--text-1)]">Path anchors</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-3)]">Nodes</span>
                      <span className="text-[var(--text-1)]">{editableShapePoints.length}</span>
                    </div>
                    {selectedShapePointId != null && editableShapePoints.find((p) => p.id === selectedShapePointId) && (
                      <div className="pt-2 border-t border-[var(--border-1)]">
                        <div className="text-[var(--text-3)] text-xs mb-1">Selected node</div>
                        {(() => {
                          const selectedPoint = editableShapePoints.find((p) => p.id === selectedShapePointId)!;
                          return (
                            <>
                              <div className="flex justify-between text-[var(--text-2)]">
                                <span>Contour</span>
                                <span>{selectedPoint.contourIndex}</span>
                              </div>
                              <div className="flex justify-between text-[var(--text-2)]">
                                <span>Type</span>
                                <span className="uppercase">{selectedPoint.kind}</span>
                              </div>
                              <div className="flex justify-between text-[var(--text-2)]">
                                <span>X</span>
                                <span>{selectedPoint.x.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-[var(--text-2)]">
                                <span>Y</span>
                                <span>{selectedPoint.y.toFixed(1)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Autofill Panel ── */}
              {editorMode === 'module' && (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">Autofill</div>
                  <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-elevated)] p-4 space-y-4 text-sm">

                    {/* Orientation */}
                    <div className="space-y-1.5">
                      <span className="text-[var(--text-2)]">Orientation</span>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {(['horizontal', 'vertical'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAutofillOrientation(opt)}
                            className={`py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                              autofillOrientation === opt
                                ? 'bg-[var(--accent-500)] text-white'
                                : 'bg-[var(--surface-strong)] text-[var(--text-2)] hover:text-[var(--text-1)]'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Module Scale */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Module size</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">{autofillModuleScale.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={MIN_LED_SCALE}
                        max={2.0}
                        step={0.05}
                        value={autofillModuleScale}
                        onChange={(e) => setAutofillModuleScale(parseFloat(e.currentTarget.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>

                    {/* Spacing */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Spacing</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">{autofillSpacing.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={0.5}
                        value={autofillSpacing}
                        onChange={(e) => setAutofillSpacing(parseFloat(e.currentTarget.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>

                    {/* Edge inset */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Edge inset</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">{autofillInset.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.5}
                        value={autofillInset}
                        onChange={(e) => setAutofillInset(parseFloat(e.currentTarget.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>

                    {/* Estimated count preview */}
                    {autofillEstimatedCount != null && (
                      <div className="flex justify-between items-center text-xs text-[var(--text-3)] border-t border-[var(--border-1)] pt-3">
                        <span>Estimated modules</span>
                        <span className="font-mono text-[var(--text-2)]">~{autofillEstimatedCount}</span>
                      </div>
                    )}

                    {/* Autofill button */}
                    <button
                      type="button"
                      disabled={autofillRunning}
                      onClick={handleAutofill}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--accent-500)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
                    >
                      {autofillRunning ? 'Filling…' : 'Autofill'}
                    </button>
                  </div>
                </div>
              )}

              {editorMode === 'module' && selectedLedIds.size >= 2 && (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">Group</div>
                  <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-elevated)] p-4 space-y-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Group spacing</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">
                          {groupSpacing.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={GROUP_SPACING_MIN}
                        max={GROUP_SPACING_MAX}
                        step={0.1}
                        value={groupSpacing}
                        onChange={(e) => handleGroupSpacingInput(parseFloat(e.currentTarget.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Group size</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">
                          {groupScale.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={GROUP_SCALE_MIN}
                        max={GROUP_SCALE_MAX}
                        step={0.05}
                        value={groupScale}
                        onChange={(e) => {
                          const v = parseFloat(e.currentTarget.value);
                          handleGroupScaleChange(Number.isFinite(v) ? v : 1);
                        }}
                        onInput={(e) => {
                          const v = parseFloat((e.target as HTMLInputElement).value);
                          if (Number.isFinite(v)) handleGroupScaleChange(v);
                        }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-2)]">Group angle</span>
                        <span className="text-[var(--text-1)] font-mono text-xs">
                          {Math.round(groupAngle)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={GROUP_ANGLE_MIN}
                        max={GROUP_ANGLE_MAX}
                        step={1}
                        value={groupAngle}
                        onChange={(e) => handleGroupAngleChange(parseFloat(e.currentTarget.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-strong)] accent-[var(--accent-500)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editorMode === 'module' && <div className="space-y-2">
                <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">
                  Design Controls
                </div>
                <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-elevated)] p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>LED Count</span>
                    <span className="text-[var(--text-1)] font-semibold">{draftLeds.length}</span>
                  </div>
                  {invalidLedIds.size > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--danger-400)]">
                        Out of bounds: {invalidLedIds.size}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLedIds(new Set(invalidLedIds));
                          setTool('select');
                        }}
                        className="rounded-md border border-[var(--border-1)] bg-[var(--surface-strong)] px-2 py-1 text-[var(--text-2)] hover:text-[var(--text-1)]"
                      >
                        Select invalid
                      </button>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      const shouldClear = await confirm({
                        title: 'Clear all modules?',
                        description: 'This removes all manual modules for this character.',
                        confirmText: 'Clear all',
                        variant: 'danger',
                      });
                      if (shouldClear) {
                        handleClearAll();
                        notify({ variant: 'info', title: 'Modules cleared' });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--danger-500)] hover:brightness-95 text-white text-xs font-medium"
                  >
                    Clear all modules
                  </button>
                </div>
              </div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tetra-like left tool rail */}
      {editorMode === 'module' && <div
        className="absolute left-4 top-[5.5rem] z-20 flex flex-col items-center gap-1 rounded-2xl border border-[var(--border-1)] bg-[var(--surface-elevated)] px-2 py-2 shadow-[var(--shadow-md)]"
        role="toolbar"
      >
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            title="Select mode — select and drag modules"
            onClick={() => setTool('select')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'select' ? 'bg-[var(--text-1)] text-[var(--surface-app)]' : 'text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3l11 11-5 1 1 5-2 1-2-5-5 1z" />
            </svg>
          </button>
          <button
            type="button"
            title="Explore mode — pan around the canvas"
            onClick={() => setTool('pan')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'pan' ? 'bg-[var(--text-1)] text-[var(--surface-app)]' : 'text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 11v-1a2 2 0 1 1 4 0v1" />
              <path d="M10 10V7a2 2 0 1 1 4 0v5" />
              <path d="M14 12v-2a2 2 0 1 1 4 0v4" />
              <path d="M6 12v6a3 3 0 0 0 3 3h5.2a3 3 0 0 0 2.7-1.7L20 13" />
            </svg>
          </button>
          <button
            type="button"
            title="Box select — drag on canvas to select all modules in the box"
            onClick={() => setTool('boxSelect')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'boxSelect' ? 'bg-[var(--text-1)] text-[var(--surface-app)]' : 'text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            title="Add mode — click on canvas to place a module"
            onClick={() => setTool('add')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'add' ? 'bg-[var(--text-1)] text-[var(--surface-app)]' : 'text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
        </div>
        <div className="h-px w-8 bg-[var(--border-1)] my-1" aria-hidden />
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            title="Add LED at center"
            onClick={handleAddAtCenter}
            className="p-2.5 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            title="Reset view"
            onClick={handleFit}
            className="p-2.5 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
        {/* Selection-only: Delete and Duplicate — shown when at least one module is selected */}
        {selectedLedIds.size >= 1 && (
          <>
            <div className="h-px w-8 bg-[var(--border-1)] my-1" aria-hidden />
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Delete selected module"
                onClick={handleDeleteSelected}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-[var(--text-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-500)] transition-colors min-w-[3rem]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <span className="text-[10px] uppercase tracking-wide">Delete</span>
              </button>
              <button
                type="button"
                title="Duplicate selected module"
                onClick={handleDuplicateSelected}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors min-w-[3rem]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span className="text-[10px] uppercase tracking-wide">Duplicate</span>
              </button>
            </div>
            {selectedLedIds.size >= 2 && (
              <>
                <div className="h-px w-8 bg-[var(--border-1)] my-1" aria-hidden />
                <div className="flex items-center gap-0.5" role="group" aria-label="Align and grid">
                  <button
                    type="button"
                    title="Align horizontal"
                    onClick={handleAlignCenterH}
                    className="p-2 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                      <line x1="6" y1="18" x2="18" y2="18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Align vertical"
                    onClick={handleAlignMiddleV}
                    className="p-2 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="6" y1="4" x2="6" y2="20" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="18" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Arrange selected modules into a grid"
                    onClick={handleArrangeGrid}
                    className="p-2 rounded-xl text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)] transition-colors"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="4" height="4" />
                      <rect x="3" y="14" width="4" height="4" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>}
    </div>
  );
};
