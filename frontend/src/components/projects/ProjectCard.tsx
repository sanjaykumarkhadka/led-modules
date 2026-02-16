import { formatDistanceToNow } from 'date-fns';
import type { Project } from '../../api/projects';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  mode?: 'grid' | 'list';
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m19 6-1 14a1 1 0 0 1-1 .93H7a1 1 0 0 1-1-.93L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectCard({ project, onOpen, onEdit, onDelete, mode = 'grid' }: ProjectCardProps) {
  const updatedLabel = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true });

  if (mode === 'list') {
    return (
      <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-elevated)] px-4 py-3">
        <button type="button" className="text-left" onClick={onOpen}>
          <h3 className="text-sm font-semibold text-[var(--text-1)]">{project.name || 'Untitled project'}</h3>
          <p className="mt-1 text-xs text-[var(--text-3)]">{project.description || 'Channel-letter layout and engineering profile'}</p>
        </button>
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <span>Updated {updatedLabel}</span>
          {onEdit && (
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit project name">
              <PencilIcon />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete project">
              <TrashIcon />
            </Button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col justify-between rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--surface-elevated)] p-4 transition-colors hover:border-[var(--accent-300)]">
      <button type="button" className="text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-[var(--text-1)]">{project.name || 'Untitled project'}</h3>
          <Badge variant="accent">Signage</Badge>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-[var(--text-3)]">{project.description || 'Channel-letter layout and engineering profile'}</p>
      </button>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-1)] pt-3 text-xs text-[var(--text-3)]">
        <span>Updated {updatedLabel}</span>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit project name">
              <PencilIcon />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete project">
              <TrashIcon />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
