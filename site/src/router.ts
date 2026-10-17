import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'search'; q: string; kind: string | null; plugin: string | null }
  | { name: 'plugin'; pluginName: string }
  | { name: 'artifact'; id: string }
  | { name: 'whats-new' }
  | { name: 'getting-started' }
  | { name: 'not-found'; path: string };

const ROUTE_EVENT = 'hashroute';

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart = '/', queryPart = ''] = raw.split('?', 2);
  const params = new URLSearchParams(queryPart);
  const segments = pathPart.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const [head, arg] = segments;
  if (!head) return { name: 'home' };
  if (head === 'search' && segments.length === 1) {
    return { name: 'search', q: params.get('q') ?? '', kind: params.get('kind') || null, plugin: params.get('plugin') || null };
  }
  if (head === 'plugin' && arg && segments.length === 2) return { name: 'plugin', pluginName: arg };
  if (head === 'artifact' && arg && segments.length === 2) return { name: 'artifact', id: arg };
  if (head === 'whats-new' && segments.length === 1) return { name: 'whats-new' };
  if (head === 'getting-started' && segments.length === 1) return { name: 'getting-started' };
  return { name: 'not-found', path: pathPart };
}

export const paths = {
  home: () => '#/',
  search: (q = '', kind: string | null = null, plugin: string | null = null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kind) params.set('kind', kind);
    if (plugin) params.set('plugin', plugin);
    const qs = params.toString();
    return `#/search${qs ? `?${qs}` : ''}`;
  },
  plugin: (name: string) => `#/plugin/${encodeURIComponent(name)}`,
  artifact: (id: string) => `#/artifact/${encodeURIComponent(id)}`,
  whatsNew: () => '#/whats-new',
  gettingStarted: () => '#/getting-started',
};

export function navigate(href: string, { replace = false } = {}): void {
  if (replace) {
    history.replaceState(history.state, '', href);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  } else {
    window.location.hash = href.replace(/^#/, '');
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(ROUTE_EVENT, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(ROUTE_EVENT, onChange);
  };
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}
