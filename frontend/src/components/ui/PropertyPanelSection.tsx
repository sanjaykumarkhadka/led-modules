import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PropertyPanelSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function PropertyPanelSection({ title, children, className }: PropertyPanelSectionProps) {
  return (
    <section className={cn('space-y-3 rounded-[var(--radius-md)] border border-[var(--border-1)] bg-white p-4', className)}>
      <h3 className="text-sm font-semibold text-[var(--text-1)]">{title}</h3>
      {children}
    </section>
  );
}
