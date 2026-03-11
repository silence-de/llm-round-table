'use client';

import { useEffect, useRef } from 'react';

interface ShortcutCallbacks {
  onTogglePause: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts(
  callbacks: ShortcutCallbacks,
  enabled: boolean
) {
  // Keep a stable ref so the effect never re-subscribes just because a
  // callback function identity changed between renders.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInteractive = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag);
      const hasRole = (e.target as HTMLElement).getAttribute('role');
      const isRoleInteractive = hasRole === 'listbox' || hasRole === 'option' || hasRole === 'combobox';

      if (e.key === 'Escape') {
        e.preventDefault();
        callbacksRef.current.onEscape();
        return;
      }

      if (e.key === ' ' && !isInteractive && !isRoleInteractive) {
        e.preventDefault();
        callbacksRef.current.onTogglePause();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}
