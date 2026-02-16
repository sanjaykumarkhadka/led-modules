import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../../data/store';
import { useFonts } from '../../hooks/useFont';
import {
  generateCharacterPaths,
  generateFallbackCharacterPaths,
  type CharacterPath,
} from '../../core/math/characterPaths';
import type { ManualLED } from '../../data/store';
import { isCapsuleInside, isPointInside } from '../../core/math/geometry';

// Path from assets/rotating-arrow-to-the-left-svgrepo-com.svg (viewBox 0 0 305.836 305.836)
const ROTATE_ARROW_PATH =
  'M152.924,300.748c84.319,0,152.912-68.6,152.912-152.918c0-39.476-15.312-77.231-42.346-105.564 c0,0,3.938-8.857,8.814-19.783c4.864-10.926-2.138-18.636-15.648-17.228l-79.125,8.289c-13.511,1.411-17.999,11.467-10.021,22.461 l46.741,64.393c7.986,10.992,17.834,12.31,22.008,2.937l7.56-16.964c12.172,18.012,18.976,39.329,18.976,61.459 c0,60.594-49.288,109.875-109.87,109.875c-60.591,0-109.882-49.287-109.882-109.875c0-19.086,4.96-37.878,14.357-54.337 c5.891-10.325,2.3-23.467-8.025-29.357c-10.328-5.896-23.464-2.3-29.36,8.031C6.923,95.107,0,121.27,0,147.829 C0,232.148,68.602,300.748,152.924,300.748z';
const ROTATE_ARROW_VIEWBOX_CENTER = 152.918;
const ROTATE_ARROW_VIEWBOX_SIZE = 305.836;

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

