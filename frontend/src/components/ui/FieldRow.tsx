import type { ReactNode } from 'react';

interface FieldRowProps {
  label: string;
  control: ReactNode;
}

export function FieldRow({ label, control }: FieldRowProps) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm font-medium text-[var(--text-2)]">{label}</span>
      {control}
    </div>
  );
}
