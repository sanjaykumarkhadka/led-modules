import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-2)] bg-[var(--surface-1)] px-6 text-center">
      <div className="text-sm font-semibold text-[var(--text-1)]">{title}</div>
      <p className="mt-2 max-w-md text-sm text-[var(--text-3)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
