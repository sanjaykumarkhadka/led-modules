import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ToolRailButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  active?: boolean;
  srLabel: string;
}

export function ToolRailButton({ icon, active, srLabel, className, ...props }: ToolRailButtonProps) {
  return (
    <button
      type="button"
      aria-label={srLabel}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]',
        active
          ? 'border-[var(--accent-400)] bg-[var(--accent-soft)] text-[var(--accent-600)]'
          : 'border-[var(--border-1)] bg-[var(--surface-elevated)] text-[var(--text-2)] hover:bg-[var(--surface-subtle)]',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
