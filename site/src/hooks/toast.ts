import { useSyncExternalStore } from 'react';

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(text: string, ms = 1800): void {
  message = text;
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = null;
    emit();
  }, ms);
  emit();
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
    () => null,
  );
}
