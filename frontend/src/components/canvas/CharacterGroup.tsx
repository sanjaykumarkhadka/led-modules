import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { CharacterPath } from '../../core/math/characterPaths';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface CharacterGroupProps {
  charPath: CharacterPath;
  charId: string;
  isSelected: boolean;
  onSelect: (charId: string, position: { x: number; y: number }) => void;
  onDragStart?: (event: React.PointerEvent<SVGGElement>, charId: string) => void;
  onResizeStart?: (
    event: React.PointerEvent<SVGRectElement>,
    charId: string,
    handle: ResizeHandle
  ) => void;
  pathRef?: (el: SVGPathElement | null, charId: string) => void;
}

export const CharacterGroup: React.FC<CharacterGroupProps> = ({
  charPath,
  charId,
  isSelected,
  onSelect,
  onDragStart,
  onResizeStart,
  pathRef,
}) => {
  const pathElementRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (pathRef && pathElementRef.current) {
      pathRef(pathElementRef.current, charId);
    }
    return () => {
      if (pathRef) {
        pathRef(null, charId);
      }
    };
  }, [pathRef, charId]);

  const bbox = useMemo(() => {
    if (charPath.bbox) return charPath.bbox;
    return {
      x: charPath.x,
      y: 0,
      width: Math.max(12, charPath.width || 12),
      height: 24,
    };
  }, [charPath]);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (!charPath.pathData) return;
      onSelect(charId, {
        x: bbox.x + bbox.width / 2,
        y: bbox.y,
      });
    },
    [bbox.x, bbox.y, bbox.width, charId, charPath.pathData, onSelect]
  );

  if (!charPath.pathData) {
    return null;
  }

  return (
    <g
      onClick={handleClick}
      onPointerDown={(event) => {
        if (!isSelected || !onDragStart) return;
        onDragStart(event, charId);
      }}
      className={isSelected ? 'cursor-move' : 'cursor-pointer'}
      style={{ pointerEvents: 'all' }}
      role="button"
      aria-label={`Character ${charPath.char}`}
    >
      {isSelected && (
        <path
          d={charPath.pathData}
          fill="none"
          stroke="#111827"
          strokeWidth="6"
          strokeDasharray="8 4"
          opacity={0.55}
          style={{ pointerEvents: 'none' }}
        />
      )}

      <path
        ref={pathElementRef}
        d={charPath.pathData}
        fill="#ffffff"
        stroke={isSelected ? '#111827' : '#334155'}
        strokeWidth={isSelected ? 3 : 2}
        filter="url(#letterShadow)"
        className="transition-all duration-150"
      />

      <path
        d={charPath.pathData}
        fill="none"
        stroke="rgba(15,23,42,0.2)"
        strokeWidth="1"
        style={{ pointerEvents: 'none' }}
      />

      <path
        d={charPath.pathData}
        fill="rgba(15, 23, 42, 0)"
        stroke="transparent"
        strokeWidth="4"
        className="hover:fill-[rgba(15,23,42,0.05)] transition-all duration-150"
      />

      {isSelected && onResizeStart && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
            const x = handle === 'nw' || handle === 'sw' ? bbox.x - 4 : bbox.x + bbox.width - 4;
            const y = handle === 'nw' || handle === 'ne' ? bbox.y - 4 : bbox.y + bbox.height - 4;
            return (
              <rect
                key={handle}
                x={x}
                y={y}
                width={8}
                height={8}
                rx={2}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={1.5}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onResizeStart(event, charId, handle);
                }}
              />
            );
          })}
        </>
      )}
    </g>
  );
};
