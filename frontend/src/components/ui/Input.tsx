import React, { type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input: React.FC<InputProps> = ({ error, label, className, id, ...props }) => {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-2)]" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-[var(--radius-md)] border bg-[var(--surface-2)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-4)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-[var(--danger-500)]' : 'border-[var(--border-2)]',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger-300)]">{error}</p>}
    </div>
  );
};
