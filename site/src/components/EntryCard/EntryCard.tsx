import type { Ref } from 'react';
import type { Catalog } from '../../data/types';
import { en } from '../../i18n/en';
import { entryHref, type Entry } from '../../search/searchIndex';
import { CopyButton } from '../CopyButton/CopyButton';
import { KindBadge } from '../KindBadge/KindBadge';

interface Props {
  entry: Entry;
  catalog: Catalog;
  active?: boolean;
  cardRef?: Ref<HTMLElement>;
}

export function EntryCard({ entry, catalog, active = false, cardRef }: Props) {
  const href = entryHref(entry);
  const plugin = entry.kind === 'plugin' ? entry.plugin : catalog.pluginsByName.get(entry.artifact.plugin);
  const title = entry.kind === 'plugin' ? entry.plugin.name : entry.artifact.id;
  const description = entry.kind === 'plugin' ? entry.plugin.description : entry.artifact.description;
  const version = plugin?.version ? `v${plugin.version}` : '';
  const meta =
    entry.kind === 'plugin'
      ? en.common.components(entry.plugin.artifacts.length)
      : (entry.artifact.invoke ?? entry.artifact.plugin);

  return (
    <article className="card" data-active={active} ref={cardRef}>
      <div className="card-body">
        <div className="card-top">
          <KindBadge kind={entry.kind} />
          <span className="mono faint">{version}</span>
        </div>
        <a href={href} className={`card-title${entry.kind === 'plugin' ? '' : ' mono'}`}>
          {title}
        </a>
        <p className="card-desc">{description}</p>
        {entry.kind === 'plugin' && entry.plugin.keywords.length > 0 && (
          <div className="card-keywords">
            {entry.plugin.keywords.slice(0, 4).map((kw) => (
              <span key={kw}>#{kw}</span>
            ))}
          </div>
        )}
      </div>
      <div className="card-foot">
        <span className="card-meta mono">{meta}</span>
        <div className="card-actions">
          {plugin && <CopyButton text={plugin.install} label={en.common.copyInstall} />}
          <a className="btn btn-primary" href={href}>
            {en.common.open}
          </a>
        </div>
      </div>
    </article>
  );
}
