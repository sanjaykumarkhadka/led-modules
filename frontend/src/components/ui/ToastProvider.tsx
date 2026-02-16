import React, { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => {
      const next: Toast = {
        id: Date.now(),
        type,
        message,
      };
      return [...prev, next];
    });
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[220px] max-w-xs rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-red-500/15 border-red-500/60 text-red-100'
                  : 'bg-slate-700/80 border-slate-500/60 text-slate-100'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

