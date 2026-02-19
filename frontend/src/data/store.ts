import { create } from 'zustand';
import { MODULE_CATALOG, type LEDModule } from './catalog/modules';
import { PSU_CATALOG, type PowerSupply } from './catalog/powerSupplies';
import type { LEDPosition } from '../core/math/placement';
import type { CharacterPath } from '../core/math/characterPaths';
import type { CharacterShapeOverride } from '../core/math/shapeWarp';

export interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number; // Represents height in relative units
  language: string; // Per-block language for font selection
}

export interface CharacterEntity {
  id: string;
  glyph: string;
  x: number;
  baselineY: number;
  fontSize: number;
  language: string;
  order: number;
}

export interface BlockCharPaths {
  blockId: string;
  charPaths: CharacterPath[];
}

export interface CharLEDData {
  charId: string;
  leds: LEDPosition[];
}

export interface ManualLED {
  id: string;
  u: number;
  v: number;
  x?: number;
  y?: number;
  rotation: number;
  /** Uniform scale; base size is 12×5. Default 1. Keeps module shape fixed. */
  scale?: number;
}

export interface ComputedLayoutData {
  blockCharPaths: BlockCharPaths[];
  charLeds: CharLEDData[];
}

const CHAR_SPACING_RATIO = 0.76;
const MIN_CHARACTER_FONT_SIZE = 96;
const MAX_CHARACTER_FONT_SIZE = 240;

function clampCharacterFontSize(value: number) {
  if (!Number.isFinite(value)) return MIN_CHARACTER_FONT_SIZE;
  return Math.min(MAX_CHARACTER_FONT_SIZE, Math.max(MIN_CHARACTER_FONT_SIZE, value));
}

function createId(prefix = 'char') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByOrder(chars: CharacterEntity[]) {
  return [...chars].sort((a, b) => a.order - b.order);
}

function deriveTextFromCharacters(chars: CharacterEntity[]) {
  return sortByOrder(chars)
    .map((ch) => ch.glyph)
    .join('');
}

function createCharactersFromBlock(block: TextBlock, oldCharacters: CharacterEntity[] = []): CharacterEntity[] {
  const oldSorted = sortByOrder(oldCharacters);
  const glyphs = Array.from(block.text || '');
  const step = Math.max(1, block.fontSize * CHAR_SPACING_RATIO);

  return glyphs.map((glyph, index) => {
    const existing = oldSorted[index];
    return {
      id: existing?.id ?? createId(block.id),
      glyph,
      x: existing?.x ?? block.x + index * step,
      baselineY: existing?.baselineY ?? block.y,
      fontSize: clampCharacterFontSize(existing?.fontSize ?? block.fontSize),
      language: existing?.language ?? block.language,
      order: index,
    };
  });
}

interface ProjectState {
  // Configuration
  blocks: TextBlock[];
  depthInches: number;
  selectedModuleId: string;

  // Character entities (source of truth)
  charactersByBlock: Record<string, CharacterEntity[]>;

  // UI State
  selectedBlockId: string | null;
  editorCharId: string | null;
  populateVersion: number; // Increment to trigger calculation
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';

  // Per-character LED selection state
  selectedCharId: string | null;
  ledCountOverrides: Record<string, number>;
  defaultLedCount: number;
  ledColumnOverrides: Record<string, number>;
  defaultLedColumns: number;
  ledOrientationOverrides: Record<string, 'horizontal' | 'vertical' | 'auto'>;
  defaultLedOrientation: 'horizontal' | 'vertical' | 'auto';
  placementModeOverrides: Record<string, 'auto' | 'manual'>;
  defaultPlacementMode: 'auto' | 'manual';
  manualLedOverrides: Record<string, ManualLED[]>;
  charShapeOverrides: Record<string, CharacterShapeOverride>;

  // Engineering Data (Calculated)
  totalModules: number;
  totalPowerWatts: number;
  recommendedPSU: PowerSupply | null;

