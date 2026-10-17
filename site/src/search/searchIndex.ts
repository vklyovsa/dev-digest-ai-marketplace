import MiniSearch from 'minisearch';
import type { Artifact, Catalog, EntryKind, Plugin } from '../data/types';
import { paths } from '../router';

export type Entry =
  | { key: string; kind: 'plugin'; plugin: Plugin }
  | { key: string; kind: Exclude<EntryKind, 'plugin'>; artifact: Artifact };

interface SearchDoc {
  id: string;
  name: string;
  description: string;
  keywords: string;
  plugin: string;
  body: string;
}

export interface CatalogSearch {
  entries: Map<string, Entry>;
  run(query: string): Entry[];
}

const pluginKey = (name: string) => `p/${name}`;
const artifactKey = (id: string) => `a/${id}`;

export function entryName(entry: Entry): string {
  return entry.kind === 'plugin' ? entry.plugin.name : entry.artifact.id;
}

export function entryPlugin(entry: Entry): string {
  return entry.kind === 'plugin' ? entry.plugin.name : entry.artifact.plugin;
}

function splitWords(text: string): string[] {
  return text.split(/[\s\-_:/.,;()[\]{}"'`*#@|<>!?=+]+/u).filter(Boolean);
}

export function createSearch(catalog: Catalog): CatalogSearch {
  const entries = new Map<string, Entry>();
  const docs: SearchDoc[] = [];

  for (const plugin of catalog.index.plugins) {
    const key = pluginKey(plugin.name);
    entries.set(key, { key, kind: 'plugin', plugin });
    docs.push({
      id: key,
      name: plugin.name,
      description: plugin.description,
      keywords: [...plugin.keywords, plugin.category ?? ''].join(' '),
      plugin: plugin.name,
      body: plugin.text,
    });
  }
  for (const artifact of catalog.index.artifacts) {
    const key = artifactKey(artifact.id);
    entries.set(key, { key, kind: artifact.kind, artifact });
    docs.push({
      id: key,
      name: `${artifact.name} ${artifact.id}`,
      description: artifact.description,
      keywords: [artifact.kind, ...(catalog.pluginsByName.get(artifact.plugin)?.keywords ?? [])].join(' '),
      plugin: artifact.plugin,
      body: artifact.text,
    });
  }

  const mini = new MiniSearch<SearchDoc>({
    fields: ['name', 'description', 'keywords', 'plugin', 'body'],
    tokenize: (text) => splitWords(text),
    searchOptions: {
      boost: { name: 3, description: 2 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  });
  mini.addAll(docs);

  const all = [...entries.values()];

  return {
    entries,
    run(query: string) {
      const q = query.trim();
      if (!q) return all;
      let hits = mini.search(q);
      if (hits.length === 0) hits = mini.search(q, { combineWith: 'OR' });
      return hits.map((hit) => entries.get(String(hit.id))).filter((e): e is Entry => Boolean(e));
    },
  };
}

export function entryHref(entry: Entry): string {
  return entry.kind === 'plugin' ? paths.plugin(entry.plugin.name) : paths.artifact(entry.artifact.id);
}
