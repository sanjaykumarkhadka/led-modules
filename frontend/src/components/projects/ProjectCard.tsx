import { formatDistanceToNow } from 'date-fns';
import type { Project } from '../../api/projects';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const updatedLabel = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true });

  return (
    <Card className="group transition-colors hover:border-[var(--accent-700)]">
      <div className="space-y-4">
        <div className="cursor-pointer" onClick={onOpen}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="truncate text-sm font-semibold text-[var(--text-1)]">
                {project.name || 'Untitled project'}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-3)]">
                {project.description || 'Channel-letter layout and engineering profile'}
              </p>
            </div>
            <Badge variant="accent">LED</Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-1)] pt-3 text-[11px] text-[var(--text-4)]">
          <span>Updated {updatedLabel}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onOpen}>
              Open
            </Button>
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
