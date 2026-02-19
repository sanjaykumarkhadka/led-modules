import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Path, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import type { ManualLED } from '../../../data/store';
import { useTheme } from '../../ui/ThemeProvider';
import type { EditablePathPoint } from '../../../core/math/pathEditor';
import {
  BASE_LED_HEIGHT,
  BASE_LED_WIDTH,
  MAX_LED_SCALE,
  MAX_ZOOM_IN_FACTOR,
  MIN_LED_SCALE,
} from '../../canvas/konva/editorPolicies';
import {
  applyResizeOppositeAnchor,
  applyRotate,
  startTransform,
} from '../../canvas/konva/transformEngine';
import {
  createInteractionMachine,
  resetInteraction,
  transitionInteraction,
} from '../../canvas/konva/interactionStateMachine';
import { useInteractionTelemetry } from '../../canvas/konva/useInteractionTelemetry';

type ToolMode = 'select' | 'pan' | 'add' | 'boxSelect';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface ManualKonvaCanvasProps {
  editorMode: 'module' | 'shape';
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  isPanning: boolean;
  setIsPanning: (next: boolean) => void;
  viewBox: { x: number; y: number; width: number; height: number };
  setViewBox: (next: { x: number; y: number; width: number; height: number }) => void;
  clampViewBoxToBase: (next: { x: number; y: number; width: number; height: number }) => {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  shapePoints: EditablePathPoint[];
  selectedShapePointId: string | null;
  onSelectShapePoint: (id: string | null) => void;
  onUpdateShapePoint: (id: string, point: { x: number; y: number }) => void;
}

function createLedId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export const ManualKonvaCanvas: React.FC<ManualKonvaCanvasProps> = ({
  editorMode,
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
  shapePoints,
  selectedShapePointId,
  onSelectShapePoint,
  onUpdateShapePoint,
}) => {
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
    x: number;
    y: number;
    viewBox: { x: number; y: number; width: number; height: number };
  } | null>(null);
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
    const cancel = () => {
      marqueeStartRef.current = null;
      setMarqueeRect(null);
      panStartRef.current = null;
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
      const resolvedX =
        led.x != null ? led.x : localBounds.x + led.u * localBounds.width;
      const resolvedY =
        led.y != null ? led.y : localBounds.y + led.v * localBounds.height;
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Manual editor allows zooming out only.
      if (e.deltaY < 0) return;
      const world = getPointerWorld();
      if (!world) return;
      const factor = e.deltaY > 0 ? 1.03 : 0.97;
      const minWidth = viewBox.width * MAX_ZOOM_IN_FACTOR;
      const minHeight = viewBox.height * MAX_ZOOM_IN_FACTOR;
      const zoomed = {
        x: world.x - (world.x - viewBox.x) * factor,
        y: world.y - (world.y - viewBox.y) * factor,
        width: Math.max(minWidth, viewBox.width * factor),
        height: Math.max(minHeight, viewBox.height * factor),
      };
      setViewBox(clampViewBoxToBase(zoomed));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampViewBoxToBase, getPointerWorld, setViewBox, viewBox]);

  const stageClassName = useMemo(() => {
    if (editorMode === 'shape') return '';
    if (tool === 'pan' && isPanning) return 'cursor-grabbing';
    if (tool === 'pan') return 'cursor-grab';
    if (tool === 'add' || tool === 'boxSelect') return 'cursor-crosshair';
    return '';
  }, [editorMode, isPanning, tool]);

  const colors = useMemo(
    () => ({
      gridMinor: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.12)',
      gridMajor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)',
      stageBackground: isDark ? '#111827' : '#f8fafc',
      glyphFill: isDark ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.08)',
      glyphStroke: isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.50)',
      ledStroke: isDark ? '#38bdf8' : '#0284c7',
      ledSelected: isDark ? '#60a5fa' : '#2563eb',
      ledHandle: isDark ? '#60a5fa' : '#2563eb',
      invalid: '#dc2626',
      controlStroke: isDark ? '#cbd5e1' : '#475569',
      selectionFill: isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.12)',
      selectionStroke: isDark ? 'rgba(96, 165, 250, 0.72)' : 'rgba(37, 99, 235, 0.72)',
    }),
    [isDark]
  );

  return (
    <div ref={containerRef} className={`relative min-h-0 min-w-0 ${stageClassName}`}>
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={size.width}
        height={size.height}
        onMouseDown={(evt) => {
          const world = getPointerWorld();
          if (!world) return;

          if (editorMode === 'shape') {
            if (evt.target === evt.target.getStage()) {
              onSelectShapePoint(null);
            }
            return;
          }

          if (tool === 'add') {
            const snapped = snapPoint(world);
            const { u, v } = toManual(snapped);
            const newLed: ManualLED = { id: createLedId(), u, v, x: snapped.x, y: snapped.y, rotation: 0 };
            setDraftLeds((prev) => [...prev, newLed]);
            setSelectedLedIds(new Set([newLed.id]));
            setIsDirty(true);
            return;
          }

          if (tool === 'boxSelect') {
            transitionInteraction(interactionRef.current, 'selecting');
            marqueeStartRef.current = world;
            setMarqueeRect({ x: world.x, y: world.y, width: 0, height: 0 });
            return;
          }

          if (tool === 'pan') {
            transitionInteraction(interactionRef.current, 'panning');
            panStartRef.current = {
              x: world.x,
              y: world.y,
              viewBox: { ...viewBox },
            };
            setIsPanning(true);
            return;
          }

          if (evt.target === evt.target.getStage()) {
            setSelectedLedIds(new Set());
          }
        }}
        onMouseMove={() => {
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

          const pan = panStartRef.current;
          if (pan) {
            const dx = world.x - pan.x;
            const dy = world.y - pan.y;
            setViewBox(
              clampViewBoxToBase({
                ...pan.viewBox,
                x: pan.viewBox.x - dx,
                y: pan.viewBox.y - dy,
              })
            );
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
          <Rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.width}
            height={viewBox.height}
            fill="transparent"
          />

          <Group listening={false}>
            {Array.from({ length: 120 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[viewBox.x - 1200, i * 10 - 1200, viewBox.x + viewBox.width + 1200, i * 10 - 1200]}
                stroke={i % 5 === 0 ? colors.gridMajor : colors.gridMinor}
                strokeWidth={i % 5 === 0 ? 0.7 : 0.45}
              />
            ))}
            {Array.from({ length: 160 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 10 - 1200, viewBox.y - 1200, i * 10 - 1200, viewBox.y + viewBox.height + 1200]}
                stroke={i % 5 === 0 ? colors.gridMajor : colors.gridMinor}
                strokeWidth={i % 5 === 0 ? 0.7 : 0.45}
              />
            ))}
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
            const fillDot = isInvalid ? colors.invalid : colors.ledStroke;
            return (
              <Group
                key={led.id}
                x={led.x}
                y={led.y}
                rotation={led.rotation}
                onMouseDown={() => {
                  if (editorMode === 'shape') return;
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
                {selected && (
                  <Rect
                    x={-led.w / 2 - 0.6}
                    y={-led.h / 2 - 0.6}
                    width={led.w + 1.2}
                    height={led.h + 1.2}
                    cornerRadius={led.h / 2}
                    stroke={colors.ledSelected}
                    strokeWidth={0.6}
                    fillEnabled={false}
                  />
                )}
                <Rect
                  x={-led.w / 2}
                  y={-led.h / 2}
                  width={led.w}
                  height={led.h}
                  cornerRadius={led.h / 2}
                  stroke={stroke}
                  strokeWidth={isInvalid ? 1.1 : 0.85}
                  fillEnabled={false}
                />
                <Rect x={-led.w / 2} y={-led.h / 2} width={led.w} height={led.h} fill="transparent" />
                <Circle x={-led.w * 0.29} y={0} radius={0.7} fill={fillDot} listening={false} />
                <Circle x={led.w * 0.29} y={0} radius={0.7} fill={fillDot} listening={false} />
              </Group>
            );
          })}

          {primarySelected && (
            <Group x={primarySelected.x} y={primarySelected.y} rotation={primarySelected.rotation}>
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                const hx =
                  handle === 'nw' || handle === 'sw'
                    ? -primarySelected.w / 2 - 2
                    : primarySelected.w / 2 - 2;
                const hy =
                  handle === 'nw' || handle === 'ne'
                    ? -primarySelected.h / 2 - 2
                    : primarySelected.h / 2 - 2;
                return (
                  <Rect
                    key={handle}
                    x={hx}
                    y={hy}
                    width={4}
                    height={4}
                    fill={colors.ledHandle}
                    onMouseDown={() => {
                      if (editorMode === 'shape') return;
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
                      telemetry('resize-start', { id: primarySelected.id, handle });
                    }}
                  />
                );
              })}
              <Circle
                x={0}
                y={-primarySelected.h / 2 - Math.max(3, Math.min(5, primarySelected.w * 0.25))}
                radius={1.8}
                stroke={colors.controlStroke}
                strokeWidth={0.8}
                fill={colors.ledHandle}
                onMouseDown={() => {
                  if (editorMode === 'shape') return;
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
                }}
              />
            </Group>
          )}

          {groupCenter && (
            <Circle
              x={groupCenter.x}
              y={groupCenter.y - 8}
              radius={2.2}
              stroke={colors.controlStroke}
              strokeWidth={0.9}
              fill={colors.ledHandle}
              onMouseDown={() => {
                if (editorMode === 'shape') return;
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

          {shapePoints.length > 0 && (
            <Group x={-pathOffset.x} y={-pathOffset.y}>
              {shapePoints.map((point) => {
                const selected = selectedShapePointId === point.id;
                const radius =
                  point.kind === 'anchor'
                    ? selected
                      ? 2.5
                      : 2.1
                    : selected
                      ? 2.2
                      : 1.8;
                const fill =
                  point.kind === 'anchor'
                    ? selected
                      ? '#2563eb'
                      : '#f8fafc'
                    : selected
                      ? '#38bdf8'
                      : isDark
                        ? '#94a3b8'
                        : '#64748b';
                const stroke =
                  point.kind === 'anchor'
                    ? selected
                      ? '#f8fafc'
                      : '#2563eb'
                    : selected
                      ? '#f8fafc'
                      : isDark
                        ? '#38bdf8'
                        : '#0ea5e9';
                return (
                  <Circle
                    key={point.id}
                    x={point.x}
                    y={point.y}
                    radius={radius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={selected ? 1.1 : 0.9}
                    draggable={editorMode === 'shape'}
                    onMouseDown={() => {
                      if (editorMode !== 'shape') return;
                      onSelectShapePoint(point.id);
                    }}
                    onDragMove={(evt) => {
                      if (editorMode !== 'shape') return;
                      const pos = evt.target.position();
                      onUpdateShapePoint(point.id, { x: pos.x, y: pos.y });
                    }}
                  />
                );
              })}
            </Group>
          )}

        </Layer>
      </Stage>
    </div>
  );
};
