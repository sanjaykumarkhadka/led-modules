import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    if (request) request.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        title={request?.title ?? ''}
        description={request?.description}
        isOpen={Boolean(request)}
        onClose={() => close(false)}
        panelClassName="max-w-md rounded-xl border border-[var(--border-1)] bg-[var(--surface-panel)] text-[var(--text-1)] shadow-[var(--shadow-lg)] backdrop-blur"
        headerClassName="border-[var(--border-1)] bg-[var(--surface-panel)]"
        bodyClassName="bg-[var(--surface-panel)]"
        footerClassName="border-[var(--border-1)] bg-[var(--surface-panel)]"
        titleClassName="text-[var(--text-1)] text-xl font-semibold tracking-tight"
        descriptionClassName="text-[var(--text-3)] text-sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => close(false)}
              className="border border-[var(--border-2)] bg-[var(--surface-elevated)] text-[var(--text-2)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]"
            >
              {request?.cancelText ?? 'Cancel'}
            </Button>
            <Button
              variant={request?.variant === 'danger' ? 'danger' : 'primary'}
              onClick={() => close(true)}
              className={request?.variant === 'danger' ? 'bg-[var(--danger-500)] hover:brightness-95' : ''}
            >
              {request?.confirmText ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-2)]">{request?.description}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
};
