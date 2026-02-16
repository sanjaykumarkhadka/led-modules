import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../state/projectsStore';
import { Button } from '../components/ui/Button';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/ToastProvider';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineError } from '../components/ui/InlineError';
import { Panel } from '../components/ui/Panel';

export function ProjectsOverviewPage() {
  const [search, setSearch] = useState('');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const navigate = useNavigate();
  const { projects, loading, errorMessage, loadProjects, deleteProjectById } = useProjectsStore();
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

  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsNewOpen(false);
    notify({
      variant: 'success',
      title: 'Project created',
      description: 'New project started. Configure your layout now.',
    });
    navigate('/projects/new', {
      state: { name: newName.trim(), description: newDescription.trim() || undefined },
    });
  };

  const isEmpty = !loading && projects.length === 0 && !search;

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Manage all layouts and re-open designs for production revisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            className="w-56"
          />
          <Button onClick={handleNewProject}>New project</Button>
        </div>
      </Panel>

      {errorMessage && <InlineError message={errorMessage} />}
      {loading && <p className="text-xs text-[var(--text-3)]">Loading your projects...</p>}

      {isEmpty ? (
        <EmptyState
          title="No projects yet"
          description="Start your first LED production layout. Project metadata and engineering stats are preserved for later revisions."
          action={<Button onClick={handleNewProject}>Create first project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onOpen={() => navigate(`/projects/${project._id}`)}
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
        <form onSubmit={handleCreateNewProject} className="space-y-4">
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
              Start designing
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
