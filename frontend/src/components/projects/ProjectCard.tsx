import { formatDistanceToNow } from 'date-fns';
import type { Project } from '../../api/projects';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const updatedLabel = formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true });

  return (
    <div className="group relative flex flex-col items-stretch rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900/90 hover:border-blue-500/60 transition-colors shadow-sm hover:shadow-md text-left p-3">
      <div className="flex items-start gap-2 mb-2 cursor-pointer" onClick={onOpen}>
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/70 to-cyan-500/70 flex items-center justify-center text-slate-950 text-xs font-semibold">
          LED
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">
            {project.name || 'Untitled project'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {project.description || 'Channel letter layout'}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between text-[11px] text-slate-500">
        <span>Updated {updatedLabel}</span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
            LED layout
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-slate-500 hover:text-red-300 text-xs"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

