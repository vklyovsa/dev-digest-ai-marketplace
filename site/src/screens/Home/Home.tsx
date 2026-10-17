import { useMemo } from 'react';
import { EntryCard } from '../../components/EntryCard/EntryCard';
import { ReleaseRow } from '../../components/ReleaseRow/ReleaseRow';
import { StatTiles } from '../../components/StatTiles/StatTiles';
import { ARTIFACT_KINDS, type Catalog } from '../../data/types';
import { focusGlobalSearch } from '../../hooks/useGlobalShortcuts';
import { en } from '../../i18n/en';
import { navigate, paths } from '../../router';
import type { Entry } from '../../search/searchIndex';

const LATEST_RELEASES = 4;
const HERO_KEYWORDS = 8;

interface Props {
  catalog: Catalog;
}

export function Home({ catalog }: Props) {
  const { index, stats, releases } = catalog;
  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of index.plugins) for (const kw of plugin.keywords) counts.set(kw, (counts.get(kw) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, HERO_KEYWORDS).map(([kw]) => kw);
  }, [index.plugins]);
  const pluginEntries = useMemo<Entry[]>(
    () => index.plugins.map((plugin) => ({ key: `p/${plugin.name}`, kind: 'plugin', plugin })),
    [index.plugins],
  );
  const kindCounts = ARTIFACT_KINDS.map((kind) => ({ kind, count: index.artifacts.filter((a) => a.kind === kind).length })).filter(
    (k) => k.count > 0,
  );

  return (
    <main className="page page-home">
      <section className="hero">
        <div className="eyebrow">{en.home.eyebrow}</div>
        <h1>{en.home.title}</h1>
        <p>{en.home.lead}</p>
        <div className="hero-search">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            data-search-input
            type="search"
            autoComplete="off"
            aria-label={en.header.searchLabel}
            placeholder={en.home.heroPlaceholder}
            value=""
            onChange={(e) => {
              navigate(paths.search(e.target.value));
              requestAnimationFrame(() => focusGlobalSearch());
            }}
          />
        </div>
        {keywords.length > 0 && (
          <div className="chips">
            {keywords.map((kw) => (
              <a key={kw} className="chip" href={paths.search(kw)}>
                #{kw}
              </a>
            ))}
          </div>
        )}
      </section>

      {index.plugins.length === 0 ? (
        <section className="empty">
          <h2>{en.home.emptyTitle}</h2>
          <p>{en.home.emptyText}</p>
          <a className="btn btn-primary btn-md" href={paths.gettingStarted()}>
            {en.home.emptyCta}
          </a>
        </section>
      ) : (
        <>
          <StatTiles stats={stats} />

          <section className="section">
            <h2 className="section-title">{en.home.plugins}</h2>
            <div className="card-grid">
              {pluginEntries.map((entry) => (
                <EntryCard key={entry.key} entry={entry} catalog={catalog} />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">{en.home.whatsNew}</h2>
              <a className="dim" href={paths.whatsNew()}>
                {en.home.allReleases}
              </a>
            </div>
            {releases.length === 0 ? (
              <p className="faint">{en.home.noReleases}</p>
            ) : (
              <div className="rows">
                {releases.slice(0, LATEST_RELEASES).map((release) => (
                  <ReleaseRow key={release.tag} release={release} />
                ))}
              </div>
            )}
          </section>

          {kindCounts.length > 0 && (
            <section className="section">
              <h2 className="section-title">{en.home.browse}</h2>
              <div className="kind-buttons">
                {kindCounts.map(({ kind, count }) => (
                  <a key={kind} className="kind-button" href={paths.search('', kind)} data-kind={kind}>
                    <span className="dot" />
                    <span>{en.kinds[kind].title}</span>
                    <span className="mono faint">{count}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
