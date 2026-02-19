import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../data/store';
import { useProjectsStore } from '../state/projectsStore';
import { MODULE_CATALOG } from '../data/catalog/modules';
import { Button } from '../components/ui/Button';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { FieldRow } from '../components/ui/FieldRow';
import { ToolRailButton } from '../components/ui/ToolRailButton';
import { useToast } from '../components/ui/ToastProvider';

const SYNC_INTERVAL_MS = 3000;
const CHARACTER_OPTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type SyncState = 'synced' | 'pending' | 'syncing' | 'error';

function PencilIconSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function TrashIconSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function pruneOverrideKeys(removedCharIds: Set<string>) {
  if (removedCharIds.size === 0) return;
  useProjectStore.setState((state) => {
    const prune = <T,>(source: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(source ?? {}).filter(([key]) => !removedCharIds.has(key))
      ) as Record<string, T>;

    return {
      manualLedOverrides: prune(state.manualLedOverrides ?? {}),
      charShapeOverrides: prune(state.charShapeOverrides ?? {}),
      ledCountOverrides: prune(state.ledCountOverrides ?? {}),
      ledColumnOverrides: prune(state.ledColumnOverrides ?? {}),
      ledOrientationOverrides: prune(state.ledOrientationOverrides ?? {}),
      placementModeOverrides: prune(state.placementModeOverrides ?? {}),
    };
  });
}

