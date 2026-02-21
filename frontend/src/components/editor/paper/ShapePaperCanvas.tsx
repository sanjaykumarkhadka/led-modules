import React, { useCallback, useEffect, useRef } from 'react';
import paper from 'paper';
import { useTheme } from '../../ui/ThemeProvider';
import { buildEditableAnchorPoints } from '../../../core/math/pathEditor';

export interface ShapePaperCanvasProps {
  pathData: string;
  bounds: { x: number; y: number; width: number; height: number } | null;
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onPathChange: (newPathData: string) => { accepted: boolean };
  /** Called once after the editor has parsed the initial path, with the
   *  Paper.js-normalised version of the SVG string.  Use it to seed the
   *  validation baseline so the first drag doesn't produce a spurious warning. */
  onEditorReady?: (normalizedPathData: string) => void;
}

const FIT_PADDING_FACTOR = 0.12;

const HANDLE_RADIUS = 2.8;
const HANDLE_RADIUS_SELECTED = 3.6;
const HANDLE_HIT_TOLERANCE = 7; // px in screen space

const COLORS = {
  anchorFill: '#f8fafc',
  anchorStroke: '#2563eb',
  anchorFillSelected: '#2563eb',
  anchorStrokeSelected: '#f8fafc',
} as const;

function screenTolerance(scope: paper.PaperScope, px: number) {
  return px / scope.view.zoom;
}

interface AnchorRecord {
  circle: paper.Path.Circle;
  anchorId: string;
  /** Index into the flat, all-subpaths segment list */
  globalIndex: number;
  subPathIndex: number;
  segmentIndex: number;
}

interface ActiveDrag {
  record: AnchorRecord;
  /** Offset from segment position to mouse position at drag start (project coords) */
  pointerOffset: paper.Point;
  lastValidPt: paper.Point;
}

