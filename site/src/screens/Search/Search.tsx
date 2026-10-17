import { useEffect, useMemo, useRef, useState } from 'react';
import { EntryCard } from '../../components/EntryCard/EntryCard';
import { ARTIFACT_KINDS, type Catalog, type EntryKind } from '../../data/types';
import { isTypingTarget } from '../../hooks/useGlobalShortcuts';
import { en } from '../../i18n/en';
import { navigate, paths } from '../../router';
import { entryHref, entryPlugin, type CatalogSearch, type Entry } from '../../search/searchIndex';

const KIND_ORDER: EntryKind[] = ['plugin', ...ARTIFACT_KINDS];

interface Props {
  catalog: Catalog;
  search: CatalogSearch;
  q: string;
  kind: string | null;
  plugin: string | null;
}

function countBy<T extends string>(entries: Entry[], key: (e: Entry) => T): Map<T, number> {
  const counts = new Map<T, number>();
  for (const entry of entries) counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1);
  return counts;
}

export function Search({ catalog, search, q, kind, plugin }: Props) {
  const matches = useMemo(() => {
    const hits = search.run(q);
    if (q.trim()) return hits;
    return [...hits].sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || entryPlugin(a).localeCompare(entryPlugin(b)) || a.key.localeCompare(b.key),
    );
  }, [search, q]);

  const kindCounts = useMemo(() => countBy(matches.filter((e) => !plugin || entryPlugin(e) === plugin), (e) => e.kind), [matches, plugin]);
  const pluginCounts = useMemo(() => countBy(matches.filter((e) => !kind || e.kind === kind), entryPlugin), [matches, kind]);
  const results = useMemo(
    () => matches.filter((e) => (!kind || e.kind === kind) && (!plugin || entryPlugin(e) === plugin)),
    [matches, kind, plugin],
  );

  const [active, setActive] = useState(-1);
  const cards = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => setActive(-1), [q, kind, plugin]);
  useEffect(() => {
    if (active >= 0) cards.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const inSearchInput = Boolean(target?.hasAttribute('data-search-input'));
      if (isTypingTarget(target) && !inSearchInput) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (results.length === 0) return;
        e.preventDefault();
        setActive((i) => (e.key === 'ArrowDown' ? Math.min(results.length - 1, i + 1) : Math.max(0, i - 1)));
      } else if (e.key === 'Enter' && (inSearchInput || target === document.body)) {
        const entry = results[active >= 0 ? active : 0];
        if (entry) {
          e.preventDefault();
          navigate(entryHref(entry));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, active]);

  const setFacet = (nextKind: string | null, nextPlugin: string | null) => navigate(paths.search(q, nextKind, nextPlugin), { replace: true });

  return (
    <main className="page search-layout">
      <aside className="facets" aria-label={en.search.filters}>
        <div className="facets-head">
          <span className="facets-title">{en.search.filters}</span>
          {(kind || plugin) && (
            <button type="button" className="link-btn" onClick={() => setFacet(null, null)}>
              {en.search.reset}
            </button>
          )}
        </div>
        <div className="facet-label">{en.search.kind}</div>
        <div className="facet-list">
          {KIND_ORDER.filter((k) => (kindCounts.get(k) ?? 0) > 0 || k === kind).map((k) => (
            <button
              key={k}
              type="button"
              className="facet"
              data-kind={k}
              aria-pressed={kind === k}
              onClick={() => setFacet(kind === k ? null : k, plugin)}
            >
              <span className="dot" />
              <span className="facet-name">{en.kinds[k].title}</span>
              <span className="facet-count">{kindCounts.get(k) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="facet-label">{en.search.plugin}</div>
        <div className="facet-list">
          {catalog.index.plugins
            .filter((p) => (pluginCounts.get(p.name) ?? 0) > 0 || p.name === plugin)
            .map((p) => (
              <button
                key={p.name}
                type="button"
                className="facet"
                aria-pressed={plugin === p.name}
                onClick={() => setFacet(kind, plugin === p.name ? null : p.name)}
              >
                <span className="facet-name mono">{p.name}</span>
                <span className="facet-count">{pluginCounts.get(p.name) ?? 0}</span>
              </button>
            ))}
        </div>
      </aside>

      <section>
        <div className="results-head">
          <div>
            <h1>{q.trim() ? en.search.resultsFor(q.trim()) : en.search.allResults}</h1>
            <div className="dim">{en.search.count(results.length)}</div>
          </div>
          <span className="kbd">{en.search.keyboardHint}</span>
        </div>
        {results.length > 0 ? (
          <div className="card-grid">
            {results.map((entry, i) => (
              <EntryCard
                key={entry.key}
                entry={entry}
                catalog={catalog}
                active={i === active}
                cardRef={(el) => {
                  cards.current[i] = el;
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>{en.search.noResultsTitle}</h3>
            <p>{en.search.noResultsText}</p>
            <button type="button" className="btn btn-md" onClick={() => setFacet(null, null)}>
              {en.search.resetFilters}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
