import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { ManualLED } from '../../../data/store';
import { useTheme } from '../../ui/ThemeProvider';
import type { EditablePathPoint } from '../../../core/math/pathEditor'; // kept for deprecated prop type
import {
  BASE_LED_HEIGHT,
  BASE_LED_WIDTH,
  MAX_LED_SCALE,
  MIN_LED_SCALE,
} from '../../canvas/konva/editorPolicies';
import {
  applyResizeOppositeAnchor,
  applyRotate,
  startTransform,
} from '../../canvas/konva/transformEngine';
import { resolveManualLedPoint } from '../../../core/math/manualLedCoordinates';
import {
  createInteractionMachine,
  resetInteraction,
  transitionInteraction,
} from '../../canvas/konva/interactionStateMachine';
import { useInteractionTelemetry } from '../../canvas/konva/useInteractionTelemetry';

type ToolMode = 'select' | 'pan' | 'add' | 'boxSelect';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type ViewBox = { x: number; y: number; width: number; height: number };
const VIEWBOX_EPSILON = 1e-4;

export interface ManualKonvaCanvasProps {
  editorMode: 'module' | 'shape';
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  isPanning: boolean;
  setIsPanning: (next: boolean) => void;
  viewBox: ViewBox;
  setViewBox: (next: ViewBox) => void;
  clampViewBoxToBase: (next: ViewBox) => ViewBox;
  localBounds: { x: number; y: number; width: number; height: number };
  pathData: string;
  pathOffset: { x: number; y: number };
  draftLeds: ManualLED[];
  setDraftLeds: React.Dispatch<React.SetStateAction<ManualLED[]>>;
  selectedLedIds: Set<string>;
  setSelectedLedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  invalidLedIds: Set<string>;
  charVisualScale: number;
  snapEnabled: boolean;
  gridSize: number;
  setIsDirty: (next: boolean) => void;
  /** @deprecated shape editing is now handled by ShapePaperCanvas; always pass [] */
  shapePoints?: EditablePathPoint[];
  selectedShapePointId?: string | null;
  onSelectShapePoint?: (id: string | null) => void;
  onUpdateShapePoint?: (id: string, point: { x: number; y: number }) => void;
  showShapeDebug?: boolean;
  anchorDebugCountById?: Record<string, number>;
  tinyModuleLodEnabled?: boolean;
  tinyModuleLodPxThreshold?: number;
  onViewportInteractionStart?: () => void;
}

