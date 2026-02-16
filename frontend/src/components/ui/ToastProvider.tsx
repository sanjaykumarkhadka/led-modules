import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button } from './Button';

type ToastVariant = 'success' | 'error' | 'info';

interface NotifyPayload {
  variant: ToastVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends NotifyPayload {
  id: number;
}

interface ToastContextValue {
  notify: (payload: NotifyPayload) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const variantStyle: Record<ToastVariant, string> = {
  success: 'border-[var(--success-700)] bg-[var(--success-soft)] text-[var(--success-200)]',
  error: 'border-[var(--danger-700)] bg-[var(--danger-soft)] text-[var(--danger-200)]',
  info: 'border-[var(--accent-700)] bg-[var(--accent-soft)] text-[var(--accent-200)]',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((payload: NotifyPayload) => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((prev) => [...prev, { ...payload, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-[var(--radius-md)] border p-3 shadow-[var(--shadow-md)] ${variantStyle[toast.variant]}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description && <p className="mt-1 text-xs opacity-90">{toast.description}</p>}
              </div>
              <button
                type="button"
                className="text-xs opacity-80 hover:opacity-100"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              >
                Dismiss
              </button>
            </div>
            {toast.actionLabel && toast.onAction && (
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    toast.onAction?.();
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                  }}
                >
                  {toast.actionLabel}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
