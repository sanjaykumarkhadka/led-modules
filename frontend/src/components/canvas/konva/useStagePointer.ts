import { useCallback } from 'react';
import type Konva from 'konva';
import { toWorldPoint } from './viewport';
import type { EditorViewportTransform } from './types';

export function useStagePointer(transform: EditorViewportTransform) {
  return useCallback(
    (stage: Konva.Stage | null) => {
      if (!stage) return null;
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;
      return toWorldPoint(pointer, transform);
    },
    [transform]
  );
}

