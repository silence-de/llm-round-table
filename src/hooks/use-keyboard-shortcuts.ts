'use client';

import { useEffect, useEffectEvent } from 'react';

interface ShortcutCallbacks {
  onTogglePause: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts(
  callbacks: ShortcutCallbacks,
  enabled: boolean
) {
  const onEscape = useEffectEvent(callbacks.onEscape);
  const onTogglePause = useEffectEvent(callbacks.onTogglePause);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInteractive = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag);
      const hasRole = (e.target as HTMLElement).getAttribute('role');
      const isRoleInteractive = hasRole === 'listbox' || hasRole === 'option' || hasRole === 'combobox';

      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key === ' ' && !isInteractive && !isRoleInteractive) {
        e.preventDefault();
        onTogglePause();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}