export function DesignerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation() as { state?: { name?: string; description?: string } };
  const navigate = useNavigate();
  const { notify } = useToast();

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [newCharacter, setNewCharacter] = useState('A');
  const [syncState, setSyncState] = useState<SyncState>('synced');

  const autosaveInFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const openedProjectIdRef = useRef<string | null>(null);
  const lastAutosaveErrorRef = useRef<string | null>(null);
  const lastProjectsErrorRef = useRef<string | null>(null);

  const { projects, openProject, saveCurrentProject, errorMessage: projectsError } = useProjectsStore();

  const {
    blocks,
    charactersByBlock,
    selectedModuleId,
    totalModules,
    totalPowerWatts,
    recommendedPSU,
    selectedCharId,
    selectChar,
    setModule,
    addCharacter,
    removeCharacter,
  } = useProjectStore();

  const activeBlock = blocks[0];
  const characters = useMemo(() => {
    if (!activeBlock) return [];
    return [...(charactersByBlock[activeBlock.id] ?? [])].sort((a, b) => a.order - b.order);
  }, [activeBlock, charactersByBlock]);

  const selectedCharacter = useMemo(
    () => characters.find((char) => char.id === selectedCharId) ?? null,
    [characters, selectedCharId]
  );

  useEffect(() => {
    if (projectId && projectId !== 'new') {
      if (openedProjectIdRef.current === projectId) return;
      openedProjectIdRef.current = projectId;
      void openProject(projectId);
      return;
    }

    openedProjectIdRef.current = null;
    queueMicrotask(() => {
      setProjectName(location.state?.name || '');
      setProjectDescription(location.state?.description || '');
    });
  }, [projectId, openProject, location.state]);

  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    const existing = projects.find((p) => p._id === projectId);
    if (!existing) return;
    queueMicrotask(() => {
      setProjectName(existing.name || '');
      setProjectDescription(existing.description || '');
    });
  }, [projectId, projects]);

  useEffect(() => {
    if (characters.length === 0) {
      if (selectedCharId) selectChar(null);
      return;
    }
    if (!selectedCharacter) {
      selectChar(characters[0].id);
    }
  }, [characters, selectedCharId, selectedCharacter, selectChar]);

  const voltageOptions = useMemo(() => ['All', '12V', '24V'], []);

  const markDirty = useCallback(() => {
    if (!projectId || projectId === 'new') return;
    dirtyRef.current = true;
    setSyncState((prev) => (prev === 'syncing' ? prev : 'pending'));
  }, [projectId]);

  const flushSync = useCallback(async () => {
    if (!projectId || projectId === 'new') return;
    if (!dirtyRef.current || autosaveInFlightRef.current) return;

    autosaveInFlightRef.current = true;
    setSyncState('syncing');
    try {
      while (dirtyRef.current) {
        dirtyRef.current = false;
        const state = useProjectsStore.getState();
        const projectMeta = state.projects.find((p) => p._id === projectId);
        const name =
          projectMeta?.name?.trim() ||
          projectName.trim() ||
          location.state?.name?.trim() ||
          'Untitled project';
        const description = projectMeta?.description ?? (projectDescription || undefined);
        await saveCurrentProject(name, description);
        const saveErr = useProjectsStore.getState().errorMessage;
        if (saveErr) throw new Error(saveErr);
      }
      setSyncState('synced');
      lastAutosaveErrorRef.current = null;
    } catch (err: unknown) {
      dirtyRef.current = true;
      const message = err instanceof Error ? err.message : 'Autosync failed';
      if (message !== lastAutosaveErrorRef.current) {
        notify({
          variant: 'error',
          title: 'Sync failed',
          description: message,
        });
      }
      lastAutosaveErrorRef.current = message;
      setSyncState('error');
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, [location.state?.name, notify, projectDescription, projectId, projectName, saveCurrentProject]);

  useEffect(() => {
    if (!projectId || projectId === 'new') return;
    const timer = window.setInterval(() => {
      void flushSync();
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flushSync, projectId]);

  useEffect(() => {
    return () => {
      void flushSync();
    };
  }, [flushSync]);

  useEffect(() => {
    if (!projectsError) return;
    if (projectsError === lastProjectsErrorRef.current) return;
    lastProjectsErrorRef.current = projectsError;
    notify({
      variant: 'error',
      title: 'Project error',
      description: projectsError,
    });
  }, [notify, projectsError]);

  const syncLabel =
    syncState === 'syncing'
      ? 'Syncing...'
      : syncState === 'pending'
        ? 'Sync pending'
        : syncState === 'error'
          ? 'Sync error'
          : 'Synced';

  const handleAddCharacter = useCallback(() => {
    if (!activeBlock) return;
    const glyph = Array.from(newCharacter.trim().toUpperCase())[0];
    if (!glyph) return;
    const createdId = addCharacter(activeBlock.id, glyph);
    setNewCharacter(glyph);
    if (createdId) {
      selectChar(createdId);
      markDirty();
    }
  }, [activeBlock, addCharacter, markDirty, newCharacter, selectChar]);

  const handleRemoveCharacter = useCallback(
    (charId: string) => {
      if (!activeBlock) return;
      const removedSet = new Set<string>([charId]);
      removeCharacter(activeBlock.id, charId);
      pruneOverrideKeys(removedSet);
      const remaining = [...(useProjectStore.getState().charactersByBlock[activeBlock.id] ?? [])].sort(
        (a, b) => a.order - b.order
      );
      if (remaining.length > 0) {
        selectChar(remaining[Math.max(0, remaining.length - 1)].id);
      } else {
        selectChar(null);
      }
      markDirty();
    },
    [activeBlock, markDirty, removeCharacter, selectChar]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-[#09090b] p-3 text-zinc-100 [--surface-panel:#111111] [--surface-elevated:#171717] [--surface-subtle:#0f0f10] [--surface-strong:#222225] [--text-1:#f4f4f5] [--text-2:#d4d4d8] [--text-3:#a1a1aa] [--text-4:#71717a] [--border-1:#27272a] [--border-2:#3f3f46] [--stage-bg:#0b0b0c] [--stage-grid-line:rgba(161,161,170,0.2)]">
      <header className="rounded-[var(--radius-lg)] border border-zinc-800 bg-zinc-900/90">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
              className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            >
              ⌂
            </Button>
            <span className="text-3xl font-semibold text-zinc-100">Channel Letter</span>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              syncState === 'error'
                ? 'border-rose-500 text-rose-400'
                : 'border-zinc-700 text-zinc-400'
            }`}
          >
            {syncLabel}
          </div>
        </div>
      </header>

      <main className="grid h-full min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)_510px] gap-3 overflow-hidden">
        <aside className="h-full min-h-0 rounded-[var(--radius-lg)] border border-zinc-800 bg-zinc-900/90 p-2">
          <div className="flex flex-col items-center gap-2">
            <ToolRailButton srLabel="Zoom In" icon={<span aria-hidden className="text-lg">⊕</span>} />
            <ToolRailButton srLabel="Zoom Out" icon={<span aria-hidden className="text-lg">⊖</span>} />
          </div>
        </aside>

        <section className="h-full min-h-0 overflow-hidden rounded-[var(--radius-lg)] border border-zinc-800 bg-zinc-950/80">
          <div className="h-full min-h-0">
            <CanvasStage onCharacterMutate={markDirty} />
          </div>
        </section>

        <aside className="h-full min-h-0 space-y-3 overflow-y-auto rounded-[var(--radius-lg)] border border-zinc-800 bg-zinc-900/90 p-4">
          <div className="space-y-2 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Characters
            </div>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => {
                const selected = selectedCharId === char.id;
                return (
                  <div
                    key={char.id}
                    className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 transition-colors ${
                      selected
                        ? 'border-zinc-500 bg-zinc-800/95 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]'
                        : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectChar(char.id)}
                      className="rounded px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80"
                    >
                      {char.glyph}
                    </button>
                    <div className="ml-1 flex items-center gap-1 border-l border-zinc-700 pl-1">
                      {projectId && projectId !== 'new' && (
                        <button
                          type="button"
                          aria-label={`Edit character ${char.glyph} in manual editor`}
                          title="Edit character"
                          onClick={() => navigate(`/projects/${projectId}/manual/${char.id}`)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-600 bg-zinc-900 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80"
                        >
                          <PencilIconSmall />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete character ${char.glyph}`}
                        title="Delete character"
                        onClick={() => handleRemoveCharacter(char.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-700/70 bg-rose-950/30 text-rose-300 transition-colors hover:border-rose-600 hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/80"
                      >
                        <TrashIconSmall />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="space-y-2 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-900/50 p-3"
              role="group"
              aria-label="Add Character"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Add Character
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">
                  <span className="text-zinc-500">Selected</span>
                  <span className="font-semibold text-zinc-100">{newCharacter}</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {CHARACTER_OPTIONS.map((char) => {
                  const isSelected = newCharacter === char;
                  return (
                    <button
                      key={char}
                      type="button"
                      aria-label={`Add character ${char}`}
                      onClick={() => setNewCharacter(char)}
                      className={`h-8 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 ${
                        isSelected
                          ? 'border-blue-500/70 bg-blue-600/20 text-blue-100'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
                      }`}
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={handleAddCharacter}
                className="h-9 w-full border-blue-500/40 bg-blue-600/90 text-white hover:bg-blue-500"
              >
                Add Character
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-[var(--radius-md)] bg-zinc-900/60 p-1">
            <FieldRow
              label="Selected Character"
              control={
                <Input
                  value={selectedCharacter ? `${selectedCharacter.glyph} (${selectedCharacter.id})` : 'None selected'}
                  readOnly
                  className="h-11 bg-[var(--surface-strong)]"
                />
              }
            />
            <FieldRow
              label="Manual Edit"
              control={
                <Button
                  variant="outline"
                  className="h-11 w-full justify-center border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  disabled={!selectedCharId || !projectId || projectId === 'new'}
                  onClick={() => {
                    if (!selectedCharId || !projectId || projectId === 'new') return;
                    navigate(`/projects/${projectId}/manual/${selectedCharId}`);
                  }}
                >
                  Open Manual Editor
                </Button>
              }
            />
            <FieldRow
              label="Layout Type"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>Face Lit</option>
                </Select>
              }
            />
            <FieldRow
              label="Font"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>72 - Black - 7</option>
                </Select>
              }
            />
            <FieldRow
              label="Height"
              control={
                <div className="space-y-1 rounded-[var(--radius-md)] bg-zinc-900 px-3 py-2">
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>{selectedCharacter ? Math.round(selectedCharacter.fontSize) : '-'}</span>
                    <span className="text-xs text-zinc-500">Manual Editor only</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Character height is edited in Manual Editor.
                  </div>
                </div>
              }
            />
            <FieldRow
              label="Voltage"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  {voltageOptions.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              }
            />
            <FieldRow
              label="Power Supply"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>{recommendedPSU?.name ?? 'GEPS24LT-100U-NA'}</option>
                </Select>
              }
            />
            <FieldRow
              label="Power Supply Mode"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>Simple Optimal</option>
                </Select>
              }
            />
            <FieldRow
              label="Series"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>All</option>
                </Select>
              }
            />
            <FieldRow
              label="Color"
              control={
                <Select className="h-11 bg-[var(--surface-subtle)]">
                  <option>All</option>
                </Select>
              }
            />
            <FieldRow
              label="Module"
              control={
                <Select
                  className="h-11 bg-[var(--surface-subtle)]"
                  value={selectedModuleId}
                  onChange={(e) => {
                    setModule(e.target.value);
                    markDirty();
                  }}
                >
                  {MODULE_CATALOG.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              }
            />
          </div>

          <div className="rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-200">
            <div className="flex items-center justify-between">
              <span>Total Modules</span>
              <strong>{totalModules}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Total Power</span>
              <strong>{totalPowerWatts.toFixed(1)} W</strong>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
