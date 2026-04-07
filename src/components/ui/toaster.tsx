'use client';

import { Toaster } from 'sonner';
import { useToastBridge } from '@/hooks/use-toast-bridge';

const toastClassNames = {
  toast:
    'border border-border bg-card text-sm text-card-foreground shadow-[var(--shadow-sm)]',
  description: 'text-xs text-muted-foreground',
  error: '!border-destructive/30 !bg-destructive/10 !text-foreground',
  success: '!border-[var(--color-accent-border)] !bg-[var(--color-accent-subtle)] !text-foreground',
};

export function RoundTableToaster() {
  return <Toaster position="bottom-right" toastOptions={{ classNames: toastClassNames }} />;
}

export function ToastBridgeProvider() {
  useToastBridge();
  return <RoundTableToaster />;
}
