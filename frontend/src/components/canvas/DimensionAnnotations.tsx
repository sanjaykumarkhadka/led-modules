import React from 'react';
import {
  calculateLetterDimensions,
  formatDimension,
  getDimensionValue,
  type BoundingBox,
} from '../../core/math/dimensions';

interface DimensionAnnotationsProps {
  bbox: BoundingBox;
  unit: 'mm' | 'in';
  pixelsPerInch?: number;
}

const ANNOTATION_OFFSET = 20; // Distance from letter edge
const ARROW_SIZE = 6;
const FONT_SIZE = 11;
const STROKE_COLOR = '#94a3b8'; // slate-400
const TEXT_COLOR = '#cbd5e1'; // slate-300

export const DimensionAnnotations: React.FC<DimensionAnnotationsProps> = ({
  bbox,
  unit,
  pixelsPerInch = 12.5,
}) => {
  const dimensions = calculateLetterDimensions(bbox, pixelsPerInch);

  const widthValue = getDimensionValue(dimensions, 'width', unit);
  const heightValue = getDimensionValue(dimensions, 'height', unit);

  const widthLabel = formatDimension(widthValue, unit);
  const heightLabel = formatDimension(heightValue, unit);

  // Position calculations
  const leftEdge = bbox.x - ANNOTATION_OFFSET;
  const bottomEdge = bbox.y + bbox.height + ANNOTATION_OFFSET;
  const topY = bbox.y;
  const bottomY = bbox.y + bbox.height;
  const leftX = bbox.x;
  const rightX = bbox.x + bbox.width;

  return (
    <g className="dimension-annotations">
      {/* Arrow marker definitions */}
      <defs>
        <marker
          id="arrowStart"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE / 2}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M ${ARROW_SIZE} 0 L 0 ${ARROW_SIZE / 2} L ${ARROW_SIZE} ${ARROW_SIZE}`}
            fill="none"
            stroke={STROKE_COLOR}
            strokeWidth="1"
          />
        </marker>
        <marker
          id="arrowEnd"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE / 2}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE}`}
            fill="none"
            stroke={STROKE_COLOR}
            strokeWidth="1"
          />
        </marker>
      </defs>

      {/* Height dimension (left side) */}
      <g className="height-dimension">
        {/* Extension lines */}
        <line
          x1={leftX}
          y1={topY}
          x2={leftEdge - 5}
          y2={topY}
          stroke={STROKE_COLOR}
          strokeWidth="0.5"
          opacity="0.5"
        />
        <line
          x1={leftX}
          y1={bottomY}
          x2={leftEdge - 5}
          y2={bottomY}
          stroke={STROKE_COLOR}
          strokeWidth="0.5"
          opacity="0.5"
        />

        {/* Dimension line with arrows */}
        <line
          x1={leftEdge}
          y1={topY}
          x2={leftEdge}
          y2={bottomY}
          stroke={STROKE_COLOR}
          strokeWidth="1"
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />

        {/* Height label */}
        <text
          x={leftEdge - 5}
          y={(topY + bottomY) / 2}
          fill={TEXT_COLOR}
          fontSize={FONT_SIZE}
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          textAnchor="end"
          dominantBaseline="middle"
          transform={`rotate(-90, ${leftEdge - 5}, ${(topY + bottomY) / 2})`}
        >
          {heightLabel}
        </text>
      </g>

      {/* Width dimension (bottom) */}
      <g className="width-dimension">
        {/* Extension lines */}
        <line
          x1={leftX}
          y1={bottomY}
          x2={leftX}
          y2={bottomEdge + 5}
          stroke={STROKE_COLOR}
          strokeWidth="0.5"
          opacity="0.5"
        />
        <line
          x1={rightX}
          y1={bottomY}
          x2={rightX}
          y2={bottomEdge + 5}
          stroke={STROKE_COLOR}
          strokeWidth="0.5"
          opacity="0.5"
        />

        {/* Dimension line with arrows */}
        <line
          x1={leftX}
          y1={bottomEdge}
          x2={rightX}
          y2={bottomEdge}
          stroke={STROKE_COLOR}
          strokeWidth="1"
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />

        {/* Width label */}
        <text
          x={(leftX + rightX) / 2}
          y={bottomEdge + 15}
          fill={TEXT_COLOR}
          fontSize={FONT_SIZE}
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {widthLabel}
        </text>
      </g>
    </g>
  );
};
