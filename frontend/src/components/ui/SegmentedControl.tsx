import { cn } from '../../lib/cn';

export interface SegmentOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentOption[];
  className?: string;
}

export function SegmentedControl({ value, onChange, options, className }: SegmentedControlProps) {
  return (
    <div className={cn('inline-flex items-center rounded-full border border-[var(--border-1)] bg-[var(--surface-subtle)] p-1', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm transition-colors',
              active
                ? 'bg-[var(--surface-elevated)] text-[var(--text-1)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--text-2)] hover:text-[var(--text-1)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
