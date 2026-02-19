import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Path, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { BlockCharPaths, CharLEDData, CharacterEntity } from '../../../data/store';
import { calculateLetterDimensions, formatDimension, getDimensionValue } from '../../../core/math/dimensions';
import type { BoundingBox } from '../../../core/math/dimensions';
import { getViewportTransform } from './viewport';
import { useStagePointer } from './useStagePointer';
import {
  startTransform,
  clampGroupDrag,
} from './transformEngine';
import {
  createInteractionMachine,
  resetInteraction,
  transitionInteraction,
} from './interactionStateMachine';
import { useInteractionTelemetry } from './useInteractionTelemetry';

interface DesignerKonvaStageProps {
  viewBox: { x: number; y: number; width: number; height: number };
  blockCharPaths: BlockCharPaths[];
  charLeds: CharLEDData[];
  selectedCharId: string | null;
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';
  getCharacter: (charId: string) => CharacterEntity | null;
  getCharBBox: (charId: string) => BoundingBox | null;
  updateCharacter: (charId: string, updates: Partial<Omit<CharacterEntity, 'id'>>) => void;
  onSelectChar: (charId: string) => void;
  onClearSelection: () => void;
  onCharacterMutate?: () => void;
  getCharVisualScale: (charId: string) => number;
  allLedCount: number;
}

