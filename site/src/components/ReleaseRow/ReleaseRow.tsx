import type { Release } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';
import { MarkdownText } from '../Markdown/Markdown';

export function releaseSummary(notes: string): string {
  const line = notes
    .split('\n')
    .map((l) => l.replace(/^#+\s*|^[-*+]\s+/, '').replace(/[`*_]/g, '').trim())
    .find((l) => l && !/^(added|changed|fixed|removed|deprecated|security)$/i.test(l));
  return line ?? '';
}

interface Props {
  release: Release;
}

export function ReleaseRow({ release }: Props) {
  return (
    <a className="row" href={paths.plugin(release.plugin)}>
      <span className="badge" data-kind="plugin">
        v{release.version}
      </span>
      <div className="row-main">
        <div className="row-title">{release.plugin}</div>
        <div className="row-sub">{releaseSummary(release.notes)}</div>
      </div>
      <span className="row-date">{release.date ?? en.whatsNew.undated}</span>
    </a>
  );
}

interface ItemProps {
  release: Release;
  showPlugin?: boolean;
}

export function ReleaseItem({ release, showPlugin = true }: ItemProps) {
  return (
    <article className="release">
      <div className="release-side">
        <div className="release-version">v{release.version}</div>
        <div className="release-date">{release.date ?? en.whatsNew.undated}</div>
      </div>
      <div className="release-main">
        <div className="release-title">
          {showPlugin && <a href={paths.plugin(release.plugin)}>{release.plugin}</a>}
          <span className="badge release-tag" data-kind={release.tagged ? 'ok' : 'muted'} title={release.tag}>
            {release.tagged ? `${en.plugin.tagged} ${release.tag}` : en.plugin.untagged}
          </span>
        </div>
        {release.notes && <MarkdownText source={release.notes} />}
      </div>
    </article>
  );
}