function createLedId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export const ManualKonvaCanvas: React.FC<ManualKonvaCanvasProps> = ({
  tool,
  setTool,
  isPanning,
  setIsPanning,
  viewBox,
  setViewBox,
  clampViewBoxToBase,
  localBounds,
  pathData,
  pathOffset,
  draftLeds,
  setDraftLeds,
  selectedLedIds,
  setSelectedLedIds,
  invalidLedIds,
  charVisualScale,
  snapEnabled,
  gridSize,
  setIsDirty,
  tinyModuleLodEnabled = true,
  tinyModuleLodPxThreshold = 22,
  onViewportInteractionStart,
}) => {
  // Set `VITE_MANUAL_ZOOM_DEBUG=1` to enable verbose zoom diagnostics in dev.
  const DEBUG_ZOOM = import.meta.env.DEV && import.meta.env.VITE_MANUAL_ZOOM_DEBUG === '1';
  const { theme } = useTheme();
  const telemetry = useInteractionTelemetry('manual-stage');
  const isDark = theme === 'dark';
  const interactionRef = useRef(createInteractionMachine());
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{
    startPointerPx: { x: number; y: number };
    startViewBox: ViewBox;
    startScale: number;
  } | null>(null);
  const panPendingViewBoxRef = useRef<ViewBox | null>(null);
  const panRafRef = useRef<number | null>(null);
  const viewBoxRef = useRef<ViewBox>(viewBox);
  const dragRef = useRef<{
    leadId: string;
    allIds: string[];
    startPositions: Map<string, { u: number; v: number }>;
    pointerOffset: { x: number; y: number };
    session: ReturnType<typeof startTransform>;
  } | null>(null);
  const resizeRef = useRef<{
    ledId: string;
    handle: ResizeHandle;
    session: ReturnType<typeof startTransform>;
    startScale: number;
    startCenter: { x: number; y: number };
    startW: number;
    startH: number;
    startRotation: number;
  } | null>(null);
  const rotateSingleRef = useRef<{
    ledId: string;
    startRotation: number;
    startAngleDeg: number;
  } | null>(null);
  const rotateGroupRef = useRef<{
    ledIds: string[];
    startRotations: Map<string, number>;
    startPositions: Map<string, { x: number; y: number }>;
    center: { x: number; y: number };
    startAngleDeg: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(240, Math.floor(rect.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  useEffect(() => {
    const cancel = () => {
      marqueeStartRef.current = null;
      setMarqueeRect(null);
      panStartRef.current = null;
      panPendingViewBoxRef.current = null;
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      dragRef.current = null;
      resizeRef.current = null;
      rotateSingleRef.current = null;
      rotateGroupRef.current = null;
      setIsPanning(false);
      resetInteraction(interactionRef.current);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setIsPanning]);

  const isSameViewBox = useCallback((a: ViewBox, b: ViewBox) => {
    return (
      Math.abs(a.x - b.x) <= VIEWBOX_EPSILON &&
      Math.abs(a.y - b.y) <= VIEWBOX_EPSILON &&
      Math.abs(a.width - b.width) <= VIEWBOX_EPSILON &&
      Math.abs(a.height - b.height) <= VIEWBOX_EPSILON
    );
  }, []);

  const commitPanViewBox = useCallback(
    (candidate: ViewBox) => {
      const current = viewBoxRef.current;
      if (isSameViewBox(current, candidate)) return;
      viewBoxRef.current = candidate;
      setViewBox(candidate);
    },
    [isSameViewBox, setViewBox]
  );

  const schedulePanViewBox = useCallback(
    (candidate: ViewBox) => {
      panPendingViewBoxRef.current = candidate;
      if (panRafRef.current != null) return;
      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        const pending = panPendingViewBoxRef.current;
        panPendingViewBoxRef.current = null;
        if (!pending) return;
        commitPanViewBox(pending);
      });
    },
    [commitPanViewBox]
  );

  useEffect(() => {
    return () => {
      panPendingViewBoxRef.current = null;
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
    };
  }, []);


  const scale = useMemo(() => {
    const sx = size.width / Math.max(1, viewBox.width);
    const sy = size.height / Math.max(1, viewBox.height);
    return Math.min(sx, sy);
  }, [size.height, size.width, viewBox.height, viewBox.width]);

  const stageOffset = useMemo(() => {
    return {
      x: (size.width - viewBox.width * scale) / 2 - viewBox.x * scale,
      y: (size.height - viewBox.height * scale) / 2 - viewBox.y * scale,
    };
  }, [scale, size.height, size.width, viewBox.height, viewBox.width, viewBox.x, viewBox.y]);

  const toWorld = useCallback((point: { x: number; y: number }) => {
    return {
      x: (point.x - stageOffset.x) / scale,
      y: (point.y - stageOffset.y) / scale,
    };
  }, [scale, stageOffset.x, stageOffset.y]);

  const getPointerWorld = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return toWorld(pointer);
  }, [toWorld]);

  const snapPoint = (point: { x: number; y: number }) => {
    if (!snapEnabled) return point;
    const step = gridSize || 1;
    return {
      x: Math.round(point.x / step) * step,
      y: Math.round(point.y / step) * step,
    };
  };

  const toManual = (point: { x: number; y: number }) => {
    return {
      u: (point.x - localBounds.x) / localBounds.width,
      v: (point.y - localBounds.y) / localBounds.height,
    };
  };

  const absoluteLeds = useMemo(() => {
    return draftLeds.map((led) => {
      const scaleValue = led.scale ?? 1;
      const { x: resolvedX, y: resolvedY } = resolveManualLedPoint(led, localBounds);
      return {
        ...led,
        x: resolvedX,
        y: resolvedY,
        w: BASE_LED_WIDTH * scaleValue * charVisualScale,
        h: BASE_LED_HEIGHT * scaleValue * charVisualScale,
        scaleValue,
      };
    });
  }, [charVisualScale, draftLeds, localBounds.height, localBounds.width, localBounds.x, localBounds.y]);

  const absoluteById = useMemo(() => new Map(absoluteLeds.map((l) => [l.id, l])), [absoluteLeds]);
  const primarySelected = useMemo(() => {
    if (selectedLedIds.size !== 1) return null;
    const id = Array.from(selectedLedIds)[0];
    return absoluteById.get(id) ?? null;
  }, [absoluteById, selectedLedIds]);
  const groupCenter = useMemo(() => {
    if (selectedLedIds.size < 2) return null;
    const selected = absoluteLeds.filter((led) => selectedLedIds.has(led.id));
    if (selected.length < 2) return null;
    let sx = 0;
    let sy = 0;
    selected.forEach((led) => {
      sx += led.x;
      sy += led.y;
    });
    return { x: sx / selected.length, y: sy / selected.length };
  }, [absoluteLeds, selectedLedIds]);

  const selectionBounds = useMemo(() => {
    const selected = absoluteLeds.filter((led) => selectedLedIds.has(led.id));
    if (selected.length < 2) return null;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    selected.forEach((led) => {
      const halfW = led.w / 2;
      const halfH = led.h / 2;
      left = Math.min(left, led.x - halfW);
      right = Math.max(right, led.x + halfW);
      top = Math.min(top, led.y - halfH);
      bottom = Math.max(bottom, led.y + halfH);
    });
    return {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [absoluteLeds, selectedLedIds]);

  const handleStageWheel = useCallback(
    (evt: Konva.KonvaEventObject<WheelEvent>) => {
      evt.evt.preventDefault();
      const stage = evt.target.getStage();
      if (!stage) return;
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const pointer = {
        x: evt.evt.clientX - rect.left,
        y: evt.evt.clientY - rect.top,
      };
      onViewportInteractionStart?.();
      const world = toWorld(pointer);
      const factor = evt.evt.deltaY > 0 ? 1.03 : 0.97;
      const zoomed = {
        x: world.x - (world.x - viewBox.x) * factor,
        y: world.y - (world.y - viewBox.y) * factor,
        width: viewBox.width * factor,
        height: viewBox.height * factor,
      };
      const clamped = clampViewBoxToBase(zoomed);
      const atZoomInLimit =
        evt.evt.deltaY < 0 &&
        Math.abs(clamped.width - viewBox.width) < VIEWBOX_EPSILON &&
        Math.abs(clamped.height - viewBox.height) < VIEWBOX_EPSILON;
      const unchanged =
        Math.abs(clamped.x - viewBox.x) < VIEWBOX_EPSILON &&
        Math.abs(clamped.y - viewBox.y) < VIEWBOX_EPSILON &&
        Math.abs(clamped.width - viewBox.width) < VIEWBOX_EPSILON &&
        Math.abs(clamped.height - viewBox.height) < VIEWBOX_EPSILON;
      if (DEBUG_ZOOM) {
        console.debug('[manual-zoom]', {
          deltaY: evt.evt.deltaY,
          clientX: evt.evt.clientX,
          clientY: evt.evt.clientY,
          rectLeft: rect.left,
          rectTop: rect.top,
          pointer,
          world,
          factor,
          clampedUnchanged: unchanged,
          atZoomInLimit,
          prev: viewBox,
          next: zoomed,
          clamped,
        });
      }
      if (atZoomInLimit) return;
      if (unchanged) return;
      setViewBox(clamped);
    },
    [DEBUG_ZOOM, clampViewBoxToBase, onViewportInteractionStart, setViewBox, toWorld, viewBox]
  );

  const stageClassName = useMemo(() => {
    if (tool === 'pan' && isPanning) return 'cursor-grabbing';
    if (tool === 'pan') return 'cursor-grab';
    if (tool === 'add' || tool === 'boxSelect') return 'cursor-crosshair';
    return '';
  }, [isPanning, tool]);

  const colors = useMemo(
    () => ({
      gridMinor: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.12)',
      gridMajor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)',
      stageBackground: isDark ? '#111827' : '#f8fafc',
      glyphFill: isDark ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.08)',
      glyphStroke: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.50)',
      ledStroke: isDark ? '#38bdf8' : '#0369a1',
      ledDot: isDark ? '#38bdf8' : '#075985',
      ledSelected: isDark ? '#60a5fa' : '#1d4ed8',
      ledHandle: isDark ? '#60a5fa' : '#2563eb',
      tinyStroke: isDark ? '#cbd5e1' : '#334155',
      tinySelectedHalo: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(241,245,249,0.95)',
      invalid: '#dc2626',
      controlStroke: isDark ? '#cbd5e1' : '#334155',
      selectionFill: isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(29, 78, 216, 0.14)',
      selectionStroke: isDark ? 'rgba(96, 165, 250, 0.72)' : 'rgba(29, 78, 216, 0.72)',
    }),
    [isDark]
  );

  // Build the grid lines every time the viewBox or theme changes, matching
  // the Paper.js grid used in the shape editor exactly.
  const gridLines = useMemo(() => {
    const step = 10;
    // Extend well past the viewBox so the grid covers panned positions.
    const padX = Math.max(300, viewBox.width);
    const padY = Math.max(300, viewBox.height);
    const x0 = Math.floor((viewBox.x - padX) / step) * step;
    const y0 = Math.floor((viewBox.y - padY) / step) * step;
    const x1 = viewBox.x + viewBox.width + padX;
    const y1 = viewBox.y + viewBox.height + padY;
    const gridMinor = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.12)';
    const gridMajor = isDark ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)';
    const lines: React.ReactElement[] = [];
    for (let x = x0; x <= x1; x += step) {
      const major = Math.round(x) % 50 === 0;
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, y0, x, y1]}
          stroke={major ? gridMajor : gridMinor}
          strokeWidth={major ? 0.7 : 0.45}
          listening={false}
        />
      );
    }
    for (let y = y0; y <= y1; y += step) {
      const major = Math.round(y) % 50 === 0;
      lines.push(
        <Line
          key={`h${y}`}
          points={[x0, y, x1, y]}
          stroke={major ? gridMajor : gridMinor}
          strokeWidth={major ? 0.7 : 0.45}
          listening={false}
        />
      );
    }
    return lines;
  }, [viewBox, isDark]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-0 min-w-0 ${stageClassName}`}
      style={{ background: colors.stageBackground }}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={size.width}
        height={size.height}
        onWheel={handleStageWheel}
        onMouseDown={(evt) => {
          const stage = evt.target.getStage();
          if (!stage) return;

          if (tool === 'add') {
            const world = getPointerWorld();
            if (!world) return;
            const snapped = snapPoint(world);
            const { u, v } = toManual(snapped);
            const newLed: ManualLED = { id: createLedId(), u, v, x: snapped.x, y: snapped.y, rotation: 0 };
            setDraftLeds((prev) => [...prev, newLed]);
            setSelectedLedIds(new Set([newLed.id]));
            setIsDirty(true);
            return;
          }

          if (tool === 'boxSelect') {
            const world = getPointerWorld();
            if (!world) return;
            transitionInteraction(interactionRef.current, 'selecting');
            marqueeStartRef.current = world;
            setMarqueeRect({ x: world.x, y: world.y, width: 0, height: 0 });
            return;
          }

          if (tool === 'pan') {
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            onViewportInteractionStart?.();
            transitionInteraction(interactionRef.current, 'panning');
            panStartRef.current = {
              startPointerPx: { x: pointer.x, y: pointer.y },
              startViewBox: { ...viewBox },
              startScale: scale,
            };
            setIsPanning(true);
            return;
          }

          const inLedItem = Boolean(evt.target.findAncestor('.led-item'));
          const inLedControls = Boolean(evt.target.findAncestor('.led-controls'));
          if (!inLedItem && !inLedControls) {
            setSelectedLedIds(new Set());
          }
        }}
        onMouseMove={(evt) => {
          const pan = panStartRef.current;
          if (pan) {
            const stage = evt.target.getStage();
            const pointer = stage?.getPointerPosition() ?? stageRef.current?.getPointerPosition();
            if (!pointer) return;
            const dxPx = pointer.x - pan.startPointerPx.x;
            const dyPx = pointer.y - pan.startPointerPx.y;
            const dxWorld = dxPx / Math.max(pan.startScale, 1e-6);
            const dyWorld = dyPx / Math.max(pan.startScale, 1e-6);
            const next = clampViewBoxToBase({
              ...pan.startViewBox,
              x: pan.startViewBox.x - dxWorld,
              y: pan.startViewBox.y - dyWorld,
            });
            schedulePanViewBox(next);
            return;
          }

          const world = getPointerWorld();
          if (!world) return;
          if (marqueeStartRef.current && marqueeRect) {
            const sx = marqueeStartRef.current.x;
            const sy = marqueeStartRef.current.y;
            setMarqueeRect({
              x: Math.min(sx, world.x),
              y: Math.min(sy, world.y),
              width: Math.abs(world.x - sx),
              height: Math.abs(world.y - sy),
            });
            return;
          }

          const drag = dragRef.current;
          if (drag) {
            const target = snapPoint(world);
            const leadNorm = toManual({
              x: target.x - drag.pointerOffset.x,
              y: target.y - drag.pointerOffset.y,
            });
            const leadStart = drag.startPositions.get(drag.leadId);
            if (!leadStart) return;
            const du = leadNorm.u - leadStart.u;
            const dv = leadNorm.v - leadStart.v;
            setDraftLeds((prev) =>
              prev.map((led) => {
                if (!drag.allIds.includes(led.id)) return led;
                const start = drag.startPositions.get(led.id);
                if (!start) return led;
                const nextU = start.u + du;
                const nextV = start.v + dv;
                const nextX = localBounds.x + nextU * localBounds.width;
                const nextY = localBounds.y + nextV * localBounds.height;
                return {
                  ...led,
                  u: nextU,
                  v: nextV,
                  x: nextX,
                  y: nextY,
                };
              })
            );
            setIsDirty(true);
            return;
          }

          const resize = resizeRef.current;
          if (resize) {
            const result = applyResizeOppositeAnchor(
              {
                    centerX: resize.startCenter.x,
                    centerY: resize.startCenter.y,
                width: resize.startW,
                height: resize.startH,
                rotationDeg: resize.startRotation,
                scale: resize.startScale,
                minScale: MIN_LED_SCALE,
                maxScale: MAX_LED_SCALE,
              },
              {
                dx: world.x - resize.session.pointerStart.x,
                dy: world.y - resize.session.pointerStart.y,
              },
              resize.handle,
              {
                x: -1_000_000_000,
                y: -1_000_000_000,
                width: 2_000_000_000,
                height: 2_000_000_000,
              }
            );

            setDraftLeds((prev) =>
              prev.map((it) =>
                it.id === resize.ledId
                  ? {
                      ...it,
                      scale: result.scale,
                    }
                  : it
              )
            );
            setIsDirty(true);
            return;
          }

          const rot = rotateSingleRef.current;
          if (rot) {
            const led = absoluteById.get(rot.ledId);
            if (!led) return;
            const nextRotation = applyRotate(
              { x: led.x, y: led.y },
              { pointerAngleDeg: rot.startAngleDeg, rotationDeg: rot.startRotation },
              world
            );
            setDraftLeds((prev) =>
              prev.map((it) => (it.id === rot.ledId ? { ...it, rotation: nextRotation } : it))
            );
            setIsDirty(true);
            return;
          }

          const groupRot = rotateGroupRef.current;
          if (groupRot) {
            const baseRotation = 0;
            const nextRotation = applyRotate(
              groupRot.center,
              { pointerAngleDeg: groupRot.startAngleDeg, rotationDeg: baseRotation },
              world
            );
            const delta = nextRotation - baseRotation;
            const rad = (delta * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            setDraftLeds((prev) =>
              prev.map((it) => {
                if (!groupRot.ledIds.includes(it.id)) return it;
                const startPos = groupRot.startPositions.get(it.id);
                const startRot = groupRot.startRotations.get(it.id);
                if (!startPos || startRot == null) return it;
                const dx = startPos.x - groupRot.center.x;
                const dy = startPos.y - groupRot.center.y;
                const nextX = groupRot.center.x + dx * cos - dy * sin;
                const nextY = groupRot.center.y + dx * sin + dy * cos;
                const uv = toManual({ x: nextX, y: nextY });
                let rotation = startRot + delta;
                rotation = ((rotation % 360) + 360) % 360;
                return { ...it, u: uv.u, v: uv.v, x: nextX, y: nextY, rotation };
              })
            );
            setIsDirty(true);
          }
        }}
        onMouseUp={() => {
          if (marqueeStartRef.current && marqueeRect) {
            const ids = absoluteLeds
              .filter((led) => {
                const halfW = led.w / 2;
                const halfH = led.h / 2;
                const left = led.x - halfW;
                const right = led.x + halfW;
                const top = led.y - halfH;
                const bottom = led.y + halfH;
                return !(
                  right < marqueeRect.x ||
                  left > marqueeRect.x + marqueeRect.width ||
                  bottom < marqueeRect.y ||
                  top > marqueeRect.y + marqueeRect.height
                );
              })
              .map((led) => led.id);
            setSelectedLedIds(new Set(ids));
            marqueeStartRef.current = null;
            setMarqueeRect(null);
            setTool('select');
          }
          if (panPendingViewBoxRef.current) {
            commitPanViewBox(panPendingViewBoxRef.current);
            panPendingViewBoxRef.current = null;
          }
          if (panRafRef.current != null) {
            cancelAnimationFrame(panRafRef.current);
            panRafRef.current = null;
          }
          panStartRef.current = null;
          dragRef.current = null;
          resizeRef.current = null;
          rotateSingleRef.current = null;
          rotateGroupRef.current = null;
          resetInteraction(interactionRef.current);
          setIsPanning(false);
          telemetry('commit', { selected: selectedLedIds.size });
        }}
      >
        <Layer x={stageOffset.x} y={stageOffset.y} scaleX={scale} scaleY={scale}>
          {/* Full-canvas background fill so colour is consistent regardless of CSS */}
          <Rect
            x={viewBox.x - 5000}
            y={viewBox.y - 5000}
            width={viewBox.width + 10000}
            height={viewBox.height + 10000}
            fill={colors.stageBackground}
            listening={false}
          />

          <Group listening={false}>
            {gridLines}
          </Group>

          <Path
            data={pathData || ''}
            x={-pathOffset.x}
            y={-pathOffset.y}
            fill={colors.glyphFill}
            stroke={colors.glyphStroke}
            strokeWidth={2}
            listening={false}
          />

          {absoluteLeds.map((led) => {
            const selected = selectedLedIds.has(led.id);
            const isInvalid = invalidLedIds.has(led.id);
            const stroke = isInvalid ? colors.invalid : colors.ledStroke;
            const fillDot = isInvalid ? colors.invalid : colors.ledDot;
            const minModulePx = Math.min(led.w, led.h) * scale;
            const renderTinyAsDotted = tinyModuleLodEnabled && minModulePx < tinyModuleLodPxThreshold;
            const tinyStrokeWidth = Math.max(0.95 / Math.max(scale, 1e-6), 0.22);
            // Keep tiny modules visually identical to large ones by preserving
            // the same relative proportions (no hard minimums that distort shape).
            const moduleStrokeWidth = isInvalid
              ? Math.max(led.h * 0.22, 0.2)
              : Math.max(led.h * 0.17, 0.14);
            const dotRadius = Math.max(Math.min(led.h * 0.14, led.h * 0.32), 0.06);
            const dotOffset = Math.min(
              led.w * 0.29,
              Math.max(0, led.w / 2 - dotRadius - moduleStrokeWidth * 0.5)
            );
            const tinyDash = [
              Math.max(2.4 / Math.max(scale, 1e-6), 0.6),
              Math.max(3.0 / Math.max(scale, 1e-6), 0.8),
            ];
            return (
              <Group
                key={led.id}
                name="led-item"
                x={led.x}
                y={led.y}
                rotation={led.rotation}
                onMouseDown={() => {
                  if (tool === 'pan' || tool === 'boxSelect') return;
                  if (!transitionInteraction(interactionRef.current, 'dragging')) return;
                  const world = getPointerWorld();
                  if (!world) return;
                  const multi = selectedLedIds.has(led.id) && selectedLedIds.size >= 2;
                  const ids = multi ? Array.from(selectedLedIds) : [led.id];
                  if (!multi) setSelectedLedIds(new Set([led.id]));
                  const start = new Map<string, { u: number; v: number }>();
                  draftLeds.forEach((it) => {
                    if (ids.includes(it.id)) start.set(it.id, { u: it.u, v: it.v });
                  });
                  dragRef.current = {
                    leadId: led.id,
                    allIds: ids,
                    startPositions: start,
                    pointerOffset: {
                      x: world.x - led.x,
                      y: world.y - led.y,
                    },
                    session: startTransform(world),
                  };
                  telemetry('drag-start', { count: ids.length });
                }}
              >
                {renderTinyAsDotted ? (
                  <>
                    {selected && (
                      <Line
                        points={[-led.w / 2, 0, led.w / 2, 0]}
                        stroke={colors.tinySelectedHalo}
                        strokeWidth={tinyStrokeWidth * 2.5}
                        lineCap="round"
                        listening={false}
                      />
                    )}
                    <Line
                      points={[-led.w / 2, 0, led.w / 2, 0]}
                      stroke={isInvalid ? colors.invalid : colors.tinyStroke}
                      strokeWidth={tinyStrokeWidth}
                      dash={tinyDash}
                      lineCap="round"
                      listening={false}
                    />
                    <Rect x={-led.w / 2} y={-Math.max(led.h / 2, 1.2)} width={led.w} height={Math.max(led.h, 2.4)} fill="transparent" />
                  </>
                ) : (
                  <>
                    {selected && (
                      (() => {
                        const selPad = Math.min(Math.max(led.h * 0.16, 0.04), 0.28);
                        const selStroke = Math.min(Math.max(led.h * 0.18, 0.08), 0.45);
                        return (
                          <Rect
                            x={-led.w / 2 - selPad}
                            y={-led.h / 2 - selPad}
                            width={led.w + selPad * 2}
                            height={led.h + selPad * 2}
                            cornerRadius={led.h / 2 + selPad}
                            stroke={colors.ledSelected}
                            strokeWidth={selStroke}
                            fillEnabled={false}
                          />
                        );
                      })()
                    )}
                    <Rect
                      x={-led.w / 2}
                      y={-led.h / 2}
                      width={led.w}
                      height={led.h}
                      cornerRadius={led.h / 2}
                      stroke={stroke}
                      strokeWidth={moduleStrokeWidth}
                      fillEnabled={false}
                    />
                    <Rect x={-led.w / 2} y={-led.h / 2} width={led.w} height={led.h} fill="transparent" />
                    <Circle
                      x={-dotOffset}
                      y={0}
                      radius={dotRadius}
                      fill={fillDot}
                      listening={false}
                    />
                    <Circle
                      x={dotOffset}
                      y={0}
                      radius={dotRadius}
                      fill={fillDot}
                      listening={false}
                    />
                  </>
                )}
              </Group>
            );
          })}

          {primarySelected && (
            <Group
              name="led-controls"
              x={primarySelected.x}
              y={primarySelected.y}
              rotation={primarySelected.rotation}
            >
              {(() => {
                const minDim = Math.max(0.1, Math.min(primarySelected.w, primarySelected.h));
                const maxDim = Math.max(primarySelected.w, primarySelected.h);
                const arrowLen = Math.min(Math.max(minDim * 0.9, 0.22), Math.max(0.6, maxDim * 0.55));
                const arrowHalf = arrowLen * 0.45;
                const edgeInset = Math.min(Math.max(minDim * 0.18, 0.08), maxDim * 0.22);
                const arrowStrokeWidth = Math.min(Math.max(minDim * 0.11, 0.08), 0.42);
                const cornerHitRadius = Math.min(Math.max(minDim * 0.35, 0.14), maxDim * 0.4);
                const startResizeFromHandle = (handle: ResizeHandle) => {
                  if (!transitionInteraction(interactionRef.current, 'resizing')) return;
                  const world = getPointerWorld();
                  if (!world) return;
                  resizeRef.current = {
                    ledId: primarySelected.id,
                    handle,
                    session: startTransform(world),
                    startScale: primarySelected.scaleValue,
                    startCenter: { x: primarySelected.x, y: primarySelected.y },
                    startW: BASE_LED_WIDTH * charVisualScale,
                    startH: BASE_LED_HEIGHT * charVisualScale,
                    startRotation: primarySelected.rotation,
                  };
                  telemetry('resize-start', { id: primarySelected.id, handle, edge: handle });
                };
                const resizeArrowStroke = isDark ? '#ffffff' : '#1e293b';
                return (
                  <>
                    {/* Corner arrow indicators (visual only). */}
                    <Line
                      points={[
                        -primarySelected.w / 2 - edgeInset + arrowHalf,
                        -primarySelected.h / 2 - edgeInset,
                        -primarySelected.w / 2 - edgeInset,
                        -primarySelected.h / 2 - edgeInset,
                        -primarySelected.w / 2 - edgeInset,
                        -primarySelected.h / 2 - edgeInset + arrowHalf,
                      ]}
                      stroke={resizeArrowStroke}
                      strokeWidth={arrowStrokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                    <Line
                      points={[
                        primarySelected.w / 2 + edgeInset - arrowHalf,
                        -primarySelected.h / 2 - edgeInset,
                        primarySelected.w / 2 + edgeInset,
                        -primarySelected.h / 2 - edgeInset,
                        primarySelected.w / 2 + edgeInset,
                        -primarySelected.h / 2 - edgeInset + arrowHalf,
                      ]}
                      stroke={resizeArrowStroke}
                      strokeWidth={arrowStrokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                    <Line
                      points={[
                        -primarySelected.w / 2 - edgeInset + arrowHalf,
                        primarySelected.h / 2 + edgeInset,
                        -primarySelected.w / 2 - edgeInset,
                        primarySelected.h / 2 + edgeInset,
                        -primarySelected.w / 2 - edgeInset,
                        primarySelected.h / 2 + edgeInset - arrowHalf,
                      ]}
                      stroke={resizeArrowStroke}
                      strokeWidth={arrowStrokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                    <Line
                      points={[
                        primarySelected.w / 2 + edgeInset - arrowHalf,
                        primarySelected.h / 2 + edgeInset,
                        primarySelected.w / 2 + edgeInset,
                        primarySelected.h / 2 + edgeInset,
                        primarySelected.w / 2 + edgeInset,
                        primarySelected.h / 2 + edgeInset - arrowHalf,
                      ]}
                      stroke={resizeArrowStroke}
                      strokeWidth={arrowStrokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />

                    {/* Corner-only resize hit targets. */}
                    <Rect
                      x={-primarySelected.w / 2 - edgeInset - cornerHitRadius}
                      y={-primarySelected.h / 2 - edgeInset - cornerHitRadius}
                      width={cornerHitRadius * 2}
                      height={cornerHitRadius * 2}
                      fill="transparent"
                      onMouseDown={() => startResizeFromHandle('nw')}
                    />
                    <Rect
                      x={primarySelected.w / 2 + edgeInset - cornerHitRadius}
                      y={-primarySelected.h / 2 - edgeInset - cornerHitRadius}
                      width={cornerHitRadius * 2}
                      height={cornerHitRadius * 2}
                      fill="transparent"
                      onMouseDown={() => startResizeFromHandle('ne')}
                    />
                    <Rect
                      x={-primarySelected.w / 2 - edgeInset - cornerHitRadius}
                      y={primarySelected.h / 2 + edgeInset - cornerHitRadius}
                      width={cornerHitRadius * 2}
                      height={cornerHitRadius * 2}
                      fill="transparent"
                      onMouseDown={() => startResizeFromHandle('sw')}
                    />
                    <Rect
                      x={primarySelected.w / 2 + edgeInset - cornerHitRadius}
                      y={primarySelected.h / 2 + edgeInset - cornerHitRadius}
                      width={cornerHitRadius * 2}
                      height={cornerHitRadius * 2}
                      fill="transparent"
                      onMouseDown={() => startResizeFromHandle('se')}
                    />
                  </>
                );
              })()}
              {(() => {
                const rotationHandleRadius = Math.max(Math.min(primarySelected.h * 0.16, 1.1), 0.12);
                const rotationHandleGap = Math.max(Math.min(primarySelected.h * 0.3, 0.9), 0.08);
                const handleY = -primarySelected.h / 2 - rotationHandleGap - rotationHandleRadius;
                const iconColor = isDark ? '#e2e8f0' : '#1e293b';
                const iconFontSize = Math.max(rotationHandleRadius * 1.5, 0.18);

                const startRotate = () => {
                  if (!transitionInteraction(interactionRef.current, 'rotating')) return;
                  const world = getPointerWorld();
                  if (!world) return;
                  const start =
                    (Math.atan2(world.y - primarySelected.y, world.x - primarySelected.x) * 180) /
                    Math.PI;
                  rotateSingleRef.current = {
                    ledId: primarySelected.id,
                    startRotation: primarySelected.rotation,
                    startAngleDeg: start,
                  };
                  telemetry('rotate-start', { mode: 'single' });
                };

                return (
                  <Group x={0} y={handleY} onMouseDown={startRotate}>
                    <Circle
                      radius={rotationHandleRadius}
                      stroke={colors.controlStroke}
                      strokeWidth={Math.max(Math.min(primarySelected.h * 0.06, 0.45), 0.08)}
                      fill={colors.ledHandle}
                    />
                    <Text
                      x={-iconFontSize * 0.32}
                      y={-iconFontSize * 0.54}
                      text="↻"
                      fontSize={iconFontSize}
                      fill={iconColor}
                      listening={false}
                    />
                    <Circle radius={rotationHandleRadius * 1.25} fill="transparent" />
                  </Group>
                );
              })()}
            </Group>
          )}

          {groupCenter && (
            <Circle
              name="led-controls"
              x={groupCenter.x}
              y={groupCenter.y - 8}
              radius={2.2}
              stroke={colors.controlStroke}
              strokeWidth={0.9}
              fill={colors.ledHandle}
              onMouseDown={() => {
                if (!transitionInteraction(interactionRef.current, 'rotating')) return;
                const world = getPointerWorld();
                if (!world) return;
                const start =
                  (Math.atan2(world.y - groupCenter.y, world.x - groupCenter.x) * 180) / Math.PI;
                const selected = absoluteLeds.filter((led) => selectedLedIds.has(led.id));
                const startRotations = new Map<string, number>();
                const startPositions = new Map<string, { x: number; y: number }>();
                selected.forEach((led) => {
                  startRotations.set(led.id, led.rotation);
                  startPositions.set(led.id, { x: led.x, y: led.y });
                });
                rotateGroupRef.current = {
                  ledIds: selected.map((led) => led.id),
                  startRotations,
                  startPositions,
                  center: groupCenter,
                  startAngleDeg: start,
                };
                telemetry('rotate-start', { mode: 'group', count: selected.length });
              }}
            />
          )}

          {selectionBounds && (
            <Rect
              x={selectionBounds.x - 1.6}
              y={selectionBounds.y - 1.6}
              width={selectionBounds.width + 3.2}
              height={selectionBounds.height + 3.2}
              stroke={colors.ledSelected}
              strokeWidth={0.9}
              dash={[4, 3]}
              fillEnabled={false}
              listening={false}
            />
          )}

          {marqueeRect && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill={colors.selectionFill}
              stroke={colors.selectionStroke}
              strokeWidth={1}
              dash={[3, 2]}
            />
          )}


        </Layer>
      </Stage>
    </div>
  );
};
