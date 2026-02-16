import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../data/store';
import { useProjectsStore } from '../state/projectsStore';
import { MODULE_CATALOG } from '../data/catalog/modules';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { Button } from '../components/ui/Button';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { ManualDesignerPage } from '../components/editor/ManualDesignerPage';
import { generatePDFReport } from '../utils/pdfReport';
import { InlineError } from '../components/ui/InlineError';
import { Panel } from '../components/ui/Panel';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/ToastProvider';

export function DesignerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation() as { state?: { name?: string; description?: string } };
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

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
    editorCharId,
    addBlock,
    updateBlock,
    removeBlock,
    setDepth,
    setModule,
    triggerPopulation,
    showDimensions,
    toggleDimensions,
    dimensionUnit,
    setDimensionUnit,
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

  const handleGeneratePDF = async () => {
    if (!currentModule) {
      notify({ variant: 'error', title: 'No module selected', description: 'Select an LED module before exporting PDF.' });
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
    notify({ variant: 'success', title: 'Project saved', description: projectName || 'Untitled project' });
  };

  return (
    <div className="space-y-5">
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[var(--text-1)]">
            Projects
          </button>
          <span>/</span>
          <span className="text-[var(--text-1)]">{projectName || 'Untitled project'}</span>
          <Badge variant="accent">Designer</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setProjectDialogOpen(true)}>Project details</Button>
          <Button onClick={handleSaveProject} disabled={projectsLoading} loading={projectsLoading}>Save</Button>
          <Button variant="outline" onClick={handleGeneratePDF}>Export PDF</Button>
        </div>
      </Panel>

      {projectsError && <InlineError message={projectsError} />}

      <main className="grid grid-cols-1 gap-5 xl:grid-cols-[330px_minmax(0,1fr)_300px]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Configuration</h2>
            <Button size="sm" variant="secondary" onClick={addBlock}>+ Add text</Button>
          </div>

          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {blocks.map((block, index) => (
              <div key={block.id} className="rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-2)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Line {index + 1}</p>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(block.id)} disabled={blocks.length === 1}>Remove</Button>
                </div>

                <div className="space-y-2.5">
                  <Input
                    type="text"
                    value={block.text}
                    onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                    placeholder="ENTER TEXT"
                  />
                  <Select
                    value={block.language}
                    onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                    label="Language / Script"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} ({lang.nativeName})
                      </option>
                    ))}
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      label="Height"
                      value={block.fontSize}
                      onChange={(e) => updateBlock(block.id, { fontSize: parseInt(e.target.value, 10) || 100 })}
                    />
                    <Input
                      type="number"
                      label="Y Position"
                      value={block.y}
                      onChange={(e) => updateBlock(block.id, { y: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={triggerPopulation}>Auto Populate LEDs</Button>

          <Input
            label="Can depth (inches)"
            type="number"
            value={depthInches}
            step={0.5}
            min={1}
            max={12}
            onChange={(e) => setDepth(parseFloat(e.target.value))}
          />

          <Select label="LED Module" value={selectedModuleId} onChange={(e) => setModule(e.target.value)}>
            {MODULE_CATALOG.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.colorTemperature})
              </option>
            ))}
          </Select>

          {currentModule && (
            <div className="rounded-[var(--radius-md)] border border-[var(--accent-700)] bg-[var(--accent-soft)] p-3 text-xs text-[var(--text-2)]">
              <p className="font-semibold text-[var(--accent-300)]">{currentModule.name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <span>Power: {currentModule.wattsPerModule}W</span>
                <span>Lumens: {currentModule.lumensPerModule}</span>
                <span>Spacing: {currentModule.installation.modulesPerFoot}/ft</span>
                <span>Voltage: {currentModule.voltage}V</span>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-2)] p-3">
            <div className="flex items-center justify-between text-sm">
              <span>Dimensions</span>
              <button
                type="button"
                onClick={toggleDimensions}
                className={`h-6 w-11 rounded-full border ${showDimensions ? 'border-[var(--accent-500)] bg-[var(--accent-500)]' : 'border-[var(--border-2)] bg-[var(--surface-3)]'}`}
              >
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${showDimensions ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            {showDimensions && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant={dimensionUnit === 'mm' ? 'primary' : 'secondary'} onClick={() => setDimensionUnit('mm')}>
                  mm
                </Button>
                <Button size="sm" variant={dimensionUnit === 'in' ? 'primary' : 'secondary'} onClick={() => setDimensionUnit('in')}>
                  in
                </Button>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="min-h-[700px] p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-3)]">
            <div className="flex items-center gap-2">
              <Badge>{blocks.length} lines</Badge>
              <Badge variant="accent">{totalModules} LEDs</Badge>
            </div>
            <span>Scale: 12.5px = 1&quot;</span>
          </div>
          <div className="h-[calc(100%-52px)] min-h-[648px]">
            <CanvasStage />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="text-sm font-semibold">Engineering Summary</h2>
          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between text-sm"><span>Total Modules</span><strong>{totalModules}</strong></div>
            <div className="flex items-center justify-between text-sm"><span>Total Power</span><strong>{totalPowerWatts.toFixed(1)} W</strong></div>
            <div className="flex items-center justify-between text-sm"><span>Recommended PSU</span><strong>{recommendedPSU ? recommendedPSU.name : 'Calculating...'}</strong></div>
          </div>
        </Panel>
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
            <Button variant="ghost" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
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
