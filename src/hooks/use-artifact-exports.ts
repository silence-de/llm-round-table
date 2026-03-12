'use client';

import { useCallback } from 'react';

export function useArtifactExports() {
  const downloadMarkdown = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadFromUrl = useCallback((url: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }, []);

  return {
    downloadMarkdown,
    downloadFromUrl,
  };
}
