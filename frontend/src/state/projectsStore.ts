import { create } from 'zustand';
import type { Project } from '../api/projects';
import { createProject, deleteProject, getProject, listProjects, updateProject } from '../api/projects';
import { useAuthStore } from './authStore';
import { useProjectStore } from '../data/store';
import { getProjectDesignSettings, patchProjectDesignSettings } from '../api/projectDesign';
import { deleteProjectBlock, listProjectBlocks, upsertProjectBlock } from '../api/projectBlocks';
import {
  deleteProjectCharacter,
  listProjectCharacters,
  upsertProjectCharacter,
} from '../api/projectCharacters';
import {
  deleteCharacterShapeOverride,
  listProjectShapeOverrides,
  putCharacterShapeOverride,
} from '../api/projectShapes';
import { listProjectModules, replaceCharacterModules } from '../api/projectModules';
import {
  deleteCharacterOverride,
  listProjectCharacterOverrides,
  patchCharacterOverride,
} from '../api/projectOverrides';

interface ProjectsState {
  projects: Project[];
  currentProjectId: string | null;
  loading: boolean;
  errorMessage: string | null;

  loadProjects: () => Promise<void>;
  createProjectEntry: (name: string, description?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  saveCurrentProject: (name: string, description?: string) => Promise<void>;
  renameProjectById: (id: string, name: string) => Promise<void>;
  deleteProjectById: (id: string) => Promise<void>;
  toggleFavoriteById: (id: string, isFavorite: boolean) => Promise<void>;
}

function toErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

async function hydrateProjectGraph(accessToken: string, projectId: string) {
  const [meta, design, blocks, characters, shapes, modules, overrides] = await Promise.all([
    getProject(accessToken, projectId),
    getProjectDesignSettings(accessToken, projectId),
    listProjectBlocks(accessToken, projectId),
    listProjectCharacters(accessToken, projectId),
    listProjectShapeOverrides(accessToken, projectId),
    listProjectModules(accessToken, projectId),
    listProjectCharacterOverrides(accessToken, projectId),
  ]);

  const blocksState = blocks
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      id: b.id,
      text: b.text,
      x: b.x,
      y: b.y,
      fontSize: b.fontSize,
      language: b.language,
    }));

  const charactersByBlock: ReturnType<typeof useProjectStore.getState>['charactersByBlock'] = {};
  for (const ch of characters.sort((a, b) => a.order - b.order)) {
    const list = charactersByBlock[ch.blockId] ?? [];
    list.push({
      id: ch.id,
      glyph: ch.glyph,
      x: ch.x,
      baselineY: ch.baselineY,
      fontSize: ch.fontSize,
      language: ch.language,
      order: ch.order,
    });
    charactersByBlock[ch.blockId] = list;
  }

  const manualLedOverrides: Record<string, ReturnType<typeof useProjectStore.getState>['getCharManualLeds'] extends (id: string) => infer T ? T : never> = {};
  for (const m of modules) {
    const list = manualLedOverrides[m.characterId] ?? [];
    list.push({
      id: m.id,
      u: m.u ?? 0,
      v: m.v ?? 0,
      ...(m.x != null ? { x: m.x } : {}),
      ...(m.y != null ? { y: m.y } : {}),
      rotation: m.rotation,
      ...(m.scale != null ? { scale: m.scale } : {}),
    });
    manualLedOverrides[m.characterId] = list;
  }

  const charShapeOverrides: Record<string, ReturnType<typeof useProjectStore.getState>['getCharShapeOverride'] extends (id: string) => infer T ? NonNullable<T> : never> = {};
  for (const s of shapes) {
    charShapeOverrides[s.characterId] = {
      version: s.version ?? 2,
      ...(s.outerPath != null ? { outerPath: s.outerPath } : {}),
      ...(s.holes != null ? { holes: s.holes } : {}),
      ...(s.units != null ? { units: s.units } : {}),
      ...(s.bbox != null ? { bbox: s.bbox } : {}),
      ...(s.sourceType != null ? { sourceType: s.sourceType } : {}),
      ...(s.constraints != null ? { constraints: s.constraints } : {}),
      ...(s.baseBBox != null ? { baseBBox: s.baseBBox } : {}),
      ...(s.mesh != null ? { mesh: s.mesh } : {}),
    };
  }

  const ledCountOverrides: Record<string, number> = {};
  const ledColumnOverrides: Record<string, number> = {};
  const ledOrientationOverrides: Record<string, 'horizontal' | 'vertical' | 'auto'> = {};
  const placementModeOverrides: Record<string, 'manual' | 'auto'> = {};
  for (const ov of overrides) {
    if (ov.ledCount != null) ledCountOverrides[ov.characterId] = ov.ledCount;
    if (ov.ledColumns != null) ledColumnOverrides[ov.characterId] = ov.ledColumns;
    if (ov.ledOrientation != null) ledOrientationOverrides[ov.characterId] = ov.ledOrientation;
    if (ov.placementMode != null) placementModeOverrides[ov.characterId] = ov.placementMode;
  }

  const fallbackBlock = {
    id: '1',
    text: '',
    x: 50,
    y: 200,
    fontSize: 150,
    language: 'en',
  };
  const nextBlocks = blocksState.length > 0 ? blocksState : [fallbackBlock];
  const nextCharsByBlock =
    Object.keys(charactersByBlock).length > 0
      ? charactersByBlock
      : { [nextBlocks[0].id]: [] };

  useProjectStore.setState((state) => ({
    blocks: nextBlocks,
    selectedBlockId: nextBlocks[0]?.id ?? null,
    charactersByBlock: nextCharsByBlock,
    selectedCharId: null,
    depthInches: design?.depthInches ?? state.depthInches,
    selectedModuleId: design?.selectedModuleId ?? state.selectedModuleId,
    showDimensions: design?.showDimensions ?? state.showDimensions,
    dimensionUnit: design?.dimensionUnit ?? state.dimensionUnit,
    defaultLedCount: design?.defaultLedCount ?? state.defaultLedCount,
    defaultLedColumns: design?.defaultLedColumns ?? state.defaultLedColumns,
    defaultLedOrientation: design?.defaultLedOrientation ?? state.defaultLedOrientation,
    manualLedOverrides,
    charShapeOverrides,
    ledCountOverrides,
    ledColumnOverrides,
    ledOrientationOverrides,
    placementModeOverrides,
  }));

  return meta;
}