  // Computed layout data for PDF export
  computedLayoutData: ComputedLayoutData | null;

  // Actions
  addBlock: () => void;
  updateBlock: (id: string, updates: Partial<TextBlock>) => void;
  removeBlock: (id: string) => void;
  selectBlock: (id: string | null) => void;
  triggerPopulation: () => void;

  setDepth: (depth: number) => void;
  setModule: (moduleId: string) => void;
  updateEngineeringData: (count: number) => void;

  // Character entity actions
  initCharactersForBlock: (blockId: string) => void;
  addCharacter: (blockId: string, glyph: string) => string | null;
  removeCharacter: (blockId: string, charId: string) => void;
  updateCharacter: (charId: string, updates: Partial<Omit<CharacterEntity, 'id'>>) => void;
  reorderCharacters: (blockId: string, orderedIds: string[]) => void;
  getCharacter: (charId: string) => CharacterEntity | null;

  // Dimension actions
  toggleDimensions: () => void;
  setDimensionUnit: (unit: 'mm' | 'in') => void;
  openEditor: (charId: string) => void;
  closeEditor: () => void;

  // Character LED selection actions
  selectChar: (charId: string | null) => void;
  setCharLedCount: (charId: string, count: number) => void;
  resetCharLedCount: (charId: string) => void;
  setDefaultLedCount: (count: number) => void;
  getCharLedCount: (charId: string) => number;

  // Column count actions
  setCharLedColumns: (charId: string, columns: number) => void;
  resetCharLedColumns: (charId: string) => void;
  getCharLedColumns: (charId: string) => number;

  // Orientation actions
  setCharLedOrientation: (
    charId: string,
    orientation: 'horizontal' | 'vertical' | 'auto'
  ) => void;
  resetCharLedOrientation: (charId: string) => void;
  getCharLedOrientation: (charId: string) => 'horizontal' | 'vertical' | 'auto';

  // Placement mode actions
  setCharPlacementMode: (charId: string, mode: 'auto' | 'manual') => void;
  resetCharPlacementMode: (charId: string) => void;
  getCharPlacementMode: (charId: string) => 'auto' | 'manual';

  // Manual LED actions
  setCharManualLeds: (charId: string, leds: ManualLED[]) => void;
  addCharManualLed: (charId: string, led: ManualLED) => void;
  updateCharManualLed: (charId: string, ledId: string, updates: Partial<ManualLED>) => void;
  removeCharManualLed: (charId: string, ledId: string) => void;
  clearCharManualLeds: (charId: string) => void;
  getCharManualLeds: (charId: string) => ManualLED[];
  setCharShapeOverride: (charId: string, shape: CharacterShapeOverride) => void;
  clearCharShapeOverride: (charId: string) => void;
  getCharShapeOverride: (charId: string) => CharacterShapeOverride | null;

  // Layout data action
  setComputedLayoutData: (data: ComputedLayoutData | null) => void;

  // Selectors
  getCurrentModule: () => LEDModule;
}

const initialBlock: TextBlock = {
  id: '1',
  text: '',
  x: 50,
  y: 200,
  fontSize: 150,
  language: 'en',
};

