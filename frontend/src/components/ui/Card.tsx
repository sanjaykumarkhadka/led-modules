import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function Card({ title, description, actions, children, className, ...props }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-sm)]',
        className,
      )}
      {...props}
    >
      {(title || description || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-1)] px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-[var(--text-1)]">{title}</h2>}
            {description && <p className="mt-1 text-xs text-[var(--text-3)]">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
