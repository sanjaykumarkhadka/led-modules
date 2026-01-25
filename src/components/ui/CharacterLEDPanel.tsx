import React, { useState, useEffect, useCallback } from 'react';

interface CharacterLEDPanelProps {
  charId: string;
  char: string;
  currentCount: number;
  currentColumns: number;
  currentOrientation: 'horizontal' | 'vertical';
  position: { x: number; y: number };
  onApply: (charId: string, count: number) => void;
  onApplyColumns: (charId: string, columns: number) => void;
  onApplyOrientation: (charId: string, orientation: 'horizontal' | 'vertical') => void;
  onCancel: () => void;
  onReset: (charId: string) => void;
}

export const CharacterLEDPanel: React.FC<CharacterLEDPanelProps> = ({
  charId,
  char,
  currentCount,
  currentColumns,
  currentOrientation,
  position,
  onApply,
  onApplyColumns,
  onApplyOrientation,
  onCancel,
  onReset,
}) => {
  const [count, setCount] = useState(currentCount);
  const [columns, setColumns] = useState(currentColumns);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(currentOrientation);

  // Reset local state when character changes - intentional synchronization
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setCount(currentCount);
    setColumns(currentColumns);
    setOrientation(currentOrientation);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [currentCount, currentColumns, currentOrientation, charId]);

  const handleIncrement = useCallback(() => {
    setCount((c) => Math.min(c + 1, 50));
  }, []);

  const handleDecrement = useCallback(() => {
    setCount((c) => Math.max(c - 1, 1));
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 50) {
      setCount(value);
    }
  }, []);

  const handleApply = useCallback(() => {
    onApply(charId, count);
  }, [charId, count, onApply]);

  const handleColumnChange = useCallback(
    (newColumns: number) => {
      setColumns(newColumns);
      onApplyColumns(charId, newColumns);
    },
    [charId, onApplyColumns]
  );

  const handleOrientationChange = useCallback(
    (newOrientation: 'horizontal' | 'vertical') => {
      setOrientation(newOrientation);
      onApplyOrientation(charId, newOrientation);
    },
    [charId, onApplyOrientation]
  );

  const handleReset = useCallback(() => {
    onReset(charId);
  }, [charId, onReset]);

  // Position the panel above the character, with boundary checking
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.max(10, Math.min(position.x - 80, 640))}px`,
    top: `${Math.max(10, position.y - 140)}px`,
    zIndex: 1000,
  };

  return (
    <div
      style={panelStyle}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[160px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with character display */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-600">
        <span className="text-slate-400 text-sm">Character:</span>
        <span className="text-white text-xl font-bold bg-slate-700 px-3 py-1 rounded">{char}</span>
      </div>

      {/* LED Count controls */}
      <div className="mb-3">
        <label className="text-slate-400 text-xs block mb-1">LED Modules</label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            className="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-lg font-bold transition-colors"
            disabled={count <= 1}
          >
            -
          </button>
          <input
            type="number"
            value={count}
            onChange={handleInputChange}
            min={1}
            max={50}
            className="w-14 h-8 text-center bg-slate-700 text-white border border-slate-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleIncrement}
            className="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-lg font-bold transition-colors"
            disabled={count >= 50}
          >
            +
          </button>
        </div>
      </div>

      {/* LED Column controls */}
      <div className="mb-3">
        <label className="text-slate-400 text-xs block mb-1">LED Columns</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => handleColumnChange(n)}
              className={`flex-1 px-2 py-1.5 text-sm rounded transition-colors ${
                columns === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* LED Orientation controls */}
      <div className="mb-3">
        <label className="text-slate-400 text-xs block mb-1">LED Orientation</label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOrientationChange('horizontal')}
            className={`flex-1 px-2 py-1.5 text-sm rounded transition-colors ${
              orientation === 'horizontal'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            Horizontal
          </button>
          <button
            onClick={() => handleOrientationChange('vertical')}
            className={`flex-1 px-2 py-1.5 text-sm rounded transition-colors ${
              orientation === 'vertical'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            Vertical
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
          title="Reset to default"
        >
          Reset
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
