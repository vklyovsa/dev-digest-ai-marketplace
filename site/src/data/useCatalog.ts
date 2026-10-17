import { useEffect, useState } from 'react';
import { loadCatalog } from './catalog';
import type { Catalog } from './types';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; catalog: Catalog };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((catalog) => alive && setState({ status: 'ready', catalog }))
      .catch((err: unknown) => alive && setState({ status: 'error', error: err instanceof Error ? err.message : String(err) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
