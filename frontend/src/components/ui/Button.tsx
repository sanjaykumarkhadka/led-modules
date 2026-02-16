import React, { type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'pill';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-500)] text-white border border-[var(--accent-500)] hover:bg-[var(--accent-600)] hover:border-[var(--accent-600)] shadow-[var(--shadow-sm)]',
  secondary:
    'bg-[var(--surface-subtle)] text-[var(--text-1)] border border-[var(--border-1)] hover:bg-[var(--surface-strong)]',
  outline:
    'bg-[var(--surface-elevated)] text-[var(--text-2)] border border-[var(--border-2)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-1)]',
  ghost: 'bg-transparent text-[var(--text-2)] border border-transparent hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]',
  danger:
    'bg-[var(--danger-500)] text-white border border-[var(--danger-500)] hover:brightness-95',
  pill: 'rounded-full bg-[var(--button-pill-bg)] text-[var(--button-pill-text)] border border-[var(--button-pill-bg)] hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
  md: 'h-10 px-4 text-sm rounded-[var(--radius-md)]',
  lg: 'h-11 px-5 text-sm rounded-[var(--radius-md)]',
  icon: 'h-10 w-10 rounded-[var(--radius-md)]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  loading,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-app)] disabled:opacity-60 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  );
};
