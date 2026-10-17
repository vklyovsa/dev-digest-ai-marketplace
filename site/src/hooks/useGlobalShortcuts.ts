import { useEffect } from 'react';

export const GLOBAL_SEARCH_ID = 'global-search';

export function focusGlobalSearch(select = false): void {
  const input = document.getElementById(GLOBAL_SEARCH_ID);
  if (input instanceof HTMLInputElement) {
    input.focus();
    if (select) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusGlobalSearch(true);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        focusGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
