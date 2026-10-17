import { useCallback, useEffect, useRef, useState } from 'react';
import { en } from '../i18n/en';
import { showToast } from './toast';

export type CopyState = 'idle' | 'copied' | 'failed';

export function useCopy(resetMs = 1600): [CopyState, (text: string) => void] {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    (text: string) => {
      const done = (next: CopyState) => {
        setState(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState('idle'), resetMs);
        showToast(next === 'copied' ? en.common.toastCopied : en.common.copyFailed);
      };
      if (!navigator.clipboard) {
        done('failed');
        return;
      }
      navigator.clipboard.writeText(text).then(
        () => done('copied'),
        () => done('failed'),
      );
    },
    [resetMs],
  );
  return [state, copy];
}
