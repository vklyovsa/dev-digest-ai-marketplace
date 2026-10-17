import type { Artifact, Catalog, CatalogIndex, Plugin, Release, Stats } from './types';

const BASE = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadCatalog(): Promise<Catalog> {
  const [index, releases, stats] = await Promise.all([
    fetchJson<CatalogIndex>('index.json'),
    fetchJson<Release[]>('releases.json'),
    fetchJson<Stats>('stats.json'),
  ]);
  return {
    index,
    releases,
    stats,
    pluginsByName: new Map<string, Plugin>(index.plugins.map((p) => [p.name, p])),
    artifactsById: new Map<string, Artifact>(index.artifacts.map((a) => [a.id, a])),
  };
}

const bodyCache = new Map<string, Promise<string>>();

export function loadBody(path: string): Promise<string> {
  let pending = bodyCache.get(path);
  if (!pending) {
    pending = fetch(`${BASE}${path}`).then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.text();
    });
    pending.catch(() => bodyCache.delete(path));
    bodyCache.set(path, pending);
  }
  return pending;
}

export function repoUrl(catalog: Catalog): string | null {
  const repo = catalog.index.marketplace.repo;
  return repo ? `https://github.com/${repo}` : null;
}

export function sourceUrl(catalog: Catalog, path: string): string | null {
  const base = repoUrl(catalog);
  return base ? `${base}/blob/main/${path.replace(/^\.\//, '')}` : null;
}

export function treeUrl(catalog: Catalog, path: string): string | null {
  const base = repoUrl(catalog);
  return base ? `${base}/tree/main/${path.replace(/^\.\//, '')}` : null;
}

export function pluginArtifacts(catalog: Catalog, plugin: Plugin): Artifact[] {
  return plugin.artifacts.map((id) => catalog.artifactsById.get(id)).filter((a): a is Artifact => Boolean(a));
}
