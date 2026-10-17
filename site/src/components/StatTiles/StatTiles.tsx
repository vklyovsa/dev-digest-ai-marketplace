import type { Stats } from '../../data/types';
import { en } from '../../i18n/en';
import { paths } from '../../router';

interface Props {
  stats: Stats;
}

export function StatTiles({ stats }: Props) {
  const tiles = [
    { kind: 'plugin', count: stats.plugins, label: en.stats.plugins },
    { kind: 'skill', count: stats.skills, label: en.stats.skills },
    { kind: 'agent', count: stats.agents, label: en.stats.agents },
    { kind: 'command', count: stats.commands, label: en.stats.commands },
    { kind: 'hook', count: stats.hooks, label: en.stats.hooks },
    { kind: 'mcp', count: stats.mcp, label: en.stats.mcp },
  ] as const;
  return (
    <section className="tiles">
      {tiles.map((tile) => (
        <a key={tile.kind} className="tile" href={paths.search('', tile.kind)} data-kind={tile.kind}>
          <div className="tile-count">{tile.count}</div>
          <div className="tile-label">{tile.label}</div>
        </a>
      ))}
    </section>
  );
}
