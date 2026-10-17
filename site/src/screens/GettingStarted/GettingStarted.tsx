import { InstallCommand } from '../../components/InstallCommand/InstallCommand';
import type { Catalog } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';

const FALLBACK_REPO = 'vklyovsa/dev-digest-ai-marketplace';

interface Props {
  catalog: Catalog;
}

export function GettingStarted({ catalog }: Props) {
  const { marketplace } = catalog.index;
  const repo = marketplace.repo ?? FALLBACK_REPO;
  const mp = marketplace.name;
  const plugin = catalog.index.plugins[0]?.name ?? en.gettingStarted.pluginPlaceholder;
  const version = catalog.pluginsByName.get(plugin)?.version ?? en.gettingStarted.versionPlaceholder;
  const s = en.gettingStarted.steps;

  const steps = [
    { ...s.add, commands: [`/plugin marketplace add ${repo}`] },
    { ...s.install, commands: [`/plugin install ${plugin}@${mp}`] },
    { ...s.update, commands: [`claude plugin marketplace update ${mp}`, `claude plugin update ${plugin}@${mp}`] },
    {
      ...s.rollback,
      commands: [
        `claude plugin marketplace remove ${mp}`,
        `claude plugin marketplace add ${repo}#${plugin}--v${version}`,
        `claude plugin install ${plugin}@${mp}`,
      ],
    },
  ];

  return (
    <main className="page page-text">
      <a className="back-link" href={paths.home()}>
        {en.common.home}
      </a>
      <h1 className="h1">{en.gettingStarted.title}</h1>
      <p className="lead">{en.gettingStarted.lead}</p>
      <ol className="steps">
        {steps.map((step, i) => (
          <li key={step.title} className="step">
            <div className="step-n">{i + 1}</div>
            <div className="step-main">
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              {step.commands.map((cmd) => (
                <InstallCommand key={cmd} command={cmd} size="inline" />
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="note">
        <strong>{en.gettingStarted.note}</strong> {en.gettingStarted.noteText}
      </div>
    </main>
  );
}
