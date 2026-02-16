import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../state/projectsStore';
import { Button } from '../components/ui/Button';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/ToastProvider';

export function ProjectsOverviewPage() {
  const [search, setSearch] = useState('');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const navigate = useNavigate();
  const { projects, loading, errorMessage, loadProjects, deleteProjectById } = useProjectsStore();
  const { showToast } = useToast();

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
    if (!newName.trim()) {
      return;
    }
    setIsNewOpen(false);
    showToast('success', 'New project started. You can now configure your layout.');
    navigate('/projects/new', {
      state: { name: newName.trim(), description: newDescription.trim() || undefined },
    });
  };

  const isEmpty = !loading && projects.length === 0 && !search;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-xs text-slate-400">
            Browse and manage all your LED layouts. Click a project to open it in the designer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              className="w-52 sm:w-64 rounded-lg bg-slate-900 border border-slate-700 px-8 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute left-2 top-1.5 text-slate-500 text-xs">🔍</span>
          </div>
          <Button onClick={handleNewProject}>New project</Button>
        </div>
      </div>

      {errorMessage && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 px-3 py-2 rounded-lg">
          {errorMessage}
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-400 px-1">Loading your projects…</div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-8">
          <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center">
            <span className="text-2xl">+</span>
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h1 className="text-2xl font-semibold">Create your first LED project</h1>
            <p className="text-slate-400 text-sm">
              Organize all your channel letter layouts in one place. Start a new project and Qwatt
              will help you with LED population and power planning.
            </p>
          </div>
          <Button onClick={handleNewProject}>New project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onOpen={() => navigate(`/projects/${project._id}`)}
              onDelete={async () => {
                const confirmed = window.confirm(
                  `Delete project "${project.name || 'Untitled'}"? This cannot be undone.`,
                );
                if (!confirmed) return;
                await deleteProjectById(project._id);
                showToast('success', 'Project deleted.');
              }}
            />
          ))}
        </div>
      )}

      <Modal
        title="New project"
        description="Give your LED layout a name and optional description."
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
      >
        <form onSubmit={handleCreateNewProject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Project name</label>
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. ACME Main Sign"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Description (optional)</label>
            <Input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short summary for this layout"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" size="sm">
              Start designing
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

