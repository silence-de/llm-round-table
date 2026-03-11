'use client';

import { Toaster } from 'sonner';
import { useToastBridge } from '@/hooks/use-toast-bridge';

export function RoundTableToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'rt-surface border rt-border-soft text-sm rt-text-strong !shadow-none',
          description: 'rt-text-dim text-xs',
          error:
            '!bg-[color-mix(in_srgb,var(--rt-error-state)_12%,var(--rt-bg-5))] !border-[color-mix(in_srgb,var(--rt-error-state)_40%,transparent)]',
          success:
            '!border-[color-mix(in_srgb,var(--rt-live-state)_35%,transparent)] !bg-[color-mix(in_srgb,var(--rt-live-state)_10%,var(--rt-bg-5))]',
        },
      }}
    />
  );
}

export function ToastBridgeProvider() {
  useToastBridge();
  return <RoundTableToaster />;
}
