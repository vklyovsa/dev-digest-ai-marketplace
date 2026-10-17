import { ReleaseItem } from '../../components/ReleaseRow/ReleaseRow';
import type { Release } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';

interface Props {
  releases: Release[];
}

export function WhatsNew({ releases }: Props) {
  return (
    <main className="page page-text">
      <a className="back-link" href={paths.home()}>
        {en.common.home}
      </a>
      <h1 className="h1">{en.whatsNew.title}</h1>
      <p className="lead lead-spaced">
        {en.whatsNew.lead}
      </p>
      {releases.length === 0 ? (
        <p className="faint">{en.whatsNew.empty}</p>
      ) : (
        <div className="rows">
          {releases.map((release) => (
            <ReleaseItem key={release.tag} release={release} />
          ))}
        </div>
      )}
    </main>
  );
}
