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

/** Find a point inside the path where an LED capsule can be placed (for "Add LED" when center is in a hole). */
function findPointInsidePath(
  pathElement: SVGPathElement,
  localBounds: { x: number; y: number; width: number; height: number }
): { x: number; y: number } | null {
  const cx = localBounds.x + localBounds.width / 2;
  const cy = localBounds.y + localBounds.height / 2;
  const w = localBounds.width;
  const h = localBounds.height;
  const step = Math.max(w, h) * 0.2;
  const candidates: Array<{ x: number; y: number }> = [
    { x: cx, y: cy },
    { x: cx - step, y: cy },
    { x: cx + step, y: cy },
    { x: cx, y: cy - step },
    { x: cx, y: cy + step },
    { x: cx - step, y: cy - step },
    { x: cx + step, y: cy - step },
    { x: cx - step, y: cy + step },
    { x: cx + step, y: cy + step },
    { x: cx - w * 0.35, y: cy },
    { x: cx + w * 0.35, y: cy },
    { x: cx, y: cy - h * 0.35 },
    { x: cx, y: cy + h * 0.35 },
  ];
  for (const p of candidates) {
    if (isCapsuleInside(pathElement, p.x, p.y, 0, 6)) return p;
  }
  return null;
}

export const ManualDesignerPage: React.FC = () => {
  const blocks = useProjectStore((state) => state.blocks);
  const editorCharId = useProjectStore((state) => state.editorCharId);
  const closeEditor = useProjectStore((state) => state.closeEditor);
  const setCharPlacementMode = useProjectStore((state) => state.setCharPlacementMode);
  const getCharManualLeds = useProjectStore((state) => state.getCharManualLeds);
  const setCharManualLeds = useProjectStore((state) => state.setCharManualLeds);
  const currentModule = useProjectStore((state) => state.getCurrentModule());

  const [snapEnabled, setSnapEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(2);
  const [selectedLedId, setSelectedLedId] = useState<string | null>(null);
  const [draftLeds, setDraftLeds] = useState<ManualLED[]>([]);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [baseViewBox, setBaseViewBox] = useState<ViewBox | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [invalidLedIds, setInvalidLedIds] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    ledId: string;
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
  const rotateRef = useRef<{
    pointerId: number;
    ledId: string;
    startRotation: number;
    startAngleDeg: number;
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
    setDraftLeds(initial.map((led) => ({ ...led })));
    setSelectedLedId(null);
    setIsDirty(false);
    setInvalidLedIds(new Set());
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
    setBaseViewBox(base);
    setViewBox(base);
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
        scale = ((leg.width ?? BASE_LED_WIDTH) / BASE_LED_WIDTH + (leg.height ?? BASE_LED_HEIGHT) / BASE_LED_HEIGHT) / 2;
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
    const stackThreshold = 2.5;
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

  const selectedStack = useMemo(() => {
    if (!selectedLedId) return null;
    return ledStacks.find((s) => s.includes(selectedLedId)) ?? null;
  }, [ledStacks, selectedLedId]);

  const handleSelectNextInStack = useCallback(() => {
    if (!selectedStack || selectedStack.length < 2) return;
    const i = selectedStack.indexOf(selectedLedId ?? '');
    if (i < 0) return;
    const next = selectedStack[(i + 1) % selectedStack.length];
    setSelectedLedId(next);
  }, [selectedLedId, selectedStack]);

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

  const handleLedPointerDown = useCallback(
    (event: React.PointerEvent<SVGGElement>, ledId: string, ledX: number, ledY: number) => {
      event.stopPropagation();
      const point = getSvgPoint(event);
      if (!point) return;
      setInvalidLedIds((prev) => {
        if (!prev.has(ledId)) return prev;
        const next = new Set(prev);
        next.delete(ledId);
        return next;
      });
      setSelectedLedId(ledId);
      dragRef.current = {
        pointerId: event.pointerId,
        ledId,
        offsetX: point.x - ledX,
        offsetY: point.y - ledY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [getSvgPoint]
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
      const normalized = toManual(target);
      setDraftLeds((prev) =>
        prev.map((led) => (led.id === drag.ledId ? { ...led, ...normalized } : led))
      );
      setIsDirty(true);
    },
    [getSvgPoint, localBounds, snapPoint, toManual]
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
      const minScale = 0.5;
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
        prev.map((l) =>
          l.id === resize.ledId ? { ...l, u: newU, v: newV, scale: newScale } : l
        )
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
        pointerId: event.pointerId,
        ledId,
        startRotation: led.rotation,
        startAngleDeg,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [absoluteLeds, getSvgPoint]
  );

  const handleRotationHandlePointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
      const rot = rotateRef.current;
      if (!rot || event.pointerId !== rot.pointerId) return;
      const point = getSvgPoint(event);
      if (!point) return;
      const led = absoluteLeds.find((l) => l.id === rot.ledId);
      if (!led) return;
      const currentAngleRad = Math.atan2(point.y - led.y, point.x - led.x);
      const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
      let newRotation = rot.startRotation + (currentAngleDeg - rot.startAngleDeg);
      newRotation = ((newRotation % 360) + 360) % 360;
      setDraftLeds((prev) =>
        prev.map((l) => (l.id === rot.ledId ? { ...l, rotation: newRotation } : l))
      );
      setIsDirty(true);
    },
    [absoluteLeds, getSvgPoint]
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
        setSelectedLedId(null);
        if (!viewBox) return;
        const point = getSvgPoint(event);
        if (!point) return;
        panRef.current = {
          pointerId: event.pointerId,
          start: point,
          viewBox,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [getSvgPoint, viewBox]
  );

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<SVGElement>) => {
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

  const handleCanvasPointerUp = useCallback((event: React.PointerEvent<SVGElement>) => {
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
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [handleLedPointerUp, handleResizePointerUp, handleRotationHandlePointerUp]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGElement>) => {
      if (!viewBox) return;
      event.preventDefault();
      const point = getSvgPoint(event as unknown as React.PointerEvent<SVGElement>);
      if (!point) return;
      const factor = event.deltaY > 0 ? 1.03 : 0.97;
      const next = zoomViewBox(viewBox, factor, point);
      setViewBox(clampViewBoxToBase(next));
    },
    [clampViewBoxToBase, getSvgPoint, viewBox]
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

  const addLedAtPoint = useCallback(
    (
      point: { x: number; y: number },
      rotation = 0,
      forceInsideBounds = false,
      scale?: number
    ) => {
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
      setSelectedLedId(newLed.id);
      setIsDirty(true);
    },
    [localBounds, snapPoint, toManual]
  );

  const handleAddAtCenter = useCallback(() => {
    if (!localBounds) return;
    const center = {
      x: localBounds.x + localBounds.width / 2,
      y: localBounds.y + localBounds.height / 2,
    };
    if (pathRef.current) {
      const point = findPointInsidePath(pathRef.current, localBounds);
      if (point) {
        addLedAtPoint(point);
        return;
      }
    }
    addLedAtPoint(center, 0, true);
  }, [addLedAtPoint, localBounds]);

  const handleDuplicateSelected = useCallback(() => {
    if (!localBounds || !selectedLedId) return;
    const current = draftLeds.find((led) => led.id === selectedLedId);
    if (!current) return;
    const absolute = {
      x: localBounds.x + current.u * localBounds.width + 6,
      y: localBounds.y + current.v * localBounds.height + 6,
    };
    const scale = current.scale != null ? current.scale : undefined;
    addLedAtPoint(absolute, current.rotation, true, scale);
  }, [addLedAtPoint, draftLeds, localBounds, selectedLedId]);

  const handleClearAll = useCallback(() => {
    setDraftLeds([]);
    setSelectedLedId(null);
    setIsDirty(true);
  }, []);

  const handleBringToFront = useCallback(() => {
    if (!selectedLedId) return;
    setDraftLeds((prev) => {
      const i = prev.findIndex((led) => led.id === selectedLedId);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = [...prev];
      const [removed] = next.splice(i, 1);
      next.push(removed);
      return next;
    });
    setIsDirty(true);
  }, [selectedLedId]);

  const handleSendToBack = useCallback(() => {
    if (!selectedLedId) return;
    setDraftLeds((prev) => {
      const i = prev.findIndex((led) => led.id === selectedLedId);
      if (i <= 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(i, 1);
      next.unshift(removed);
      return next;
    });
    setIsDirty(true);
  }, [selectedLedId]);

  const handleSetSelectedScale = useCallback((scale: number) => {
    if (!selectedLedId) return;
    const s = Math.max(0.5, Math.min(3, scale));
    setDraftLeds((prev) =>
      prev.map((led) => (led.id === selectedLedId ? { ...led, scale: s } : led))
    );
    setIsDirty(true);
  }, [selectedLedId]);

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
      if (
        led.u < -margin ||
        led.u > 1 + margin ||
        led.v < -margin ||
        led.v > 1 + margin
      ) {
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
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100">
      <div className="flex h-full min-h-0">
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
            <div className="relative bg-slate-950 flex items-center justify-center min-h-0 min-w-0">
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
                  onWheel={handleWheel}
                >
                  <defs>
                    <pattern id="designGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path
                        d="M 10 0 L 0 0 0 10"
                        fill="none"
                        stroke="rgba(148,163,184,0.12)"
                        strokeWidth="0.5"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#designGrid)" />
                  <path
                    ref={pathRef}
                    d={charPath?.pathData || ''}
                    transform={pathTransform}
                    fill="rgba(148,163,184,0.08)"
                    stroke="rgba(148,163,184,0.5)"
                    strokeWidth={2}
                  />
                  {absoluteLedsRenderOrder.map((led) => {
                    const selected = led.id === selectedLedId;
                    const w = led.w;
                    const h = led.h;
                    const halfW = w / 2;
                    const halfH = h / 2;
                    const stackCount = stackCountByLedId.get(led.id) ?? 1;
                    const inStack = stackCount > 1;
                    const showStackIndicator =
                      inStack && topmostLedIdPerStack.has(led.id);
                    const isInvalid = invalidLedIds.has(led.id);
                    const strokeColor = isInvalid ? '#dc2626' : '#38bdf8';
                    const circleFill = isInvalid ? '#dc2626' : '#38bdf8';
                    return (
                      <g
                        key={led.id}
                        data-led
                        transform={`rotate(${led.rotation} ${led.x} ${led.y})`}
                        style={{ cursor: 'move' }}
                        onPointerDown={(event) =>
                          handleLedPointerDown(event, led.id, led.x, led.y)
                        }
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
                        {selected && (
                          <rect
                            x={led.x - halfW - 0.8}
                            y={led.y - halfH - 0.8}
                            width={w + 1.6}
                            height={h + 1.6}
                            rx={halfH + 0.8}
                            ry={halfH + 0.8}
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth={1}
                          />
                        )}
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
                        <circle cx={led.x - w * 0.29} cy={led.y} r={Math.min(1.2, h * 0.24)} fill={circleFill} />
                        <circle cx={led.x + w * 0.29} cy={led.y} r={Math.min(1.2, h * 0.24)} fill={circleFill} />
                        {showStackIndicator && (
                          <g
                            transform={`translate(${led.x + halfW + 3}, ${led.y - halfH - 2})`}
                          >
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
                  {/* Selected LED handles on top so they work when overlapping another module */}
                  {selectedLedId && (() => {
                    const led = absoluteLeds.find((l) => l.id === selectedLedId);
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
                <div className="text-xs text-slate-400 uppercase tracking-wide">Zoom</div>
                <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                  >
                    Zoom In
                  </button>
                  <button
                    onClick={handleFit}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                  >
                    Reset
                  </button>
                </div>
                <div className="text-[11px] text-slate-400">
                  Zoom out is clamped to the full-letter view.
                </div>
              </div>
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

              <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Design Controls</div>
                <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>LED Count</span>
                    <span className="text-white font-semibold">{draftLeds.length}</span>
                  </div>
                  {ledStacks.some((s) => s.length > 1) && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                        Stacking
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={handleBringToFront}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                          disabled={!selectedLedId}
                          title="Draw this module on top of overlapping ones"
                        >
                          To front
                        </button>
                        <button
                          onClick={handleSendToBack}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                          disabled={!selectedLedId}
                          title="Send this module behind overlapping ones"
                        >
                          To back
                        </button>
                        <button
                          onClick={handleSelectNextInStack}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-amber-700/80 text-slate-200 text-xs"
                          disabled={!selectedStack || selectedStack.length < 2}
                          title="Select next module in this stack"
                        >
                          Next in stack
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Small grey badge appears only when modules are on top of each other. Use To front / To back and Next in stack to manage them.
                      </div>
                    </div>
                  )}
                  {selectedLedId && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                        Module size
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-slate-400 w-10">Scale</label>
                        <input
                          type="number"
                          min={0.5}
                          max={3}
                          step={0.1}
                          value={
                            draftLeds.find((l) => l.id === selectedLedId)?.scale ?? 1
                          }
                          onChange={(e) =>
                            handleSetSelectedScale(Number(e.target.value) || 1)
                          }
                          className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs w-20"
                        />
                        <span className="text-[11px] text-slate-500">1 = 12×5</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Shape stays fixed; drag corners to resize. Drag the circle above the module to rotate.
                      </div>
                      <button
                        onClick={handleDuplicateSelected}
                        className="w-full px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                        title="Duplicate this module with same rotation and size"
                      >
                        Duplicate module
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleAddAtCenter}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                  >
                    Add LED
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-xs"
                  >
                    Clear All
                  </button>
                  {/* Snap to Grid UI hidden for now; snapEnabled/gridSize/snapPoint logic kept in code */}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
