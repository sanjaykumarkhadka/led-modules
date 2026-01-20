import { create } from 'zustand';
import { MODULE_CATALOG, type LEDModule } from './catalog/modules';
import { PSU_CATALOG, type PowerSupply } from './catalog/powerSupplies';

export interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number; // Represents height in relative units
  language: string; // Per-block language for font selection
}

interface ProjectState {
  // Configuration
  blocks: TextBlock[];
  depthInches: number;
  selectedModuleId: string;

  // UI State
  selectedBlockId: string | null;
  populateVersion: number; // Increment to trigger calculation
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';

  // Engineering Data (Calculated)
  totalModules: number;
  totalPowerWatts: number;
  recommendedPSU: PowerSupply | null;

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

  // Selectors
  getCurrentModule: () => LEDModule;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  blocks: [{ id: '1', text: 'HELLO', x: 50, y: 200, fontSize: 150, language: 'en' }],
  depthInches: 5.0,
  selectedModuleId: 'tetra-max-medium-24v',
  selectedBlockId: '1',
  populateVersion: 0,
  showDimensions: true,
  dimensionUnit: 'mm',

  totalModules: 0,
  totalPowerWatts: 0,
  recommendedPSU: null,

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
