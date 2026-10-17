import { useEffect, useState } from 'react';
import { loadBody } from './catalog';

export type BodyState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; text: string };

export function useBody(path: string | null): BodyState {
  const [state, setState] = useState<BodyState>({ status: 'loading' });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setState({ status: 'loading' });
    loadBody(path)
      .then((text) => alive && setState({ status: 'ready', text }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}
