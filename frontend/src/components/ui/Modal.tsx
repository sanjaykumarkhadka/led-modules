import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, description, isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl">
        <div className="px-5 pt-4 pb-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="px-5 pb-4 pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

