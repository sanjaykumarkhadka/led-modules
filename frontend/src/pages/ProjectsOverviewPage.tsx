import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../state/projectsStore';
import type { Project } from '../api/projects';
import { Button } from '../components/ui/Button';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/ToastProvider';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineError } from '../components/ui/InlineError';
import { SegmentedControl } from '../components/ui/SegmentedControl';

export function ProjectsOverviewPage() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const navigate = useNavigate();
  const {
    projects,
    loading,
    errorMessage,
    loadProjects,
    createProjectEntry,
    renameProjectById,
    deleteProjectById,
  } =
    useProjectsStore();
  const { notify } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter((project) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (project.name || '').toLowerCase().includes(term) ||
      (project.description || '').toLowerCase().includes(term)
    );
  });

  const handleNewProject = () => {
    setNewName('');
    setNewDescription('');
    setIsNewOpen(true);
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await createProjectEntry(newName.trim(), newDescription.trim() || undefined);
    setIsNewOpen(false);
    notify({
      variant: 'success',
      title: 'Project created',
      description: 'Project created successfully. Click it from the list to open.',
    });
  };

  const handleOpenEditProject = (project: Project) => {
    setProjectToEdit(project);
    setEditName(project.name || '');
    setIsEditOpen(true);
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit || !editName.trim()) return;
    await renameProjectById(projectToEdit._id, editName.trim());
    setIsEditOpen(false);
    setProjectToEdit(null);
    notify({ variant: 'success', title: 'Project updated' });
  };

  const isEmpty = !loading && projects.length === 0 && !search;

  return (
    <div className="space-y-6">
      <header className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium">Projects ({projects.length})</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">Browse and manage signage engineering files.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              className="w-72"
            />
            <SegmentedControl
              value={viewMode}
              onChange={(value) => setViewMode(value as 'grid' | 'list')}
              options={[
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
              ]}
            />
            <Button onClick={handleNewProject}>Create project</Button>
          </div>
        </div>
      </header>

      {errorMessage && <InlineError message={errorMessage} />}
      {loading && <p className="text-xs text-[var(--text-3)]">Loading your projects...</p>}

      {isEmpty ? (
        <EmptyState
          title="No projects yet"
          description="Start your first LED production layout. Project metadata and engineering stats are preserved for later revisions."
          action={<Button onClick={handleNewProject}>Create first project</Button>}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              mode={viewMode}
              onOpen={() => navigate(`/projects/${project._id}`)}
              onEdit={() => handleOpenEditProject(project)}
              onDelete={async () => {
                const confirmed = await confirm({
                  title: 'Delete project?',
                  description: `Delete "${project.name || 'Untitled'}" permanently? This cannot be undone.`,
                  confirmText: 'Delete project',
                  variant: 'danger',
                });
                if (!confirmed) return;
                await deleteProjectById(project._id);
                notify({ variant: 'success', title: 'Project deleted' });
              }}
            />
          ))}
        </div>
      )}

      <Modal
        title="Create project"
        description="Provide a project name and optional context for your team."
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
      >
        <form onSubmit={(e) => void handleCreateNewProject(e)} className="space-y-4">
          <Input
            label="Project name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ACME Downtown Channel Letters"
            required
          />
          <Input
            label="Description"
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional notes"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Create project
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Edit project"
        description="Update project name."
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setProjectToEdit(null);
        }}
      >
        <form onSubmit={(e) => void handleRenameProject(e)} className="space-y-4">
          <Input
            label="Project name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Project name"
            required
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