export const ShapePaperCanvas: React.FC<ShapePaperCanvasProps> = ({
  pathData,
  bounds,
  selectedPointId,
  onSelectPoint,
  onPathChange,
  onEditorReady,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<paper.PaperScope | null>(null);
  const glyphPathRef = useRef<paper.CompoundPath | null>(null);
  const editPathRef = useRef<paper.CompoundPath | null>(null);
  const anchorsLayerRef = useRef<paper.Layer | null>(null);
  const gridLayerRef = useRef<paper.Layer | null>(null);
  const anchorRecordsRef = useRef<AnchorRecord[]>([]);

  // Stable refs so closures inside the Tool never go stale.
  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;
  const onSelectPointRef = useRef(onSelectPoint);
  onSelectPointRef.current = onSelectPoint;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const selectedPointIdRef = useRef(selectedPointId);
  selectedPointIdRef.current = selectedPointId;

  // Active drag state — lives inside the tool, not in React state.
  const activeDragRef = useRef<ActiveDrag | null>(null);
  // Set to true while the spacebar is held.
  const spacePressedRef = useRef(false);
  const isLocalDragRef = useRef(false);
  const hasAutoFittedRef = useRef(false);
  const boundsChangedRef = useRef(false);
  const lastLocalAcceptedPathRef = useRef<string | null>(null);
  const lastExternalAppliedPathRef = useRef<string | null>(null);
  const lastEditorReadyPathRef = useRef<string | null>(null);
  const prevThemeDarkRef = useRef(isDark);
  const prevBoundsRef = useRef(bounds);

  const boundsEqual = (
    a: { x: number; y: number; width: number; height: number } | null,
    b: { x: number; y: number; width: number; height: number } | null,
  ) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
      Math.abs(a.x - b.x) < 1e-4 &&
      Math.abs(a.y - b.y) < 1e-4 &&
      Math.abs(a.width - b.width) < 1e-4 &&
      Math.abs(a.height - b.height) < 1e-4
    );
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const getSubPaths = (cp: paper.CompoundPath): paper.Path[] =>
    cp.children ? (cp.children as paper.Path[]) : [cp as unknown as paper.Path];

  const syncGlyphToEditPath = useCallback(() => {
    const glyph = glyphPathRef.current;
    const edit = editPathRef.current;
    if (!glyph || !edit) return;
    glyph.pathData = edit.pathData;
  }, []);

  const fitView = useCallback(
    (scope: paper.PaperScope, b: { x: number; y: number; width: number; height: number }) => {
      const padX = b.width * FIT_PADDING_FACTOR;
      const padY = b.height * FIT_PADDING_FACTOR;
      const paddedW = b.width + padX * 2;
      const paddedH = b.height + padY * 2;
      const el = scope.view.element as HTMLCanvasElement;
      const cW = el.offsetWidth || el.width || 800;
      const cH = el.offsetHeight || el.height || 600;
      scope.view.zoom = Math.min(cW / paddedW, cH / paddedH);
      scope.view.center = new scope.Point(b.x + b.width / 2, b.y + b.height / 2);
    },
    [],
  );

  // ─── Visual helpers ────────────────────────────────────────────────────────────

  const applyAnchorStyle = useCallback(
    (record: AnchorRecord, isSelected: boolean, zoom: number) => {
      const c = record.circle;
      c.fillColor = new paper.Color(isSelected ? COLORS.anchorFillSelected : COLORS.anchorFill);
      c.strokeColor = new paper.Color(isSelected ? COLORS.anchorStrokeSelected : COLORS.anchorStroke);
      c.strokeWidth = (isSelected ? 1.2 : 0.9) / zoom;
      // Scale circle to target radius (Paper's Circle has no .radius setter).
      const currentR = c.bounds.width / 2;
      const targetR = isSelected ? HANDLE_RADIUS_SELECTED : HANDLE_RADIUS;
      if (Math.abs(currentR - targetR) > 0.001) {
        c.scale(targetR / currentR);
      }
    },
    [],
  );

  const refreshAnchorVisuals = useCallback(
    (selectedId: string | null) => {
      const scope = scopeRef.current;
      if (!scope) return;
      for (const rec of anchorRecordsRef.current) {
        applyAnchorStyle(rec, String(rec.globalIndex) === selectedId, scope.view.zoom);
      }
    },
    [applyAnchorStyle],
  );

  // ─── Draw grid ────────────────────────────────────────────────────────────────

  const drawGrid = useCallback(
    (scope: paper.PaperScope, b: { x: number; y: number; width: number; height: number }) => {
      const layer = gridLayerRef.current;
      if (!layer) return;
      layer.activate();
      layer.removeChildren();

      const minorColor = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.12)';
      const majorColor = isDark ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)';
      const step = 10;
      const pad = 300;
      const x0 = Math.floor((b.x - pad) / step) * step;
      const x1 = b.x + b.width + pad;
      const y0 = Math.floor((b.y - pad) / step) * step;
      const y1 = b.y + b.height + pad;

      for (let x = x0; x <= x1; x += step) {
        const line = new scope.Path.Line(new scope.Point(x, y0), new scope.Point(x, y1));
        const major = x % 50 === 0;
        line.strokeColor = new scope.Color(major ? majorColor : minorColor);
        line.strokeWidth = (major ? 0.7 : 0.4) / scope.view.zoom;
      }
      for (let y = y0; y <= y1; y += step) {
        const line = new scope.Path.Line(new scope.Point(x0, y), new scope.Point(x1, y));
        const major = y % 50 === 0;
        line.strokeColor = new scope.Color(major ? majorColor : minorColor);
        line.strokeWidth = (major ? 0.7 : 0.4) / scope.view.zoom;
      }
    },
    [isDark],
  );

  // ─── Sync scene to pathData ────────────────────────────────────────────────────

  const syncScene = useCallback(
    (
      scope: paper.PaperScope,
      data: string,
      options?: { emitEditorReady?: boolean; fitView?: boolean },
    ) => {
      // ── Remove old items ──
      if (glyphPathRef.current) { glyphPathRef.current.remove(); glyphPathRef.current = null; }
      if (editPathRef.current) { editPathRef.current.remove(); editPathRef.current = null; }
      anchorsLayerRef.current?.removeChildren();
      anchorRecordsRef.current = [];
      activeDragRef.current = null;
      isLocalDragRef.current = false;

      if (!data.trim()) return;

      const b = boundsRef.current;

      // ── Grid (background layer) ──
      if (b) drawGrid(scope, b);

      // ── Glyph (visual, background layer) ──
      scope.project.layers[0]?.activate();
      const glyphFill = isDark ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.08)';
      const glyphStroke = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.50)';
      const glyph = new scope.CompoundPath(data);
      glyph.fillColor = new scope.Color(glyphFill);
      glyph.strokeColor = new scope.Color(glyphStroke);
      glyph.strokeWidth = 2 / scope.view.zoom;
      glyph.fillRule = 'evenodd';
      glyphPathRef.current = glyph;

      // ── Edit path (invisible, drives drag) ──
      const editCp = new scope.CompoundPath(data);
      editCp.visible = false;
      editPathRef.current = editCp;

      // ── Notify parent with Paper.js-normalised path (seeds the validator) ──
      if (options?.emitEditorReady && lastEditorReadyPathRef.current !== editCp.pathData) {
        onEditorReadyRef.current?.(editCp.pathData);
        lastEditorReadyPathRef.current = editCp.pathData;
      }

      // ── Anchor handles (anchors layer) ──
      anchorsLayerRef.current?.activate();
      const subPaths = getSubPaths(editCp);
      const editableAnchors = buildEditableAnchorPoints(editCp.pathData);
      if (import.meta.env.DEV && editableAnchors.length !== subPaths.reduce((acc, sp) => acc + (sp.segments?.length ?? 0), 0)) {
        console.debug('[shape-paper] anchor mapping count mismatch', {
          editableAnchors: editableAnchors.length,
          paperSegments: subPaths.reduce((acc, sp) => acc + (sp.segments?.length ?? 0), 0),
        });
      }
      let globalIdx = 0;
      for (let spi = 0; spi < subPaths.length; spi++) {
        const sp = subPaths[spi];
        if (!sp.segments) continue;
        for (let si = 0; si < sp.segments.length; si++) {
          const pt = sp.segments[si].point;
          const circle = new scope.Path.Circle(pt, HANDLE_RADIUS);
          circle.fillColor = new scope.Color(COLORS.anchorFill);
          circle.strokeColor = new scope.Color(COLORS.anchorStroke);
          circle.strokeWidth = 0.9 / scope.view.zoom;
          const mappedAnchorId = editableAnchors[globalIdx]?.id ?? String(globalIdx);
          anchorRecordsRef.current.push({
            circle,
            anchorId: mappedAnchorId,
            globalIndex: globalIdx,
            subPathIndex: spi,
            segmentIndex: si,
          });
          globalIdx++;
        }
      }

      // Apply selected visual.
      refreshAnchorVisuals(selectedPointIdRef.current);
      if (
        selectedPointIdRef.current != null &&
        !anchorRecordsRef.current.some((record) => record.anchorId === selectedPointIdRef.current)
      ) {
        onSelectPointRef.current(null);
      }

      // Fit view.
      if (options?.fitView && b) {
        fitView(scope, b);
        hasAutoFittedRef.current = true;
      }
      scope.view.update();
    },
    [drawGrid, fitView, isDark, refreshAnchorVisuals],
  );

  // ─── Mount: setup Paper.js scope, Tool, ResizeObserver ───────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scope = new paper.PaperScope();
    scope.setup(canvas);
    scopeRef.current = scope;

    // Layer 0 = background (grid + glyph)
    const bgLayer = scope.project.activeLayer;
    bgLayer.name = 'background';
    // Layer 1 = anchors (always on top)
    const anchorLayer = new scope.Layer();
    anchorLayer.name = 'anchors';
    gridLayerRef.current = bgLayer;
    anchorsLayerRef.current = anchorLayer;

    // ── Tool: all mouse interactions go through here. ───────────────────────
    // Using a single Tool avoids the Paper.js item-event / tool-event conflict
    // where both fire simultaneously and fight each other.
    const tool = new scope.Tool();
    tool.minDistance = 1;

    tool.onMouseDown = (evt: paper.ToolEvent) => {
      // Hit-test against anchor circles.
      const tol = screenTolerance(scope, HANDLE_HIT_TOLERANCE);
      const hit = scope.project.hitTest(evt.point, {
        fill: true,
        stroke: false,
        bounds: false,
        segments: false,
        tolerance: tol,
        // Only test the anchors layer.
        match: (h: paper.HitResult) => h.item.layer === anchorLayer,
      });

      if (hit?.item) {
        const rec = anchorRecordsRef.current.find((r) => r.circle === hit.item);
        if (rec) {
          const editCp = editPathRef.current;
          if (!editCp) return;
          const subPaths = getSubPaths(editCp);
          const sp = subPaths[rec.subPathIndex];
          const seg = sp?.segments?.[rec.segmentIndex];
          if (!seg) return;

          activeDragRef.current = {
            record: rec,
            pointerOffset: evt.point.subtract(seg.point),
            lastValidPt: seg.point.clone(),
          };
          isLocalDragRef.current = true;
          onSelectPointRef.current(rec.anchorId);
          return;
        }
      }

      // Clicked on empty space — deselect.
      activeDragRef.current = null;
      isLocalDragRef.current = false;
      onSelectPointRef.current(null);
    };

    tool.onMouseDrag = (evt: paper.ToolEvent) => {
      const drag = activeDragRef.current;
      if (drag) {
        // ── Move the dragged anchor ──────────────────────────────────────
        const b = boundsRef.current;
        const editCp = editPathRef.current;
        if (!editCp) return;
        const subPaths = getSubPaths(editCp);
        const sp = subPaths[drag.record.subPathIndex];
        const seg = sp?.segments?.[drag.record.segmentIndex];
        if (!seg) return;

        // Target = current pointer minus original grab offset (project coords).
        const target = evt.point.subtract(drag.pointerOffset);
        const cx = b ? Math.max(b.x, Math.min(b.x + b.width, target.x)) : target.x;
        const cy = b ? Math.max(b.y, Math.min(b.y + b.height, target.y)) : target.y;

        seg.point = new scope.Point(cx, cy);
        drag.record.circle.position = seg.point;
        syncGlyphToEditPath();

        const newPathData = editPathRef.current?.pathData ?? '';
        if (newPathData) {
          const result = onPathChangeRef.current(newPathData);
          if (!result.accepted) {
            // Revert segment before Paper.js redraws — the handle never escapes.
            seg.point = drag.lastValidPt.clone();
            drag.record.circle.position = drag.lastValidPt.clone();
            syncGlyphToEditPath();
          } else {
            drag.lastValidPt = seg.point.clone();
            lastLocalAcceptedPathRef.current = newPathData;
          }
        }
        return;
      }

      // ── Pan (space + drag, or no anchor active) ──────────────────────────
      if (spacePressedRef.current) {
        scope.view.center = (scope.view.center as paper.Point).subtract(evt.delta);
      }
    };

    tool.onMouseUp = () => {
      activeDragRef.current = null;
      isLocalDragRef.current = false;
    };

    // ── Keyboard: space for pan ──────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') spacePressedRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spacePressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Wheel: zoom centred on pointer ───────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1 / 1.1 : 1.1;
      const mouseView = new scope.Point(e.offsetX, e.offsetY);
      const worldBefore = scope.view.viewToProject(mouseView);
      scope.view.zoom /= factor;
      const worldAfter = scope.view.viewToProject(mouseView);
      scope.view.center = (scope.view.center as paper.Point).subtract(
        worldAfter.subtract(worldBefore),
      );
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ── ResizeObserver: keep canvas pixel size in sync ───────────────────────
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      scope.view.viewSize = new scope.Size(
        Math.max(100, rect.width),
        Math.max(100, rect.height),
      );
      const b = boundsRef.current;
      if (b) fitView(scope, b);
    });
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      tool.remove();
      try { scope.project?.clear(); } catch (_) { /* ignore */ }
      scopeRef.current = null;
      glyphPathRef.current = null;
      editPathRef.current = null;
      anchorsLayerRef.current = null;
      gridLayerRef.current = null;
      anchorRecordsRef.current = [];
      activeDragRef.current = null;
      isLocalDragRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sync scene whenever pathData or theme changes ────────────────────────────
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const themeChanged = prevThemeDarkRef.current !== isDark;
    prevThemeDarkRef.current = isDark;
    const boundsDidChange = !boundsEqual(prevBoundsRef.current, bounds);
    prevBoundsRef.current = bounds;
    if (boundsDidChange) boundsChangedRef.current = true;

    if (isLocalDragRef.current && pathData === lastLocalAcceptedPathRef.current) {
      return;
    }
    if (!themeChanged && editPathRef.current?.pathData === pathData) {
      return;
    }

    const externalPathChange = pathData !== lastExternalAppliedPathRef.current;
    const shouldFit = !hasAutoFittedRef.current || externalPathChange || boundsChangedRef.current;
    syncScene(scope, pathData, {
      emitEditorReady: externalPathChange,
      fitView: shouldFit,
    });
    lastExternalAppliedPathRef.current = pathData;
    if (shouldFit) boundsChangedRef.current = false;
  }, [pathData, isDark, syncScene]);

  // ─── Update anchor visuals when selection changes ─────────────────────────────
  useEffect(() => {
    refreshAnchorVisuals(selectedPointId);
    scopeRef.current?.view.update();
  }, [selectedPointId, refreshAnchorVisuals]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full max-w-[85vw] max-h-[85vh] block"
      style={{
        background: isDark ? '#111827' : '#f8fafc',
        touchAction: 'none',
        cursor: 'default',
      }}
    />
  );
};
