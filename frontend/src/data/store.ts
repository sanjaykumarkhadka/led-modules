import { create } from 'zustand';
import { MODULE_CATALOG, type LEDModule } from './catalog/modules';
import { PSU_CATALOG, type PowerSupply } from './catalog/powerSupplies';
import type { LEDPosition } from '../core/math/placement';
import type { CharacterPath } from '../core/math/characterPaths';

export interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number; // Represents height in relative units
  language: string; // Per-block language for font selection
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
  rotation: number;
  /** Uniform scale; base size is 12×5. Default 1. Keeps module shape fixed. */
  scale?: number;
}

export interface ComputedLayoutData {
  blockCharPaths: BlockCharPaths[];
  charLeds: CharLEDData[];
}

interface ProjectState {
  // Configuration
  blocks: TextBlock[];
  depthInches: number;
  selectedModuleId: string;

  // UI State
  selectedBlockId: string | null;
  editorCharId: string | null;
  populateVersion: number; // Increment to trigger calculation
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';

  // Per-character LED selection state
  selectedCharId: string | null; // Format: "blockId-charIndex"
  ledCountOverrides: Record<string, number>; // Per-character LED counts
  defaultLedCount: number; // Default LED count per character
  ledColumnOverrides: Record<string, number>; // Per-character column counts (1-5)
  defaultLedColumns: number; // Default column count for new characters
  ledOrientationOverrides: Record<string, 'horizontal' | 'vertical' | 'auto'>; // Per-character orientation
  defaultLedOrientation: 'horizontal' | 'vertical' | 'auto'; // Default LED orientation
  placementModeOverrides: Record<string, 'auto' | 'manual'>; // Per-character placement mode
  defaultPlacementMode: 'auto' | 'manual'; // Default placement mode
  manualLedOverrides: Record<string, ManualLED[]>; // Per-character manual LEDs (normalized)

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
  triggerPopulation: () => void; // New action

  setDepth: (depth: number) => void;
  setModule: (moduleId: string) => void;
  updateEngineeringData: (count: number) => void;

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

  // Layout data action
  setComputedLayoutData: (data: ComputedLayoutData | null) => void;

  // Selectors
  getCurrentModule: () => LEDModule;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  blocks: [{ id: '1', text: 'HELLO', x: 50, y: 200, fontSize: 150, language: 'en' }],
  depthInches: 5.0,
  selectedModuleId: 'tetra-max-medium-24v',
  selectedBlockId: '1',
  editorCharId: null,
  populateVersion: 0,
  showDimensions: true,
  dimensionUnit: 'mm',

  // Per-character LED selection state
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

  totalModules: 0,
  totalPowerWatts: 0,
  recommendedPSU: null,
  computedLayoutData: null,

  triggerPopulation: () => set((state) => ({ populateVersion: state.populateVersion + 1 })),

  addBlock: () =>
    set((state) => {
      const newId = Math.random().toString(36).substr(2, 9);
      const lastBlock = state.blocks[state.blocks.length - 1];
      const newY = lastBlock ? lastBlock.y + lastBlock.fontSize + 20 : 200;

      return {
        blocks: [
          ...state.blocks,
          { id: newId, text: 'NEW TEXT', x: 50, y: newY, fontSize: 150, language: 'en' },
        ],
        selectedBlockId: newId,
      };
    }),

  updateBlock: (id, updates) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  removeBlock: (id) =>
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== id),
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
    })),

  selectBlock: (id) => set({ selectedBlockId: id }),

  setDepth: (depthInches) => set({ depthInches }),
  setModule: (selectedModuleId) => set({ selectedModuleId }),

  toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
  setDimensionUnit: (dimensionUnit) => set({ dimensionUnit }),
  openEditor: (charId) => set({ editorCharId: charId }),
  closeEditor: () => set({ editorCharId: null }),

  // Character LED selection actions
  selectChar: (charId) => set({ selectedCharId: charId }),

  setCharLedCount: (charId, count) =>
    set((state) => ({
      ledCountOverrides: { ...(state.ledCountOverrides ?? {}), [charId]: count },
    })),

  resetCharLedCount: (charId) =>
    set((state) => {
      const source = state.ledCountOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed; // Intentionally unused - we're removing this key
      return { ledCountOverrides: rest };
    }),

  setDefaultLedCount: (count) => set({ defaultLedCount: count }),

  getCharLedCount: (charId) => {
    const state = get();
    return state.ledCountOverrides?.[charId] ?? state.defaultLedCount;
  },

  // Column count actions
  setCharLedColumns: (charId, columns) =>
    set((state) => ({
      ledColumnOverrides: { ...(state.ledColumnOverrides ?? {}), [charId]: columns },
    })),

  resetCharLedColumns: (charId) =>
    set((state) => {
      const source = state.ledColumnOverrides ?? {};
      const { [charId]: _removed, ...rest } = source;
      void _removed; // Intentionally unused - we're removing this key
      return { ledColumnOverrides: rest };
    }),

  getCharLedColumns: (charId) => {
    const state = get();
    return state.ledColumnOverrides?.[charId] ?? state.defaultLedColumns;
  },

  // Orientation actions
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
      void _removed; // Intentionally unused - we're removing this key
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

  setComputedLayoutData: (data) => set({ computedLayoutData: data }),

  getCurrentModule: () => {
    const id = get().selectedModuleId;
    return MODULE_CATALOG.find((m) => m.id === id) || MODULE_CATALOG[0];
  },

  updateEngineeringData: (count: number) => {
    const module = get().getCurrentModule();
    const totalPower = count * module.wattsPerModule;

    // Find best PSU (Simple logic: first one that fits with 20% headroom)
    const safeLoad = totalPower * 1.2;
    const psu = PSU_CATALOG.find((p) => p.maxWatts >= safeLoad) || null;

    set({
      totalModules: count,
      totalPowerWatts: totalPower,
      recommendedPSU: psu,
    });
  },
}));