const expandBox = (bbox: { x: number; y: number; width: number; height: number }, pad = 0.08) => {
  const paddingX = bbox.width * pad;
  const paddingY = bbox.height * pad;
  return {
    x: bbox.x - paddingX,
    y: bbox.y - paddingY,
    width: bbox.width + paddingX * 2,
    height: bbox.height + paddingY * 2,
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

export const ManualDesignerPage: React.FC = () => {
  const blocks = useProjectStore((state) => state.blocks);
  const editorCharId = useProjectStore((state) => state.editorCharId);
  const closeEditor = useProjectStore((state) => state.closeEditor);
  const setCharPlacementMode = useProjectStore((state) => state.setCharPlacementMode);
  const getCharManualLeds = useProjectStore((state) => state.getCharManualLeds);
  const setCharManualLeds = useProjectStore((state) => state.setCharManualLeds);
  const currentModule = useProjectStore((state) => state.getCurrentModule());

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
  const [isDirty, setIsDirty] = useState(false);
  const [invalidLedIds, setInvalidLedIds] = useState<Set<string>>(new Set());
  const [groupSpacing, setGroupSpacing] = useState(1);
  const [groupScale, setGroupScale] = useState(1);
  const [groupAngle, setGroupAngle] = useState(0);
  const [groupLayoutMode, setGroupLayoutMode] = useState<'line' | 'grid' | null>(null);
  const selectedLedIdsRef = useRef<Set<string>>(new Set());
  selectedLedIdsRef.current = selectedLedIds;

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
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

  const neededLanguages = useMemo(() => [...new Set(blocks.map((b) => b.language))], [blocks]);
  const { fonts, loading } = useFonts(neededLanguages);

  const blockCharPaths = useMemo(() => {
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
  }, [blocks, fonts]);

  const charPath = useMemo(() => {
    if (!editorCharId) return null;
    const [blockId, charIndexStr] = editorCharId.split('-');
    const charIndex = parseInt(charIndexStr, 10);
    const block = blockCharPaths.find((bp) => bp.blockId === blockId);
    if (!block) return null;
    return block.charPaths.find((cp) => cp.charIndex === charIndex) || null;
  }, [blockCharPaths, editorCharId]);

  const bbox = charPath?.bbox || null;
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
  }, [editorCharId, getCharManualLeds]);

  useLayoutEffect(() => {
    if (!pathRef.current) return;
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
  }, [charPath?.pathData, editorCharId]);

  useEffect(() => {
    const source = pathBounds || bbox;
    if (!source) return;
    const local = { x: 0, y: 0, width: source.width, height: source.height };
    const base = expandBox(local);
    queueMicrotask(() => {
      setBaseViewBox(base);
      setViewBox(base);
    });
  }, [bbox, pathBounds]);

  const clampViewBoxToBase = useCallback(
    (next: ViewBox) => {
      if (!baseViewBox) return next;
      const clampedWidth = Math.min(next.width, baseViewBox.width);
      const clampedHeight = Math.min(next.height, baseViewBox.height);
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
  }, [viewBox, clampViewBoxToBase]);

  const localBounds = useMemo(() => {
    const source = pathBounds || bbox;
    if (!source) return null;
    return {
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
    };
  }, [bbox, pathBounds]);

  const pathTransform = useMemo(() => {
    const source = pathBounds || bbox;
    if (!source) return undefined;
    return `translate(${-source.x} ${-source.y})`;
  }, [bbox, pathBounds]);

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
      const w = BASE_LED_WIDTH * scale;
      const h = BASE_LED_HEIGHT * scale;
      return {
        ...led,
        x: localBounds.x + led.u * localBounds.width,
        y: localBounds.y + led.v * localBounds.height,
        w,
        h,
        scale,
      };
    });
  }, [draftLeds, localBounds]);

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
    (point: { x: number; y: number }, rotation = 0, forceInsideBounds = false, scale?: number) => {
      if (!localBounds) return;
      if (!pathRef.current && !forceInsideBounds) return;
      const snapped = snapPoint(point);
      if (
        !forceInsideBounds &&
        pathRef.current &&
        !isCapsuleInside(pathRef.current, snapped.x, snapped.y, rotation, 6)
      ) {
        return;
      }
      const normalized = toManual(snapped);
      const newLed: ManualLED = {
        id: createLedId(),
        u: normalized.u,
        v: normalized.v,
        rotation,
        ...(scale != null && scale !== 1 && { scale }),
      };
      setDraftLeds((prev) => [...prev, newLed]);
      setSelectedLedIds(new Set([newLed.id]));
      setIsDirty(true);
    },
    [localBounds, snapPoint, toManual]
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
      const minScale = 0.15;
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
      const newScale = Math.max(minScale, resize.startScale + scaleDelta);
      const scaleDiff = newScale - resize.startScale;
      const du = (BASE_LED_WIDTH * scaleDiff) / (2 * localBounds.width);
      const dv = (BASE_LED_HEIGHT * scaleDiff) / (2 * localBounds.height);
      let newU = resize.startU;
      let newV = resize.startV;
      switch (resize.handle) {
        case 'se':
          newU = resize.startU + du;
          newV = resize.startV + dv;
          break;
        case 'sw':
          newU = resize.startU - du;
          newV = resize.startV + dv;
          break;
        case 'ne':
          newU = resize.startU + du;
          newV = resize.startV - dv;
          break;
        case 'nw':
          newU = resize.startU - du;
          newV = resize.startV - dv;
          break;
      }
      setDraftLeds((prev) =>
        prev.map((l) => (l.id === resize.ledId ? { ...l, u: newU, v: newV, scale: newScale } : l))
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
            return { ...led, u, v, rotation: newRotation };
          })
        );
      }
      setIsDirty(true);
    },
    [absoluteLeds, getSvgPoint, toManual, toManualUnclamped]
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
          addLedAtPoint(point, 0, true);
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
          if (event.shiftKey || tool === 'pan') {
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

  const handleZoomIn = useCallback(() => {
    if (!viewBox) return;
    const center = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
    const next = zoomViewBox(viewBox, 0.9, center);
    setViewBox(clampViewBoxToBase(next));
  }, [clampViewBoxToBase, viewBox]);

  const handleFit = useCallback(() => {
    if (!baseViewBox) return;
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
    addLedAtPoint(center, 0, true);
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
        newLeds.push({
          id: createLedId(),
          u: isGroup ? nu : clamp01(nu),
          v: isGroup ? nv : clamp01(nv),
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

  type GroupAxis = 'horizontal' | 'vertical';

  const inferredGroupAxis = useMemo<GroupAxis | null>(() => {
    if (!alignBounds || selectedAbsoluteLeds.length < 2) return null;
    const width = alignBounds.right - alignBounds.left;
    const height = alignBounds.bottom - alignBounds.top;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return width >= height ? 'horizontal' : 'vertical';
  }, [alignBounds, selectedAbsoluteLeds]);

  const effectiveGroupAxis = useMemo<GroupAxis | null>(() => {
    if (selectedAbsoluteLeds.length < 2) return null;
    if (Number.isFinite(groupAngle)) {
      const rad = (groupAngle * Math.PI) / 180;
      const horizontal = Math.abs(Math.cos(rad)) >= Math.abs(Math.sin(rad));
      return horizontal ? 'horizontal' : 'vertical';
    }
    return inferredGroupAxis;
  }, [groupAngle, inferredGroupAxis, selectedAbsoluteLeds]);

  const orderedSelectedAbsoluteLeds = useMemo(() => {
    if (!effectiveGroupAxis) return [];
    const sorted = [...selectedAbsoluteLeds];
    if (effectiveGroupAxis === 'horizontal') {
      sorted.sort((a, b) => a.x - b.x);
    } else {
      sorted.sort((a, b) => a.y - b.y);
    }
    return sorted;
  }, [selectedAbsoluteLeds, effectiveGroupAxis]);

  const averageSelectedSize = useMemo(() => {
    if (selectedAbsoluteLeds.length === 0) return 0;
    const total = selectedAbsoluteLeds.reduce((sum, led) => sum + Math.min(led.w, led.h), 0);
    return total / selectedAbsoluteLeds.length;
  }, [selectedAbsoluteLeds]);

  const groupExtendHandles = useMemo(
    () => {
      if (
        !localBounds ||
        !alignBounds ||
        !effectiveGroupAxis ||
        orderedSelectedAbsoluteLeds.length < 2
      ) {
        return [] as { x: number; y: number; direction: 'start' | 'end' }[];
      }

      const first = orderedSelectedAbsoluteLeds[0];
      const last = orderedSelectedAbsoluteLeds[orderedSelectedAbsoluteLeds.length - 1];

      const avgW =
        orderedSelectedAbsoluteLeds.reduce((sum, led) => sum + led.w, 0) /
        orderedSelectedAbsoluteLeds.length;
      const avgH =
        orderedSelectedAbsoluteLeds.reduce((sum, led) => sum + led.h, 0) /
        orderedSelectedAbsoluteLeds.length;

      const baseSpacing = groupSpacing > 0 ? groupSpacing : effectiveGroupAxis === 'horizontal'
          ? avgW * 0.6
          : avgH * 0.6;

      if (!Number.isFinite(baseSpacing)) {
        return [];
      }

      const handles: { x: number; y: number; direction: 'start' | 'end' }[] = [];

      if (effectiveGroupAxis === 'horizontal') {
        const gap = baseSpacing + avgW;
        const startX = first.x - gap;
        const endX = last.x + gap;
        const centerY = alignBounds.centerY;
        handles.push({ x: startX, y: centerY, direction: 'start' });
        handles.push({ x: endX, y: centerY, direction: 'end' });
      } else {
        const gap = baseSpacing + avgH;
        const startY = first.y - gap;
        const endY = last.y + gap;
        const centerX = alignBounds.centerX;
        handles.push({ x: centerX, y: startY, direction: 'start' });
        handles.push({ x: centerX, y: endY, direction: 'end' });
      }

      return handles;
    },
    [alignBounds, effectiveGroupAxis, orderedSelectedAbsoluteLeds, localBounds, groupSpacing]
  );

  /** Sync group scale and angle from selection when selection changes */
  useLayoutEffect(() => {
    if (selectedLedIds.size < 2) return;
    const selected = draftLeds.filter((l) => selectedLedIds.has(l.id));
    if (selected.length === 0) return;
    const avgScale = selected.reduce((sum, l) => sum + (l.scale ?? 1), 0) / selected.length;
    setGroupScale(avgScale);
    const avgRotation = selected.reduce((sum, l) => sum + l.rotation, 0) / selected.length;
    setGroupAngle(((avgRotation % 360) + 360) % 360);
  }, [selectedLedIds]);

  const GROUP_SPACING_MIN = 0;
  const GROUP_SPACING_MAX = 20;
  const GROUP_SCALE_MIN = 0.15;
  const GROUP_SCALE_MAX = 3;
  const GROUP_ANGLE_MIN = 0;
  const GROUP_ANGLE_MAX = 360;

  /** Apply spacing to current selection. Layout inferred from bounds if not provided. */
  const applyGroupSpacing = useCallback(
    (spacing: number, layout?: 'horizontal' | 'vertical') => {
      if (!localBounds || !alignBounds || selectedAbsoluteLeds.length < 2) return;
      const horizontal =
        layout ??
        (alignBounds.right - alignBounds.left >= alignBounds.bottom - alignBounds.top
          ? 'horizontal'
          : 'vertical');

      if (horizontal === 'horizontal') {
        const sorted = [...selectedAbsoluteLeds].sort((a, b) => a.x - b.x);
        const totalWidth =
          sorted.reduce((sum, led) => sum + led.w, 0) + (sorted.length - 1) * spacing;
        let x = alignBounds.centerX - totalWidth / 2;
        const y = alignBounds.centerY;
        const updates = new Map<string, { u: number; v: number }>();
        for (const led of sorted) {
          x += led.w / 2;
          updates.set(led.id, {
            u: (x - localBounds.x) / localBounds.width,
            v: (y - localBounds.y) / localBounds.height,
          });
          x += led.w / 2 + spacing;
        }
        setDraftLeds((prev) =>
          prev.map((led) => {
            const uv = updates.get(led.id);
            if (uv == null) return led;
            return { ...led, ...uv };
          })
        );
      } else {
        const sorted = [...selectedAbsoluteLeds].sort((a, b) => a.y - b.y);
        const totalHeight =
          sorted.reduce((sum, led) => sum + led.h, 0) + (sorted.length - 1) * spacing;
        let y = alignBounds.centerY - totalHeight / 2;
        const x = alignBounds.centerX;
        const updates = new Map<string, { u: number; v: number }>();
        for (const led of sorted) {
          y += led.h / 2;
          updates.set(led.id, {
            u: (x - localBounds.x) / localBounds.width,
            v: (y - localBounds.y) / localBounds.height,
          });
          y += led.h / 2 + spacing;
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
      setGroupLayoutMode('line');
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

      const updates = new Map<string, { u: number; v: number }>();

      ordered.forEach((led, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = originX + col * (avgW + spacing);
        const y = originY + row * (avgH + spacing);

        updates.set(led.id, {
          u: (x - localBounds.x) / localBounds.width,
          v: (y - localBounds.y) / localBounds.height,
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
    setGroupLayoutMode('grid');
  }, [arrangeGrid]);

  const handleExtendGroup = useCallback(
    (direction: 'start' | 'end') => {
      if (!localBounds || selectedAbsoluteLeds.length === 0) return;

      const axis: GroupAxis = effectiveGroupAxis ?? 'horizontal';
      const ordered = [...selectedAbsoluteLeds];
      if (axis === 'horizontal') {
        ordered.sort((a, b) => a.x - b.x);
      } else {
        ordered.sort((a, b) => a.y - b.y);
      }
      const seed = direction === 'end' ? ordered[ordered.length - 1] : ordered[0];

      const avgW =
        ordered.reduce((sum, led) => sum + led.w, 0) / ordered.length || BASE_LED_WIDTH;
      const avgH =
        ordered.reduce((sum, led) => sum + led.h, 0) / ordered.length || BASE_LED_HEIGHT;

      const baseSpacing =
        groupSpacing > 0
          ? groupSpacing
          : axis === 'horizontal'
            ? avgW * 0.6
            : avgH * 0.6;

      const dirSign = direction === 'end' ? 1 : -1;

      let du = 0;
      let dv = 0;
      if (axis === 'horizontal') {
        const deltaX = (seed.w + baseSpacing) * dirSign;
        du = deltaX / localBounds.width;
      } else {
        const deltaY = (seed.h + baseSpacing) * dirSign;
        dv = deltaY / localBounds.height;
      }

      const newLed: ManualLED = {
        id: createLedId(),
        u: seed.u + du,
        v: seed.v + dv,
        rotation: seed.rotation,
        ...(seed.scale != null && seed.scale !== 1 && { scale: seed.scale }),
      };

      setDraftLeds((prev) => [...prev, newLed]);
      setSelectedLedIds((prev) => {
        const next = new Set(prev);
        next.add(newLed.id);
        return next;
      });
      setIsDirty(true);
    },
    [effectiveGroupAxis, groupSpacing, localBounds, selectedAbsoluteLeds]
  );

  const handleSave = useCallback(() => {
    if (!editorCharId) return;
    if (!localBounds) {
      setCharManualLeds(editorCharId, draftLeds);
      setCharPlacementMode(editorCharId, 'manual');
      closeEditor();
      return;
    }
    const margin = 0.001;
    const failedIds = new Set<string>();

    for (const led of draftLeds) {
      if (led.u < -margin || led.u > 1 + margin || led.v < -margin || led.v > 1 + margin) {
        failedIds.add(led.id);
        continue;
      }
      if (pathRef.current) {
        const x = localBounds.x + led.u * localBounds.width;
        const y = localBounds.y + led.v * localBounds.height;
        let inFill: boolean;
        try {
          const bbox = pathRef.current.getBBox();
          const localX = bbox.x + x;
          const localY = bbox.y + y;
          inFill = isPointInside(pathRef.current, localX, localY);
        } catch {
          inFill = true;
        }
        if (!inFill) failedIds.add(led.id);
      }
    }

    if (failedIds.size > 0) {
      setInvalidLedIds(failedIds);
      alert(
        `Cannot save: ${failedIds.size} module(s) are outside the character.\n\nThey are highlighted in red. Move them inside the letter outline, or click a red module to clear the highlight.`
      );
      return;
    }
    const confirmed = window.confirm(
      'Save your changes? This will keep this character in manual placement mode.'
    );
    if (!confirmed) return;
    setCharManualLeds(editorCharId, draftLeds);
    setCharPlacementMode(editorCharId, 'manual');
    closeEditor();
  }, [closeEditor, draftLeds, editorCharId, localBounds, setCharManualLeds, setCharPlacementMode]);

  const handleCancel = useCallback(() => {
    closeEditor();
  }, [closeEditor]);

  if (!editorCharId) return null;

  const totalWatts = draftLeds.length * currentModule.wattsPerModule;

  return (
    <div className="fixed inset-0 z-50 text-slate-100">
      <div
        className="absolute inset-0 pointer-events-none bg-slate-950"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '10px 10px',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex h-full min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="h-16 shrink-0 border-b border-slate-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl font-bold">
                {charPath?.char || '·'}
              </div>
              <div>
                <div className="text-sm text-slate-400">Manual Designer</div>
                <div className="text-lg font-semibold">
                  {charPath?.char || 'Character'} · {editorCharId}
                </div>
              </div>
              {isDirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
            <div
              ref={canvasContainerRef}
              className={`relative flex items-center justify-center min-h-0 min-w-0 ${
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
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  Loading font engine...
                </div>
              )}
              {!loading && localBounds && viewBox && (
                <svg
                  ref={svgRef}
                  className="w-full h-full max-w-[85vw] max-h-[85vh]"
                  viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ touchAction: 'none' }}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                >
                  <path
                    ref={pathRef}
                    d={charPath?.pathData || ''}
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
              )}
            </div>

            <div className="bg-slate-900 border-l border-slate-800 p-5 space-y-5 overflow-y-auto">
              <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Module Specs</div>
                <div className="bg-slate-800 rounded-xl p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Module</span>
                    <span className="text-white font-semibold">{currentModule.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Voltage</span>
                    <span className="text-white">{currentModule.voltage}V</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watts</span>
                    <span className="text-white">{currentModule.wattsPerModule} W</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="text-white">{totalWatts.toFixed(1)} W</span>
                  </div>
                </div>
              </div>

              {selectedLedIds.size >= 2 && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Group</div>
                  <div className="bg-slate-800 rounded-xl p-4 space-y-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Group spacing</span>
                        <span className="text-white font-mono text-xs">
                          {groupSpacing.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={GROUP_SPACING_MIN}
                        max={GROUP_SPACING_MAX}
                        step={0.1}
                        value={groupSpacing}
                        onChange={(e) => {
                          const v = parseFloat(e.currentTarget.value);
                          if (Number.isFinite(v)) {
                            setGroupSpacing(v);
                            if (selectedAbsoluteLeds.length >= 2) {
                              if (groupLayoutMode === 'grid') {
                                arrangeGrid(v);
                                setGroupLayoutMode('grid');
                              } else {
                                applyGroupSpacing(v);
                              }
                            }
                          }
                        }}
                        onInput={(e) => {
                          const v = parseFloat((e.target as HTMLInputElement).value);
                          if (Number.isFinite(v)) {
                            setGroupSpacing(v);
                            if (selectedAbsoluteLeds.length >= 2) {
                              if (groupLayoutMode === 'grid') {
                                arrangeGrid(v);
                                setGroupLayoutMode('grid');
                              } else {
                                applyGroupSpacing(v);
                              }
                            }
                          }
                        }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-600 accent-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Group size</span>
                        <span className="text-white font-mono text-xs">
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
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-600 accent-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Group angle</span>
                        <span className="text-white font-mono text-xs">
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
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-600 accent-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">
                  Design Controls
                </div>
                <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>LED Count</span>
                    <span className="text-white font-semibold">{draftLeds.length}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Remove all LED modules from this character? This cannot be undone.'
                        )
                      ) {
                        handleClearAll();
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
                  >
                    Clear all modules
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Figma-style bottom center toolbar */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-2 rounded-2xl bg-slate-800/95 border border-slate-700/80 shadow-xl"
        role="toolbar"
      >
        {/* Tools: Pan, Add (place) — select is default, no button */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Pan canvas"
            onClick={() => setTool('pan')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'pan' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'}`}
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
              <path d="M18 11v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6" />
              <path d="M14 5v6a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2z" />
            </svg>
          </button>
          <button
            type="button"
            title="Box select — drag on canvas to select all modules in the box"
            onClick={() => setTool('boxSelect')}
            className={`p-2.5 rounded-xl transition-colors ${tool === 'boxSelect' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'}`}
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
            className={`p-2.5 rounded-xl transition-colors ${tool === 'add' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'}`}
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
        <div className="w-px h-8 bg-slate-600 mx-1" aria-hidden />
        {/* Global actions: Add LED at center, Zoom, Reset */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Add LED at center"
            onClick={handleAddAtCenter}
            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
            title="Zoom in"
            onClick={handleZoomIn}
            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            type="button"
            title="Reset view"
            onClick={handleFit}
            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
            <div className="w-px h-8 bg-slate-600 mx-1" aria-hidden />
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Delete selected module"
                onClick={handleDeleteSelected}
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-slate-400 hover:bg-red-900/50 hover:text-red-300 transition-colors min-w-[3rem]"
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
                className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors min-w-[3rem]"
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
                <div className="w-px h-8 bg-slate-600 mx-1" aria-hidden />
                <div className="flex items-center gap-0.5" role="group" aria-label="Align and grid">
                  <button
                    type="button"
                    title="Align horizontal"
                    onClick={handleAlignCenterH}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 transition-colors"
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
      </div>
    </div>
  );
};
