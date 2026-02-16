import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-2)]" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-2)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-1)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
