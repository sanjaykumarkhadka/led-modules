import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../data/store';
import { useProjectsStore } from '../state/projectsStore';
import { MODULE_CATALOG } from '../data/catalog/modules';
import { Button } from '../components/ui/Button';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { ManualDesignerPage } from '../components/editor/ManualDesignerPage';
import { generatePDFReport } from '../utils/pdfReport';
import { InlineError } from '../components/ui/InlineError';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { FieldRow } from '../components/ui/FieldRow';
import { ToolRailButton } from '../components/ui/ToolRailButton';

export function DesignerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation() as { state?: { name?: string; description?: string } };
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('filters');

  const {
    projects,
    openProject,
    saveCurrentProject,
    loading: projectsLoading,
    errorMessage: projectsError,
  } = useProjectsStore();

  const {
    blocks,
    depthInches,
    selectedModuleId,
    totalModules,
    totalPowerWatts,
    recommendedPSU,
    selectedCharId,
    editorCharId,
    updateBlock,
    setDepth,
    setModule,
    openEditor,
    setCharPlacementMode,
    getCharPlacementMode,
  } = useProjectStore();

  const { notify } = useToast();

  useEffect(() => {
    if (projectId && projectId !== 'new') {
      void openProject(projectId);
      const existing = projects.find((p) => p._id === projectId);
      if (existing) {
        queueMicrotask(() => {
          setProjectName(existing.name || '');
          setProjectDescription(existing.description || '');
        });
      }
    } else {
      queueMicrotask(() => {
        setProjectName(location.state?.name || '');
        setProjectDescription(location.state?.description || '');
      });
    }
  }, [projectId, openProject, projects, location.state]);

  const currentModule = MODULE_CATALOG.find((m) => m.id === selectedModuleId);
  const selectedCharMode = selectedCharId ? getCharPlacementMode(selectedCharId) : 'auto';

  const activeBlock = blocks[0];
  const handleGeneratePDF = async () => {
    if (!currentModule) {
      notify({
        variant: 'error',
        title: 'No module selected',
        description: 'Select an LED module before exporting PDF.',
      });
      return;
    }

    const { computedLayoutData } = useProjectStore.getState();

    await generatePDFReport({
      blocks,
      totalModules,
      totalPowerWatts,
      depthInches,
      currentModule,
      recommendedPSU,
      blockCharPaths: computedLayoutData?.blockCharPaths,
      charLeds: computedLayoutData?.charLeds,
    });

    notify({ variant: 'success', title: 'PDF exported' });
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      setProjectDialogOpen(true);
      return;
    }
    await saveCurrentProject(projectName, projectDescription);
    notify({
      variant: 'success',
      title: 'Project saved',
      description: projectName || 'Untitled project',
    });
  };

  const voltageOptions = useMemo(() => ['All', '12V', '24V'], []);

  return (
    <div className="space-y-4">
      <header className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)]">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/')}>
              ⌂
            </Button>
            <span className="text-3xl font-semibold">Channel Letter</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="pill" className="px-8" onClick={handleGeneratePDF}>
              PDF →
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-7"
              onClick={handleSaveProject}
              disabled={projectsLoading}
              loading={projectsLoading}
            >
              Save
            </Button>
          </div>
        </div>
      </header>

      {projectsError && <InlineError message={projectsError} />}

      <main className="grid grid-cols-[76px_minmax(0,1fr)_510px] gap-3">
        <aside className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-2">
          <div className="flex flex-col items-center gap-2">
            <ToolRailButton srLabel="Zoom In" icon={<span aria-hidden className="text-lg">⊕</span>} />
            <ToolRailButton srLabel="Zoom Out" icon={<span aria-hidden className="text-lg">⊖</span>} />
          </div>
        </aside>

        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-subtle)]">
          <div className="h-[760px]">
            <CanvasStage />
          </div>
        </section>

        <aside className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-4">
          <div className="flex items-center justify-between">
            <SegmentedControl
              value={panelTab}
              onChange={setPanelTab}
              options={[
                { label: 'Population Filters', value: 'filters' },
                { label: 'Properties', value: 'props' },
              ]}
            />
            <span className="text-2xl text-[var(--text-3)]">»</span>
          </div>

          <div className="space-y-2 rounded-[var(--radius-md)] bg-[var(--surface-panel)] p-1">
            <FieldRow
              label="Selected Character"
              control={
                <Input
                  value={selectedCharId ?? 'None selected'}
                  readOnly
                  className="h-11 bg-[var(--surface-strong)]"
                />
              }
            />
            <FieldRow
              label="Placement"
              control={
                <SegmentedControl
                  value={selectedCharMode}
                  onChange={(value) => {
                    if (!selectedCharId) return;
                    setCharPlacementMode(selectedCharId, value as 'auto' | 'manual');
                  }}
                  options={[
                    { label: 'Auto', value: 'auto' },
                    { label: 'Manual', value: 'manual' },
                  ]}
                  className="w-full justify-center"
                />
              }
            />
            <FieldRow
              label="Manual Edit"
              control={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  disabled={!selectedCharId}
                  onClick={() => {
                    if (!selectedCharId) return;
                    setCharPlacementMode(selectedCharId, 'manual');
                    openEditor(selectedCharId);
                  }}
                >
                  Open editor
                </Button>
              }
            />
            <FieldRow
              label="Your Text"
              control={
                <Input
                  value={activeBlock?.text ?? ''}
                  onChange={(e) => {
                    if (!activeBlock) return;
                    updateBlock(activeBlock.id, { text: e.target.value });
                  }}
                  className="h-11 bg-[var(--surface-strong)]"
                />
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
              label="Depth"
              control={
                <Input
                  type="number"
                  value={depthInches}
                  step={0.5}
                  min={1}
                  max={12}
                  onChange={(e) => setDepth(parseFloat(e.target.value) || 1)}
                  className="h-11 bg-[var(--surface-subtle)]"
                />
              }
            />
            <FieldRow
              label="Height"
              control={
                <Input
                  type="number"
                  value={activeBlock?.fontSize ?? 24}
                  onChange={(e) => {
                    if (!activeBlock) return;
                    updateBlock(activeBlock.id, { fontSize: parseInt(e.target.value, 10) || 24 });
                  }}
                  className="h-11 bg-[var(--surface-subtle)]"
                />
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
                  onChange={(e) => setModule(e.target.value)}
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

      <Modal
        title="Project details"
        description="Project name is required before saving."
        isOpen={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
      >
        <div className="space-y-3">
          <Input
            label="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            error={!projectName.trim() ? 'Project name is required.' : undefined}
          />
          <Input
            label="Description"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!projectName.trim()) return;
                await saveCurrentProject(projectName, projectDescription);
                setProjectDialogOpen(false);
                notify({ variant: 'success', title: 'Project saved' });
              }}
            >
              Save project
            </Button>
          </div>
        </div>
      </Modal>

      {editorCharId && <ManualDesignerPage />}
    </div>
  );
}
