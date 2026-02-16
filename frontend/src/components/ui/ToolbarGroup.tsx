import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function ToolbarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-white p-1 shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    />
  );
}