async function syncNormalizedGraph(accessToken: string, projectId: string) {
  const state = useProjectStore.getState();
  await patchProjectDesignSettings(accessToken, projectId, {
    depthInches: state.depthInches,
    selectedModuleId: state.selectedModuleId,
    showDimensions: state.showDimensions,
    dimensionUnit: state.dimensionUnit,
    defaultLedCount: state.defaultLedCount,
    defaultLedColumns: state.defaultLedColumns,
    defaultLedOrientation: state.defaultLedOrientation,
  });

  const existingBlocks = await listProjectBlocks(accessToken, projectId);
  const nextBlocks = state.blocks.map((b, i) => ({
    id: b.id,
    text: b.text,
    x: b.x,
    y: b.y,
    fontSize: b.fontSize,
    language: b.language,
    order: i,
  }));
  await Promise.all(
    nextBlocks.map((b) =>
      upsertProjectBlock(accessToken, projectId, b.id, {
        text: b.text,
        x: b.x,
        y: b.y,
        fontSize: b.fontSize,
        language: b.language,
        order: b.order,
      })
    )
  );
  const nextBlockIds = new Set(nextBlocks.map((b) => b.id));
  await Promise.all(
    existingBlocks.filter((b) => !nextBlockIds.has(b.id)).map((b) => deleteProjectBlock(accessToken, projectId, b.id))
  );

  const existingCharacters = await listProjectCharacters(accessToken, projectId);
  const nextCharacters = Object.entries(state.charactersByBlock).flatMap(([blockId, chars]) =>
    [...chars]
      .sort((a, b) => a.order - b.order)
      .map((ch, i) => ({
        id: ch.id,
        blockId,
        glyph: ch.glyph,
        x: ch.x,
        baselineY: ch.baselineY,
        fontSize: ch.fontSize,
        language: ch.language,
        order: i,
      }))
  );

  await Promise.all(
    nextCharacters.map((ch) =>
      upsertProjectCharacter(accessToken, projectId, ch.id, {
        blockId: ch.blockId,
        glyph: ch.glyph,
        x: ch.x,
        baselineY: ch.baselineY,
        fontSize: ch.fontSize,
        language: ch.language,
        order: ch.order,
      })
    )
  );

  const nextCharIds = new Set(nextCharacters.map((c) => c.id));
  await Promise.all(
    existingCharacters
      .filter((c) => !nextCharIds.has(c.id))
      .map((c) => deleteProjectCharacter(accessToken, projectId, c.id))
  );

  const charBBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  state.computedLayoutData?.blockCharPaths.forEach(({ charPaths }) => {
    charPaths.forEach((cp) => {
      if (!cp.charId) return;
      if (!cp.bbox) return;
      charBBoxes.set(cp.charId, cp.bbox);
    });
  });

  for (const charId of nextCharIds) {
    const modules = state.manualLedOverrides[charId] ?? [];
    const bbox = charBBoxes.get(charId);
    const withLocalCoords = modules.map((m) => ({
      ...m,
      ...(m.x != null && m.y != null
        ? { x: m.x, y: m.y }
        : bbox
          ? {
              x: bbox.x + m.u * bbox.width,
              y: bbox.y + m.v * bbox.height,
            }
          : {}),
    }));
    await replaceCharacterModules(accessToken, projectId, charId, withLocalCoords);
  }

  const existingShapes = await listProjectShapeOverrides(accessToken, projectId);
  const nextShapeIds = new Set(Object.keys(state.charShapeOverrides ?? {}));
  await Promise.all(
    Object.entries(state.charShapeOverrides ?? {}).map(([charId, shape]) =>
      putCharacterShapeOverride(accessToken, projectId, charId, shape)
    )
  );
  await Promise.all(
    existingShapes
      .filter((s) => !nextShapeIds.has(s.characterId))
      .map((s) => deleteCharacterShapeOverride(accessToken, projectId, s.characterId))
  );

  const overrideCharIds = new Set<string>([
    ...Object.keys(state.ledCountOverrides ?? {}),
    ...Object.keys(state.ledColumnOverrides ?? {}),
    ...Object.keys(state.ledOrientationOverrides ?? {}),
    ...Object.keys(state.placementModeOverrides ?? {}),
  ]);
  for (const charId of overrideCharIds) {
    await patchCharacterOverride(accessToken, projectId, charId, {
      ledCount: state.ledCountOverrides?.[charId],
      ledColumns: state.ledColumnOverrides?.[charId],
      ledOrientation: state.ledOrientationOverrides?.[charId],
      placementMode: state.placementModeOverrides?.[charId],
    });
  }
  const existingOverrides = await listProjectCharacterOverrides(accessToken, projectId);
  await Promise.all(
    existingOverrides
      .filter((ov) => !overrideCharIds.has(ov.characterId))
      .map((ov) => deleteCharacterOverride(accessToken, projectId, ov.characterId))
  );
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
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to load projects'),
      });
    }
  },

  async createProjectEntry(name: string, description?: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to create projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      await createProject(accessToken, { name, description });
      const projects = await listProjects(accessToken);
      set({ projects, loading: false, currentProjectId: null });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to create project'),
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
      const project = await hydrateProjectGraph(accessToken, id);
      const existingProjects = get().projects;
      const withoutCurrent = existingProjects.filter((p) => p._id !== project._id);
      set({
        projects: [project, ...withoutCurrent],
        currentProjectId: project._id,
        loading: false,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to open project'),
      });
    }
  },

  async saveCurrentProject(name: string, description?: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to save projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      const currentId = get().currentProjectId;
      let project: Project;
      if (currentId) {
        project = await updateProject(accessToken, currentId, { name, description });
      } else {
        project = await createProject(accessToken, { name, description });
      }
      await syncNormalizedGraph(accessToken, project._id);
      const existingProjects = get().projects;
      const withoutCurrent = existingProjects.filter((p) => p._id !== project._id);
      set({
        currentProjectId: project._id,
        projects: [project, ...withoutCurrent],
        loading: false,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to save project'),
      });
    }
  },

  async deleteProjectById(id: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to delete projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      await deleteProject(accessToken, id);
      const projects = await listProjects(accessToken);
      set({
        projects,
        loading: false,
        currentProjectId: get().currentProjectId === id ? null : get().currentProjectId,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to delete project'),
      });
    }
  },

  async renameProjectById(id: string, name: string) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to rename projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      await updateProject(accessToken, id, { name });
      const projects = await listProjects(accessToken);
      set({ projects, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to rename project'),
      });
    }
  },

  async toggleFavoriteById(id: string, isFavorite: boolean) {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      set({ errorMessage: 'You must be logged in to update projects.' });
      return;
    }
    set({ loading: true, errorMessage: null });
    try {
      await updateProject(accessToken, id, { isFavorite });
      const projects = await listProjects(accessToken);
      set({ projects, loading: false });
    } catch (err: unknown) {
      set({
        loading: false,
        errorMessage: toErrorMessage(err, 'Failed to update favorite'),
      });
    }
  },
}));
