import { useMemo } from 'react';
import type { Catalog } from '../data/types';
import { createSearch, type CatalogSearch } from './searchIndex';

export function useSearch(catalog: Catalog): CatalogSearch {
  return useMemo(() => createSearch(catalog), [catalog]);
}
