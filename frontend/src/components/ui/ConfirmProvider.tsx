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
        panelClassName="max-w-md rounded-xl border border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-2xl backdrop-blur"
        headerClassName="border-zinc-800 bg-zinc-900/80"
        bodyClassName="bg-zinc-900/90"
        footerClassName="border-zinc-800 bg-zinc-900/90"
        titleClassName="text-zinc-100 text-xl font-semibold tracking-tight"
        descriptionClassName="text-zinc-400 text-sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => close(false)}
              className="border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
            >
              {request?.cancelText ?? 'Cancel'}
            </Button>
            <Button
              variant={request?.variant === 'danger' ? 'danger' : 'primary'}
              onClick={() => close(true)}
              className={request?.variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : ''}
            >
              {request?.confirmText ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300">{request?.description}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
};
