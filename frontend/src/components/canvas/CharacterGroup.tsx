import React, { useRef, useEffect, useCallback } from 'react';
import type { CharacterPath } from '../../core/math/characterPaths';

interface CharacterGroupProps {
  charPath: CharacterPath;
  blockId: string;
  isSelected: boolean;
  onSelect: (charId: string, position: { x: number; y: number }) => void;
  pathRef?: (el: SVGPathElement | null, charId: string) => void;
}

export const CharacterGroup: React.FC<CharacterGroupProps> = ({
  charPath,
  blockId,
  isSelected,
  onSelect,
  pathRef,
}) => {
  const pathElementRef = useRef<SVGPathElement>(null);
  const charId = `${blockId}-${charPath.charIndex}`;

  // Register path ref for LED placement
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

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (!charPath.pathData) return; // Skip spaces

      // Get click position for panel placement
      const svg = (e.target as SVGElement).closest('svg');
      if (svg) {
        // Calculate center of character in SVG coordinates
        const bbox = pathElementRef.current?.getBBox();
        if (bbox) {
          onSelect(charId, {
            x: bbox.x + bbox.width / 2,
            y: bbox.y,
          });
        } else {
          onSelect(charId, {
            x: charPath.x + charPath.width / 2,
            y: 0,
          });
        }
      } else {
        onSelect(charId, {
          x: charPath.x + charPath.width / 2,
          y: 0,
        });
      }
    },
    [charId, charPath, onSelect]
  );

  // Skip rendering for spaces
  if (!charPath.pathData) {
    return null;
  }

  return (
    <g onClick={handleClick} className="cursor-pointer" style={{ pointerEvents: 'all' }}>
      {/* Selection highlight - rendered behind the letter */}
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

      {/* Main letter fill: monochrome black/white */}
      <path
        ref={pathElementRef}
        d={charPath.pathData}
        fill="#ffffff"
        stroke={isSelected ? '#111827' : '#334155'}
        strokeWidth={isSelected ? 3 : 2}
        filter="url(#letterShadow)"
        className="transition-all duration-150"
      />

      {/* Highlight overlay */}
      <path
        d={charPath.pathData}
        fill="none"
        stroke="rgba(15,23,42,0.2)"
        strokeWidth="1"
        style={{ pointerEvents: 'none' }}
      />

      {/* Hover highlight */}
      <path
        d={charPath.pathData}
        fill="rgba(15, 23, 42, 0)"
        stroke="transparent"
        strokeWidth="4"
        className="hover:fill-[rgba(15,23,42,0.05)] transition-all duration-150"
      />
    </g>
  );
};
