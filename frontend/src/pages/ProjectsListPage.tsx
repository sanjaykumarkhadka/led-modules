import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../api/projects';
import { useProjectsStore } from '../state/projectsStore';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { useToast } from '../components/ui/ToastProvider';
import { Modal } from '../components/ui/Modal';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className = 'h-4 w-4 text-zinc-500' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 7v-7h7v7h-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreVerticalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4Zm11-13 2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path
        d="m12 3.6 2.65 5.36 5.92.86-4.29 4.18 1.01 5.9L12 17.12 6.71 19.9l1.01-5.9-4.29-4.18 5.92-.86L12 3.6Z"
        stroke="currentColor"
        strokeWidth={filled ? '0' : '1.8'}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function relativeUpdated(dateValue?: string) {
  if (!dateValue) return 'recently';
  const then = new Date(dateValue).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const diffMs = Date.now() - then;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function projectStatus(project: Project): 'In Progress' | 'Completed' | 'Draft' {
  if (project.data && project.updatedAt && Date.now() - new Date(project.updatedAt).getTime() > 2 * 86400000) {
    return 'Completed';
  }
  if (project.data) return 'In Progress';
  return 'Draft';
}

function statusColor(status: 'In Progress' | 'Completed' | 'Draft') {
  if (status === 'Completed') return 'bg-green-500';
  if (status === 'In Progress') return 'bg-blue-500';
  return 'bg-orange-500';
}

function thumbnailClass(project: Project) {
  const key = (project.name || project._id || 'x').length % 4;
  if (key === 0) return 'bg-blue-900/20';
  if (key === 1) return 'bg-green-900/20';
  if (key === 2) return 'bg-orange-900/20';
  return 'bg-purple-900/20';
}

function ProjectCard({
  project,
  viewMode,
  onOpen,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  project: Project;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const status = projectStatus(project);

  if (viewMode === 'grid') {
    return (
      <div className="group h-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <div className={`relative flex h-40 w-full items-center justify-center ${thumbnailClass(project)}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent opacity-60" />
            <span className="text-4xl font-bold uppercase tracking-widest text-zinc-100/20">
              {(project.name || 'Untitled').substring(0, 3)}
            </span>
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    project.isFavorite
                      ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30'
                      : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  }`}
                  aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <StarIcon filled={Boolean(project.isFavorite)} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  aria-label="Project actions"
                >
                  <MoreVerticalIcon />
                </button>
              </div>
            </div>
          </div>
        </button>

        <div className="pb-2 pl-6 pr-6 pt-4">
          <button type="button" onClick={onOpen} className="block w-full text-left">
            <h3 className="truncate text-lg font-semibold text-zinc-100">{project.name || 'Untitled project'}</h3>
          </button>
        </div>

        <div className="pl-6 pr-6 pb-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor(status)}`} />
            {status}
          </div>
        </div>

        <div className="flex items-center justify-between pb-4 pl-6 pr-6 pt-0 text-xs text-zinc-500">
          <span>Updated {relativeUpdated(project.updatedAt)}</span>
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`rounded-md p-1.5 ${
                project.isFavorite
                  ? 'text-amber-300 hover:bg-zinc-800 hover:text-amber-200'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <StarIcon filled={Boolean(project.isFavorite)} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Edit project"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1.5 text-rose-400 hover:bg-zinc-800 hover:text-rose-300"
              aria-label="Delete project"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
      <div className="flex items-center gap-4 p-4">
        <button
          type="button"
          onClick={onOpen}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${thumbnailClass(project)}`}
        >
          <span className="font-bold uppercase text-zinc-100/40">{(project.name || 'U').substring(0, 1)}</span>
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="truncate font-medium text-zinc-100">{project.name || 'Untitled project'}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor(status)}`} />
            {status} • Updated {relativeUpdated(project.updatedAt)}
          </div>
        </button>
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`rounded-md p-2 ${
              project.isFavorite
                ? 'text-amber-300 hover:bg-zinc-800 hover:text-amber-200'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
            aria-label={project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <StarIcon filled={Boolean(project.isFavorite)} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Edit project"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-2 text-rose-400 hover:bg-zinc-800 hover:text-rose-300"
            aria-label="Delete project"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsListPage({ mode = 'all' }: { mode?: 'all' | 'favorites' }) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { notify } = useToast();
  const {
    projects,
    loading,
    errorMessage,
    loadProjects,
    createProjectEntry,
    renameProjectById,
    deleteProjectById,
    toggleFavoriteById,
  } =
    useProjectsStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        (project.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        (mode === 'favorites' ? Boolean(project.isFavorite) : true)
      ),
    [mode, projects, searchQuery]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createProjectEntry(newName.trim(), newDescription.trim() || undefined);
    setIsCreateOpen(false);
    setNewName('');
    setNewDescription('');
    notify({
      variant: 'success',
      title: 'Project created',
      description: 'Project created successfully. Click it from the list to open.',
    });
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit || !editName.trim()) return;
    await renameProjectById(projectToEdit._id, editName.trim());
    setIsEditOpen(false);
    setProjectToEdit(null);
    notify({ variant: 'success', title: 'Project updated' });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col gap-8 bg-[#09090b] p-6 text-zinc-50 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === 'favorites' ? 'Favorites' : 'Projects'}</h1>
          <p className="text-zinc-400">
            {mode === 'favorites'
              ? 'Quick access to your starred signage projects.'
              : 'Manage your signage engineering files.'}
          </p>
        </div>
        {mode === 'all' ? (
          <button
            type="button"
            onClick={() => {
              setNewName('');
              setNewDescription('');
              setIsCreateOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <PlusIcon />
            New Project
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:flex-row">
        <div className="relative w-full sm:w-96">
          <div className="absolute left-2.5 top-2.5">
            <SearchIcon />
          </div>
          <input
            placeholder="Search projects..."
            className="h-10 w-full rounded-md border border-zinc-800 bg-[#09090b] pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-[#09090b] p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded ${
              viewMode === 'grid' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded ${
              viewMode === 'list' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

      {!loading && filteredProjects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <SearchIcon className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-sm text-zinc-400">
            {mode === 'favorites'
              ? 'Star projects to see them in Favorites.'
              : 'Try adjusting your search query.'}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-4'}>
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              viewMode={viewMode}
              onOpen={() => navigate(`/projects/${project._id}`)}
              onEdit={() => {
                setProjectToEdit(project);
                setEditName(project.name || '');
                setIsEditOpen(true);
              }}
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
              onToggleFavorite={async () => {
                await toggleFavoriteById(project._id, !project.isFavorite);
                notify({
                  variant: 'success',
                  title: project.isFavorite ? 'Removed from favorites' : 'Added to favorites',
                });
              }}
            />
          ))}
        </div>
      )}

      {mode === 'all' ? (
        <Modal
          title="Create project"
          description="Set up a new signage workspace for your team."
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          panelClassName="max-w-md rounded-xl border border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-2xl backdrop-blur"
          headerClassName="border-zinc-800 bg-zinc-900/80"
          bodyClassName="bg-zinc-900/90"
          titleClassName="text-zinc-100 text-xl font-semibold tracking-tight"
          descriptionClassName="text-zinc-400 text-sm"
          hideFooter
        >
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="new-project-name" className="text-sm font-medium text-zinc-300">
                Project name
              </label>
              <input
                id="new-project-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                required
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="new-project-description" className="text-sm font-medium text-zinc-300">
                Description
              </label>
              <input
                id="new-project-description"
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional notes"
                className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Create Project
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      <Modal
        title="Edit project"
        description="Update project name."
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setProjectToEdit(null);
        }}
        panelClassName="max-w-md rounded-xl border border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-2xl backdrop-blur"
        headerClassName="border-zinc-800 bg-zinc-900/80"
        bodyClassName="bg-zinc-900/90"
        titleClassName="text-zinc-100 text-xl font-semibold tracking-tight"
        descriptionClassName="text-zinc-400 text-sm"
        hideFooter
      >
        <form onSubmit={(e) => void handleRename(e)} className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="edit-project-name" className="text-sm font-medium text-zinc-300">
              Project name
            </label>
            <input
              id="edit-project-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Project name"
            required
              className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsEditOpen(false);
                setProjectToEdit(null);
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
