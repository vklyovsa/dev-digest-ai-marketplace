export const ARTIFACT_KINDS = ['agent', 'skill', 'command', 'hook', 'mcp'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type EntryKind = 'plugin' | ArtifactKind;

export interface Dependency {
  name: string;
  version: string | null;
}

export interface Plugin {
  name: string;
  version: string | null;
  description: string;
  author: string | null;
  license: string | null;
  keywords: string[];
  category: string | null;
  source: string;
  dependencies: Dependency[];
  dependents: string[];
  compatibility: string | null;
  install: string;
  readme: string;
  changelog: string | null;
  artifacts: string[];
  text: string;
}

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  name: string;
  plugin: string;
  description: string;
  model: string | null;
  tools: string[];
  manual: boolean;
  invoke: string | null;
  path: string;
  body: string;
  files: string[];
  text: string;
}

export interface MarketplaceInfo {
  name: string;
  owner: string | null;
  repo: string | null;
  description: string;
}

export interface CatalogIndex {
  generatedAt: string;
  commit: string | null;
  marketplace: MarketplaceInfo;
  plugins: Plugin[];
  artifacts: Artifact[];
}

export interface Release {
  plugin: string;
  version: string;
  date: string | null;
  tag: string;
  tagged: boolean;
  notes: string;
}

export interface Stats {
  plugins: number;
  agents: number;
  skills: number;
  commands: number;
  hooks: number;
  mcp: number;
  artifacts: number;
  dependencyEdges: number;
  latestRelease: { plugin: string; version: string; date: string | null } | null;
  generatedAt: string;
}

export interface Catalog {
  index: CatalogIndex;
  releases: Release[];
  stats: Stats;
  pluginsByName: Map<string, Plugin>;
  artifactsById: Map<string, Artifact>;
}
