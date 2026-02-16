import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'default' | 'accent' | 'success' | 'danger';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--border-2)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-300)] border-[var(--accent-700)]',
  success: 'bg-[var(--success-soft)] text-[var(--success-300)] border-[var(--success-700)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-300)] border-[var(--danger-700)]',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.04em]',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
