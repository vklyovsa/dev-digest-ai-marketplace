import { InstallCommand } from '../../components/InstallCommand/InstallCommand';
import { KindBadge } from '../../components/KindBadge/KindBadge';
import { MarkdownBody } from '../../components/Markdown/Markdown';
import { sourceUrl } from '../../data/catalog';
import type { Catalog } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';
import { NotFound } from '../NotFound/NotFound';

interface Props {
  catalog: Catalog;
  id: string;
}

export function Artifact({ catalog, id }: Props) {
  const artifact = catalog.artifactsById.get(id);
  if (!artifact) return <NotFound message={en.artifact.notFound(id)} />;
  const plugin = catalog.pluginsByName.get(artifact.plugin);
  const fileUrl = sourceUrl(catalog, artifact.path);
  const dirPath = artifact.path.slice(0, artifact.path.lastIndexOf('/'));

  return (
    <main className="page page-narrow">
      <nav className="breadcrumb">
        <a href={paths.search()}>{en.artifact.catalog}</a>
        <span className="sep">/</span>
        <a href={paths.plugin(artifact.plugin)}>{artifact.plugin}</a>
        <span className="sep">/</span>
        <span>{artifact.name}</span>
      </nav>
      <div className="detail-title-row">
        <KindBadge kind={artifact.kind} large />
        <h1 className="h1 mono">{artifact.id}</h1>
        {artifact.invoke && <span className="invoke">{artifact.invoke}</span>}
      </div>
      <p className="lead">{artifact.description}</p>

      {artifact.model && (
        <>
          <div className="subtitle">{en.artifact.model}</div>
          <div className="pills">
            <span className="pill">{artifact.model}</span>
          </div>
        </>
      )}
      {artifact.tools.length > 0 && (
        <>
          <div className="subtitle">{en.artifact.tools}</div>
          <div className="pills">
            {artifact.tools.map((tool) => (
              <span key={tool} className="pill">
                {tool}
              </span>
            ))}
          </div>
        </>
      )}
      {artifact.manual && (
        <div className="pills pills-spaced">
          <span className="badge" data-kind="command">
            {en.artifact.manual}
          </span>
        </div>
      )}

      {plugin && (
        <>
          <div className="subtitle">{en.artifact.installHint(plugin.name)}</div>
          <InstallCommand command={plugin.install}>
            {fileUrl && (
              <a className="btn btn-lg" href={fileUrl} target="_blank" rel="noopener noreferrer">
                {en.common.viewSource}
              </a>
            )}
          </InstallCommand>
        </>
      )}

      {artifact.files.length > 0 && (
        <section className="section">
          <h2 className="section-title">{en.artifact.files}</h2>
          <ul className="files panel">
            {artifact.files.map((file) => {
              const url = sourceUrl(catalog, `${dirPath}/${file}`);
              return <li key={file}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{file}</a> : file}</li>;
            })}
          </ul>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">{en.artifact.documentation}</h2>
        <div className="panel">
          <MarkdownBody path={artifact.body} baseUrl={fileUrl} />
        </div>
      </section>
    </main>
  );
}
