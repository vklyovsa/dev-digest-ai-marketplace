import { InstallCommand } from '../../components/InstallCommand/InstallCommand';
import { MarkdownBody } from '../../components/Markdown/Markdown';
import { ReleaseItem } from '../../components/ReleaseRow/ReleaseRow';
import { pluginArtifacts, sourceUrl, treeUrl } from '../../data/catalog';
import { ARTIFACT_KINDS, type Catalog } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';
import { NotFound } from '../NotFound/NotFound';

interface Props {
  catalog: Catalog;
  name: string;
}

export function Plugin({ catalog, name }: Props) {
  const plugin = catalog.pluginsByName.get(name);
  if (!plugin) return <NotFound message={en.plugin.notFound(name)} />;

  const artifacts = pluginArtifacts(catalog, plugin);
  const groups = ARTIFACT_KINDS.map((kind) => ({ kind, items: artifacts.filter((a) => a.kind === kind) })).filter((g) => g.items.length);
  const releases = catalog.releases.filter((r) => r.plugin === plugin.name);
  const githubUrl = treeUrl(catalog, plugin.source);
  const meta = [
    plugin.author && `${en.plugin.by} ${plugin.author}`,
    plugin.license && `${en.plugin.license}: ${plugin.license}`,
    plugin.category && `${en.plugin.category}: ${plugin.category}`,
  ].filter(Boolean);

  return (
    <main className="page page-narrow">
      <a className="back-link" href={paths.search()}>
        {en.common.back}
      </a>
      <div className="detail-head">
        <div className="detail-icon" aria-hidden="true">
          ◆
        </div>
        <div>
          <div className="detail-title-row">
            <h1 className="h1">{plugin.name}</h1>
            {plugin.version && (
              <span className="badge badge-lg" data-kind="plugin">
                v{plugin.version}
              </span>
            )}
            {plugin.compatibility && (
              <span className="badge badge-lg" data-kind="ok">
                ✓ {plugin.compatibility}
              </span>
            )}
          </div>
          <p className="lead">{plugin.description}</p>
          {meta.length > 0 && <div className="detail-meta">{meta.join(' · ')}</div>}
        </div>
      </div>

      <InstallCommand command={plugin.install}>
        {githubUrl && (
          <a className="btn btn-lg" href={githubUrl} target="_blank" rel="noopener noreferrer">
            {en.common.viewOnGithub}
          </a>
        )}
      </InstallCommand>

      <div className="two-col section">
        <section>
          <h2 className="section-title">{en.plugin.dependencies}</h2>
          {plugin.dependencies.length === 0 ? (
            <p className="faint">{en.plugin.noDependencies}</p>
          ) : (
            <div className="pills">
              {plugin.dependencies.map((dep) => {
                const label = `${dep.name}${dep.version ? ` ${dep.version}` : ''}`;
                return catalog.pluginsByName.has(dep.name) ? (
                  <a key={dep.name} className="pill" href={paths.plugin(dep.name)}>
                    {label}
                  </a>
                ) : (
                  <span key={dep.name} className="pill" title={en.plugin.externalDependency}>
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </section>
        <section>
          <h2 className="section-title">{en.plugin.dependents}</h2>
          {plugin.dependents.length === 0 ? (
            <p className="faint">{en.plugin.noDependents}</p>
          ) : (
            <div className="pills">
              {plugin.dependents.map((dependent) => (
                <a key={dependent} className="pill" href={paths.plugin(dependent)}>
                  {dependent}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section">
        <h2 className="section-title">{en.plugin.components}</h2>
        {groups.length === 0 && <p className="faint">{en.plugin.noComponents}</p>}
        {groups.map((group) => (
          <div key={group.kind} className="group" data-kind={group.kind}>
            <div className="group-head">
              <span className="dot" />
              <span className="group-title">{en.kinds[group.kind].title}</span>
              <span className="mono faint">{group.items.length}</span>
            </div>
            <div className="mini-grid">
              {group.items.map((artifact) => (
                <a key={artifact.id} className="mini-card" href={paths.artifact(artifact.id)}>
                  <div className="mini-card-top">
                    <span className="mini-card-name">{artifact.name}</span>
                    {artifact.invoke && <span className="mini-card-invoke">{artifact.invoke}</span>}
                  </div>
                  <div className="mini-card-desc">{artifact.description}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2 className="section-title">{en.plugin.readme}</h2>
        <div className="panel">
          <MarkdownBody path={plugin.readme} baseUrl={sourceUrl(catalog, `${plugin.source}/README.md`)} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{en.plugin.changelog}</h2>
        {releases.length > 0 ? (
          <div className="rows">
            {releases.map((release) => (
              <ReleaseItem key={release.tag} release={release} showPlugin={false} />
            ))}
          </div>
        ) : plugin.changelog ? (
          <div className="panel">
            <MarkdownBody path={plugin.changelog} baseUrl={sourceUrl(catalog, `${plugin.source}/CHANGELOG.md`)} />
          </div>
        ) : (
          <p className="faint">{en.plugin.noChangelog}</p>
        )}
      </section>
    </main>
  );
}
