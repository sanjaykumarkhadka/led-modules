import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function Card({ title, description, children }: CardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm">
      {(title || description) && (
        <div className="px-6 pt-5 pb-3 border-b border-slate-800">
          {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