export const DesignerKonvaStage: React.FC<DesignerKonvaStageProps> = ({
  viewBox,
  blockCharPaths,
  charLeds,
  selectedCharId,
  showDimensions,
  dimensionUnit,
  getCharacter,
  getCharBBox,
  updateCharacter,
  onSelectChar,
  onClearSelection,
  onCharacterMutate,
  getCharVisualScale,
  allLedCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });

  const telemetry = useInteractionTelemetry('designer-stage');
  const interactionRef = useRef(createInteractionMachine());
  const dragRef = useRef<{
    charId: string;
    session: ReturnType<typeof startTransform>;
    startChar: { x: number; baselineY: number };
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const cancel = () => {
      dragRef.current = null;
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
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(220, Math.floor(rect.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const transform = useMemo(() => getViewportTransform(size, viewBox), [size, viewBox]);
  const getPointerWorld = useStagePointer(transform);

  const selectedBbox = useMemo(() => {
    if (!selectedCharId) return null;
    return getCharBBox(selectedCharId);
  }, [getCharBBox, selectedCharId]);

  const selectedDimensions = useMemo(() => {
    if (!showDimensions || !selectedBbox) return null;
    const dims = calculateLetterDimensions(selectedBbox, 12.5);
    return {
      width: formatDimension(getDimensionValue(dims, 'width', dimensionUnit), dimensionUnit),
      height: formatDimension(getDimensionValue(dims, 'height', dimensionUnit), dimensionUnit),
    };
  }, [dimensionUnit, selectedBbox, showDimensions]);

  const handleStartDrag = (charId: string) => {
    if (!transitionInteraction(interactionRef.current, 'dragging')) return;
    const world = getPointerWorld(stageRef.current);
    if (!world) {
      resetInteraction(interactionRef.current);
      return;
    }
    const char = getCharacter(charId);
    const bbox = getCharBBox(charId);
    if (!char || !bbox) return;
    dragRef.current = {
      charId,
      session: startTransform(world),
      startChar: { x: char.x, baselineY: char.baselineY },
      width: bbox.width,
      height: bbox.height,
    };
    telemetry('drag-start', { charId, x: char.x, y: char.baselineY });
  };

  return (
    <div
      ref={containerRef}
      className="canvas-stage-container relative h-full w-full overflow-hidden rounded-none bg-[var(--stage-bg)]"
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={size.width}
        height={size.height}
        onMouseDown={(evt) => {
          if (evt.target === evt.target.getStage()) {
            onClearSelection();
          }
        }}
        onMouseMove={() => {
          const world = getPointerWorld(stageRef.current);
          if (!world) return;

          const drag = dragRef.current;
          if (drag) {
            const delta = clampGroupDrag(
              {
                dx: world.x - drag.session.pointerStart.x,
                dy: world.y - drag.session.pointerStart.y,
              },
              [
                {
                  x: drag.startChar.x + drag.width / 2,
                  y: drag.startChar.baselineY - drag.height / 2,
                  width: drag.width,
                  height: drag.height,
                },
              ],
              viewBox
            );
            updateCharacter(drag.charId, {
              x: drag.startChar.x + delta.dx,
              baselineY: drag.startChar.baselineY + delta.dy,
            });
            return;
          }

        }}
        onMouseUp={() => {
          if (dragRef.current) {
            telemetry('transform-commit', { mode: interactionRef.current.state });
            onCharacterMutate?.();
          }
          dragRef.current = null;
          resetInteraction(interactionRef.current);
        }}
      >
        <Layer x={transform.x} y={transform.y} scaleX={transform.scale} scaleY={transform.scale}>
          <Rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="var(--stage-bg)" />

          <Group listening={false}>
            {Array.from({ length: 120 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[viewBox.x - 1200, i * 20 - 1200, viewBox.x + viewBox.width + 1200, i * 20 - 1200]}
                stroke="var(--stage-grid-line)"
                strokeWidth={i % 5 === 0 ? 0.7 : 0.45}
              />
            ))}
            {Array.from({ length: 180 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 20 - 1200, viewBox.y - 1200, i * 20 - 1200, viewBox.y + viewBox.height + 1200]}
                stroke="var(--stage-grid-line)"
                strokeWidth={i % 5 === 0 ? 0.7 : 0.45}
              />
            ))}
          </Group>

          {blockCharPaths.flatMap(({ charPaths }) =>
            charPaths.map((charPath) => {
              const charId = charPath.charId ?? `${charPath.charIndex}`;
              if (!charPath.pathData) return null;
              const bbox = getCharBBox(charId) ?? charPath.bbox;
              const isSelected = selectedCharId === charId;
              return (
                <Group key={charId}>
                  {bbox && (
                    <Rect
                      x={bbox.x}
                      y={bbox.y}
                      width={bbox.width}
                      height={bbox.height}
                      fill="transparent"
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                        onSelectChar(charId);
                        if (isSelected) {
                          handleStartDrag(charId);
                        }
                      }}
                    />
                  )}
                  {isSelected && (
                    <Path
                      data={charPath.pathData}
                      fillEnabled={false}
                      stroke="#18181b"
                      strokeWidth={6}
                      dash={[8, 4]}
                      opacity={0.45}
                      listening={false}
                    />
                  )}
                  <Path
                    data={charPath.pathData}
                    fill="white"
                    stroke={isSelected ? '#111827' : '#334155'}
                    strokeWidth={isSelected ? 3 : 2}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                      onSelectChar(charId);
                      if (isSelected) {
                        handleStartDrag(charId);
                      }
                    }}
                  />
                </Group>
              );
            })
          )}

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
                <Group key={key} x={led.x} y={led.y} rotation={led.rotation}>
                  <Rect
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    cornerRadius={height / 2}
                    fillEnabled={false}
                    stroke={isManual ? '#e4e4e7' : '#71717a'}
                    strokeWidth={0.8}
                  />
                  <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill="transparent" />
                  <Rect x={-dotOffset - dotRadius} y={-dotRadius} width={dotRadius * 2} height={dotRadius * 2} cornerRadius={dotRadius} fill="#52525b" listening={false} />
                  <Rect x={dotOffset - dotRadius} y={-dotRadius} width={dotRadius * 2} height={dotRadius * 2} cornerRadius={dotRadius} fill="#52525b" listening={false} />
                </Group>
              );
            })
          )}

          {selectedBbox && selectedDimensions && (
            <Group listening={false}>
              <Line
                points={[
                  selectedBbox.x,
                  selectedBbox.y + selectedBbox.height + 20,
                  selectedBbox.x + selectedBbox.width,
                  selectedBbox.y + selectedBbox.height + 20,
                ]}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <Text
                x={selectedBbox.x + selectedBbox.width / 2 - 30}
                y={selectedBbox.y + selectedBbox.height + 24}
                text={selectedDimensions.width}
                fill="#cbd5e1"
                fontSize={11}
                width={60}
                align="center"
              />
              <Line
                points={[
                  selectedBbox.x - 20,
                  selectedBbox.y,
                  selectedBbox.x - 20,
                  selectedBbox.y + selectedBbox.height,
                ]}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <Text
                x={selectedBbox.x - 54}
                y={selectedBbox.y + selectedBbox.height / 2 - 6}
                text={selectedDimensions.height}
                fill="#cbd5e1"
                fontSize={11}
                width={34}
                align="right"
              />
            </Group>
          )}

          <Group x={viewBox.x + 20} y={viewBox.y + viewBox.height - 40} listening={false}>
            <Rect x={0} y={0} width={140} height={28} cornerRadius={14} fill="rgba(39,39,42,0.9)" stroke="#52525b" strokeWidth={1} />
            <Text
              x={0}
              y={8}
              width={140}
              align="center"
              text={`${allLedCount} LEDs Placed`}
              fill="#e4e4e7"
              fontSize={12}
              fontStyle="600"
            />
          </Group>

        </Layer>
      </Stage>
    </div>
  );
};
