import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    />
  );
}
