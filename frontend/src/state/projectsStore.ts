import { create } from 'zustand';
import type { Project } from '../api/projects';
import {
  listProjects,
  createProject,
  updateProject,
  getProject,
} from '../api/projects';
import { useAuthStore } from './authStore';
import { useProjectStore } from '../data/store';

export interface DesignData {
  blocks: ReturnType<typeof useProjectStore.getState>['blocks'];
  depthInches: number;
  selectedModuleId: string;
  showDimensions: boolean;
  dimensionUnit: 'mm' | 'in';
  manualLedOverrides: ReturnType<typeof useProjectStore.getState>['manualLedOverrides'];
  ledCountOverrides: ReturnType<typeof useProjectStore.getState>['ledCountOverrides'];
  ledColumnOverrides: ReturnType<typeof useProjectStore.getState>['ledColumnOverrides'];
  ledOrientationOverrides: ReturnType<
    typeof useProjectStore.getState
  >['ledOrientationOverrides'];
  placementModeOverrides: ReturnType<
    typeof useProjectStore.getState
  >['placementModeOverrides'];
}

interface ProjectsState {
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;
  errorMessage: string | null;

  loadProjects: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  saveCurrentProject: (name: string) => Promise<void>;
}

function serializeDesign(): DesignData {
  const state = useProjectStore.getState();
  return {
    blocks: state.blocks,
    depthInches: state.depthInches,
    selectedModuleId: state.selectedModuleId,
    showDimensions: state.showDimensions,
    dimensionUnit: state.dimensionUnit,
    manualLedOverrides: state.manualLedOverrides,
    ledCountOverrides: state.ledCountOverrides,
    ledColumnOverrides: state.ledColumnOverrides,
    ledOrientationOverrides: state.ledOrientationOverrides,
    placementModeOverrides: state.placementModeOverrides,
  };
}

function applyDesign(design: DesignData) {
  useProjectStore.setState({
    blocks: design.blocks,
    depthInches: design.depthInches,
    selectedModuleId: design.selectedModuleId,
    showDimensions: design.showDimensions,
    dimensionUnit: design.dimensionUnit,
    manualLedOverrides: design.manualLedOverrides,
    ledCountOverrides: design.ledCountOverrides,
    ledColumnOverrides: design.ledColumnOverrides,
    ledOrientationOverrides: design.ledOrientationOverrides,
    placementModeOverrides: design.placementModeOverrides,
  });
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,
  errorMessage: null,

  async loadProjects() {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to load projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      const projects = await listProjects(accessToken);
      set({ projects, loading: false });
    } catch (err: any) {
      set({
        loading: false,
        errorMessage: err?.message ?? 'Failed to load projects',
      });
    }
  },

  async openProject(id: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to open a project.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      const project = await getProject(accessToken, id);
      const design = project.data as unknown as DesignData;
      applyDesign(design);
      set({
        currentProjectId: project._id,
        loading: false,
      });
    } catch (err: any) {
      set({
        loading: false,
        errorMessage: err?.message ?? 'Failed to open project',
      });
    }
  },

  async saveCurrentProject(name: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to save projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      const data = serializeDesign();
      const payload = {
        name,
        description: '',
        data: data as unknown as Record<string, unknown>,
      };
      const currentId = get().currentProjectId;
      let project: Project;
      if (currentId) {
        project = await updateProject(accessToken, currentId, payload);
      } else {
        project = await createProject(accessToken, payload);
      }
      // refresh list
      const projects = await listProjects(accessToken);
      set({
        currentProjectId: project._id,
        projects,
        loading: false,
      });
    } catch (err: any) {
      set({
        loading: false,
        errorMessage: err?.message ?? 'Failed to save project',
      });
    }
  },
}));

