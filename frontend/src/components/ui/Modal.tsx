import type { ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  hideFooter?: boolean;
}

export function Modal({
  title,
  description,
  isOpen,
  onClose,
  children,
  footer,
  panelClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
  titleClassName,
  descriptionClassName,
  hideFooter,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-1)] shadow-[var(--shadow-lg)] ${panelClassName ?? ''}`}
      >
        <div className={`border-b border-[var(--border-1)] px-5 py-4 ${headerClassName ?? ''}`}>
          <h2 className={`text-sm font-semibold text-[var(--text-1)] ${titleClassName ?? ''}`}>{title}</h2>
          {description && (
            <p className={`mt-1 text-xs text-[var(--text-3)] ${descriptionClassName ?? ''}`}>{description}</p>
          )}
        </div>
        <div className={`px-5 py-4 ${bodyClassName ?? ''}`}>{children}</div>
        {!hideFooter ? (
          <div
            className={`flex items-center justify-end gap-2 border-t border-[var(--border-1)] px-5 py-4 ${footerClassName ?? ''}`}
          >
            {footer ?? (
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        ) : null}
      </div>
      <button className="sr-only" onClick={onClose} type="button">
        Close dialog
      </button>
    </div>
  );
}