const initialCharactersByBlock: Record<string, CharacterEntity[]> = {
  [initialBlock.id]: createCharactersFromBlock(initialBlock),
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  blocks: [initialBlock],
  depthInches: 5.0,
  selectedModuleId: 'tetra-max-medium-24v',
  charactersByBlock: initialCharactersByBlock,
  selectedBlockId: initialBlock.id,
  editorCharId: null,
  populateVersion: 0,
  showDimensions: true,
  dimensionUnit: 'mm',

  selectedCharId: null,
  ledCountOverrides: {},
  defaultLedCount: 15,
  ledColumnOverrides: {},
  defaultLedColumns: 1,
  ledOrientationOverrides: {},
  defaultLedOrientation: 'auto',
  placementModeOverrides: {},
  defaultPlacementMode: 'manual',
  manualLedOverrides: {},
  charShapeOverrides: {},

  totalModules: 0,
  totalPowerWatts: 0,
  recommendedPSU: null,
  computedLayoutData: null,

  triggerPopulation: () => set((state) => ({ populateVersion: state.populateVersion + 1 })),

  addBlock: () =>
    set((state) => {
      const newId = Math.random().toString(36).slice(2, 9);
      const lastBlock = state.blocks[state.blocks.length - 1];
      const newY = lastBlock ? lastBlock.y + lastBlock.fontSize + 20 : 200;
      const block: TextBlock = {
        id: newId,
        text: '',
        x: 50,
        y: newY,
        fontSize: 150,
        language: 'en',
      };

      return {
        blocks: [...state.blocks, block],
        charactersByBlock: {
          ...state.charactersByBlock,
          [newId]: createCharactersFromBlock(block),
        },
        selectedBlockId: newId,
      };
    }),

  updateBlock: (id, updates) =>
    set((state) => {
      const currentBlock = state.blocks.find((block) => block.id === id);
      if (!currentBlock) return {};
      const nextBlocks = state.blocks.map((block) => (block.id === id ? { ...block, ...updates } : block));
      const updatedBlock = nextBlocks.find((block) => block.id === id);
      if (!updatedBlock) return { blocks: nextBlocks };

      const existingChars = state.charactersByBlock[id] ?? [];
      let nextChars = existingChars;

      if (typeof updates.text === 'string') {
        nextChars = createCharactersFromBlock(updatedBlock, existingChars);
      } else if (
        updates.fontSize != null ||
        updates.x != null ||
        updates.y != null ||
        updates.language != null
      ) {
        const xDelta = updates.x != null ? updates.x - currentBlock.x : 0;
        const yDelta = updates.y != null ? updates.y - currentBlock.y : 0;
        nextChars = existingChars.map((char) => ({
          ...char,
          x: char.x + xDelta,
          baselineY: char.baselineY + yDelta,
          fontSize: updates.fontSize ?? char.fontSize,
          language: updates.language ?? char.language,
        }));
      }

      return {
        blocks: nextBlocks,
        charactersByBlock: {
          ...state.charactersByBlock,
          [id]: nextChars,
        },
      };
    }),

  removeBlock: (id) =>
    set((state) => {
      const { [id]: _removedChars, ...restChars } = state.charactersByBlock;
      void _removedChars;
      return {
        blocks: state.blocks.filter((b) => b.id !== id),
        charactersByBlock: restChars,
        selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      };
    }),

  selectBlock: (id) => set({ selectedBlockId: id }),

  setDepth: (depthInches) => set({ depthInches }),
  setModule: (selectedModuleId) => set({ selectedModuleId }),

  initCharactersForBlock: (blockId) =>
    set((state) => {
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block) return {};
      const current = state.charactersByBlock[blockId];
      if (current && current.length > 0) return {};
      return {
        charactersByBlock: {
          ...state.charactersByBlock,
          [blockId]: createCharactersFromBlock(block),
        },
      };
    }),

  addCharacter: (blockId, glyph) => {
    const normalized = Array.from(glyph.trim())[0];
    if (!normalized) return null;

    let createdId: string | null = null;
    set((state) => {
      const block = state.blocks.find((b) => b.id === blockId);
      if (!block) return {};
      const current = sortByOrder(state.charactersByBlock[blockId] ?? []);
      const last = current[current.length - 1];
      const nextOrder = current.length;
      const nextFontSize = clampCharacterFontSize(last?.fontSize ?? block.fontSize);
      const nextX = last ? last.x + clampCharacterFontSize(last.fontSize) * CHAR_SPACING_RATIO : block.x;
      const nextY = last?.baselineY ?? block.y;
      const id = createId(blockId);
      createdId = id;
      const nextChars = [
        ...current,
        {
          id,
          glyph: normalized,
          x: nextX,
          baselineY: nextY,
          fontSize: nextFontSize,
          language: block.language,
          order: nextOrder,
        },
      ];

      return {
        charactersByBlock: {
          ...state.charactersByBlock,
          [blockId]: nextChars,
        },
        blocks: state.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                text: deriveTextFromCharacters(nextChars),
              }
            : b
        ),
      };
    });
    return createdId;
  },

  removeCharacter: (blockId, charId) =>
    set((state) => {
      const current = sortByOrder(state.charactersByBlock[blockId] ?? []);
      const nextChars = current
        .filter((char) => char.id !== charId)
        .map((char, index) => ({ ...char, order: index }));

      const { [charId]: _removedShape, ...restShapes } = state.charShapeOverrides ?? {};
      void _removedShape;
      return {
        charactersByBlock: {
          ...state.charactersByBlock,
          [blockId]: nextChars,
        },
        selectedCharId: state.selectedCharId === charId ? null : state.selectedCharId,
        charShapeOverrides: restShapes,
        blocks: state.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                text: deriveTextFromCharacters(nextChars),
              }
            : b
        ),
      };
    }),

  updateCharacter: (charId, updates) =>
    set((state) => {
      const nextCharactersByBlock: Record<string, CharacterEntity[]> = {};
      let changedBlockId: string | null = null;

      Object.entries(state.charactersByBlock).forEach(([blockId, chars]) => {
        let changed = false;
        const nextChars = chars.map((char) => {
          if (char.id !== charId) return char;
          changed = true;
          return {
            ...char,
            ...updates,
            ...(updates.fontSize != null
              ? { fontSize: clampCharacterFontSize(updates.fontSize) }
              : {}),
          };
        });
        if (changed) changedBlockId = blockId;
        nextCharactersByBlock[blockId] = nextChars;
      });

      if (!changedBlockId) return {};

      return {
        charactersByBlock: nextCharactersByBlock,
        blocks: state.blocks.map((b) =>
          b.id === changedBlockId
            ? {
                ...b,
                text: deriveTextFromCharacters(nextCharactersByBlock[changedBlockId] ?? []),
              }
            : b
        ),
      };
    }),

  reorderCharacters: (blockId, orderedIds) =>
    set((state) => {
      const current = state.charactersByBlock[blockId] ?? [];
      if (current.length === 0) return {};
      const byId = new Map(current.map((char) => [char.id, char]));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((char): char is CharacterEntity => Boolean(char));
      const leftovers = current.filter((char) => !orderedIds.includes(char.id));
      const nextChars = [...ordered, ...leftovers].map((char, index) => ({ ...char, order: index }));

      return {
        charactersByBlock: {
          ...state.charactersByBlock,
          [blockId]: nextChars,
        },
        blocks: state.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                text: deriveTextFromCharacters(nextChars),
              }
            : b
        ),
      };
    }),

  getCharacter: (charId) => {
    const allBlocks = Object.values(get().charactersByBlock);
    for (const chars of allBlocks) {
      const found = chars.find((char) => char.id === charId);
      if (found) return found;
    }
    return null;
  },

  toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
  setDimensionUnit: (dimensionUnit) => set({ dimensionUnit }),
  openEditor: (charId) => set({ editorCharId: charId }),
  closeEditor: () => set({ editorCharId: null }),

  selectChar: (charId) => set({ selectedCharId: charId }),

  setCharLedCount: (charId, count) =>
    set((state) => ({
      ledCountOverrides: { ...(state.ledCountOverrides ?? {}), [charId]: count },
    })),

  resetCharLedCount: (charId) =>
    set((state) => {
      const source = state.ledCountOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { ledCountOverrides: rest };
    }),

  setDefaultLedCount: (count) => set({ defaultLedCount: count }),

  getCharLedCount: (charId) => {
    const state = get();
    return state.ledCountOverrides?.[charId] ?? state.defaultLedCount;
  },

  setCharLedColumns: (charId, columns) =>
    set((state) => ({
      ledColumnOverrides: { ...(state.ledColumnOverrides ?? {}), [charId]: columns },
    })),

  resetCharLedColumns: (charId) =>
    set((state) => {
      const source = state.ledColumnOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { ledColumnOverrides: rest };
    }),

  getCharLedColumns: (charId) => {
    const state = get();
    return state.ledColumnOverrides?.[charId] ?? state.defaultLedColumns;
  },

  setCharLedOrientation: (charId, orientation) =>
    set((state) => ({
      ledOrientationOverrides: {
        ...(state.ledOrientationOverrides ?? {}),
        [charId]: orientation,
      },
    })),

  resetCharLedOrientation: (charId) =>
    set((state) => {
      const source = state.ledOrientationOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { ledOrientationOverrides: rest };
    }),

  getCharLedOrientation: (charId) => {
    const state = get();
    return state.ledOrientationOverrides?.[charId] ?? state.defaultLedOrientation;
  },

  setCharPlacementMode: (charId, mode) =>
    set((state) => ({
      placementModeOverrides: { ...(state.placementModeOverrides ?? {}), [charId]: mode },
    })),

  resetCharPlacementMode: (charId) =>
    set((state) => {
      const source = state.placementModeOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { placementModeOverrides: rest };
    }),

  getCharPlacementMode: (charId) => {
    const state = get();
    return state.placementModeOverrides?.[charId] ?? state.defaultPlacementMode;
  },

  setCharManualLeds: (charId, leds) =>
    set((state) => ({
      manualLedOverrides: { ...(state.manualLedOverrides ?? {}), [charId]: leds },
    })),

  addCharManualLed: (charId, led) =>
    set((state) => ({
      manualLedOverrides: {
        ...(state.manualLedOverrides ?? {}),
        [charId]: [...(state.manualLedOverrides?.[charId] || []), led],
      },
    })),

  updateCharManualLed: (charId, ledId, updates) =>
    set((state) => ({
      manualLedOverrides: {
        ...(state.manualLedOverrides ?? {}),
        [charId]: (state.manualLedOverrides?.[charId] || []).map((led) =>
          led.id === ledId ? { ...led, ...updates } : led
        ),
      },
    })),

  removeCharManualLed: (charId, ledId) =>
    set((state) => ({
      manualLedOverrides: {
        ...(state.manualLedOverrides ?? {}),
        [charId]: (state.manualLedOverrides?.[charId] || []).filter((led) => led.id !== ledId),
      },
    })),

  clearCharManualLeds: (charId) =>
    set((state) => {
      const source = state.manualLedOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { manualLedOverrides: rest };
    }),

  getCharManualLeds: (charId) => {
    const state = get();
    return state.manualLedOverrides?.[charId] || [];
  },

  setCharShapeOverride: (charId, shape) =>
    set((state) => ({
      charShapeOverrides: {
        ...(state.charShapeOverrides ?? {}),
        [charId]: shape,
      },
    })),

  clearCharShapeOverride: (charId) =>
    set((state) => {
      const source = state.charShapeOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed;
      return { charShapeOverrides: rest };
    }),

  getCharShapeOverride: (charId) => {
    const state = get();
    return state.charShapeOverrides?.[charId] ?? null;
  },

  setComputedLayoutData: (data) => set({ computedLayoutData: data }),

  getCurrentModule: () => {
    const id = get().selectedModuleId;
    return MODULE_CATALOG.find((m) => m.id === id) || MODULE_CATALOG[0];
  },

  updateEngineeringData: (count: number) => {
    const module = get().getCurrentModule();
    const totalPower = count * module.wattsPerModule;
    const safeLoad = totalPower * 1.2;
    const psu = PSU_CATALOG.find((p) => p.maxWatts >= safeLoad) || null;

    set({
      totalModules: count,
      totalPowerWatts: totalPower,
      recommendedPSU: psu,
    });
  },
}));
