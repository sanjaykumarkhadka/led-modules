import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../data/store';
import { useProjectsStore } from '../state/projectsStore';
import { MODULE_CATALOG } from '../data/catalog/modules';
import { Button } from '../components/ui/Button';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { InlineError } from '../components/ui/InlineError';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { FieldRow } from '../components/ui/FieldRow';
import { ToolRailButton } from '../components/ui/ToolRailButton';
import { useToast } from '../components/ui/ToastProvider';

const MIN_DESIGN_FONT_SIZE = 8;
const MAX_DESIGN_FONT_SIZE = 96;
const SYNC_INTERVAL_MS = 3000;

type SyncState = 'synced' | 'pending' | 'syncing' | 'error';

function clampFontSize(value: number) {
  if (!Number.isFinite(value)) return 24;
  return Math.min(MAX_DESIGN_FONT_SIZE, Math.max(MIN_DESIGN_FONT_SIZE, Math.round(value)));
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
  const [newCharacter, setNewCharacter] = useState('');
  const [depthInput, setDepthInput] = useState('5');
  const [syncState, setSyncState] = useState<SyncState>('synced');

  const autosaveInFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const openedProjectIdRef = useRef<string | null>(null);
  const lastAutosaveErrorRef = useRef<string | null>(null);

  const { projects, openProject, saveCurrentProject, errorMessage: projectsError } = useProjectsStore();

  const {
    blocks,
    charactersByBlock,
    depthInches,
    selectedModuleId,
    totalModules,
    totalPowerWatts,
    recommendedPSU,
    selectedCharId,
    selectChar,
    setDepth,
    setModule,
    addCharacter,
    removeCharacter,
    updateCharacter,
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
    setDepthInput(String(depthInches));
  }, [depthInches]);

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

  const applyDepthFromInput = useCallback(
    (value: string) => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) {
        setDepthInput(String(depthInches));
        return;
      }
      const clamped = Math.min(12, Math.max(1, parsed));
      setDepth(clamped);
      setDepthInput(String(clamped));
      markDirty();
    },
    [depthInches, markDirty, setDepth]
  );

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
    const glyph = Array.from(newCharacter.trim())[0];
    if (!glyph) return;
    const createdId = addCharacter(activeBlock.id, glyph);
    setNewCharacter('');
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3">
      <header className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)]">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}>
              ⌂
            </Button>
            <span className="text-3xl font-semibold">Channel Letter</span>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              syncState === 'error'
                ? 'border-[var(--danger-500)] text-[var(--danger-500)]'
                : 'border-[var(--border-2)] text-[var(--text-3)]'
            }`}
          >
            {syncLabel}
          </div>
        </div>
      </header>

      {projectsError && <InlineError message={projectsError} />}

      <main className="grid h-full min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)_510px] gap-3 overflow-hidden">
        <aside className="h-full min-h-0 rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-2">
          <div className="flex flex-col items-center gap-2">
            <ToolRailButton srLabel="Zoom In" icon={<span aria-hidden className="text-lg">⊕</span>} />
            <ToolRailButton srLabel="Zoom Out" icon={<span aria-hidden className="text-lg">⊖</span>} />
          </div>
        </aside>

        <section className="h-full min-h-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-subtle)]">
          <div className="h-full min-h-0">
            <CanvasStage onCharacterMutate={markDirty} />
          </div>
        </section>

        <aside className="h-full min-h-0 space-y-3 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-4">
          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-elevated)] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Characters
            </div>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => {
                const selected = selectedCharId === char.id;
                return (
                  <div
                    key={char.id}
                    className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 ${
                      selected
                        ? 'border-[var(--accent-400)] bg-[var(--accent-soft)] text-[var(--accent-600)]'
                        : 'border-[var(--border-2)] bg-[var(--surface-subtle)] text-[var(--text-2)]'
                    }`}
                  >
                    <button type="button" onClick={() => selectChar(char.id)} className="text-sm">
                      {char.glyph}
                    </button>
                    {projectId && projectId !== 'new' && (
                      <button
                        type="button"
                        aria-label="Open manual editor"
                        title="Open manual editor"
                        onClick={() => navigate(`/projects/${projectId}/manual/${char.id}`)}
                        className="text-xs hover:text-[var(--text-1)]"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Remove character"
                      title="Remove character"
                      onClick={() => handleRemoveCharacter(char.id)}
                      className="text-xs hover:text-[var(--danger-500)]"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={newCharacter}
                maxLength={2}
                placeholder="Add char"
                onChange={(e) => setNewCharacter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCharacter();
                  }
                }}
                className="h-9 bg-[var(--surface-subtle)]"
              />
              <Button size="sm" variant="outline" onClick={handleAddCharacter}>
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--surface-panel)] p-1">
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
                  className="h-11 w-full justify-center"
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
              label="Your Text"
              control={<Input value={characters.map((char) => char.glyph).join('')} readOnly className="h-11 bg-[var(--surface-strong)]" />}
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
              label="Depth"
              control={
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="^[0-9]*[.]?[0-9]*$"
                  value={depthInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (/^\d*\.?\d*$/.test(next)) setDepthInput(next);
                  }}
                  onBlur={(e) => applyDepthFromInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyDepthFromInput((e.currentTarget as HTMLInputElement).value);
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="h-11 bg-[var(--surface-subtle)]"
                />
              }
            />
            <FieldRow
              label="Height"
              control={
                <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] px-3 py-2">
                  <input
                    type="range"
                    min={MIN_DESIGN_FONT_SIZE}
                    max={MAX_DESIGN_FONT_SIZE}
                    step={1}
                    value={selectedCharacter?.fontSize ?? 24}
                    disabled={!selectedCharacter}
                    onChange={(e) => {
                      const next = clampFontSize(Number.parseInt(e.target.value, 10));
                      if (!selectedCharacter) return;
                      updateCharacter(selectedCharacter.id, { fontSize: next });
                      markDirty();
                    }}
                    className="h-2 w-full cursor-pointer accent-[var(--accent-500)]"
                  />
                  <span className="w-10 text-right text-sm text-[var(--text-2)]">
                    {selectedCharacter ? Math.round(selectedCharacter.fontSize) : '-'}
                  </span>
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

          <div className="rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-elevated)] p-3 text-sm">
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
