# Worked examples

Refactors of a Fastify + Drizzle backend, shown before and after. Read them as the
shape to reproduce; the names are illustrative.

## 1. A route that owns the query and the wire shape

### Before — `src/modules/workspace/routes.ts`

```ts
import { eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

export default async function workspaceRoutes(app: FastifyInstance) {
  const { container } = app;

  app.get('/workspace', async (req) => {
    const { workspaceId } = await getContext(container, req);
    const repos = await container.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.workspaceId, workspaceId));
    return {
      workspaceId,
      cloneDir: container.config.cloneDir,
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  });
}
```

Three rings in one function: the SQL (adapter), "a repo counts as cloned when it has a
clone path" (domain), and the snake_case wire mapping (transport).

### After

```ts
// modules/workspace/repository.ts — driven adapter
export class DrizzleWorkspaceRepository implements WorkspaceRepositoryPort {
  constructor(private readonly db: Db) {}

  async listRepos(workspaceId: string): Promise<WorkspaceRepo[]> {
    const rows = await this.db.select().from(t.repos)
      .where(eq(t.repos.workspaceId, workspaceId));
    return rows.map(toWorkspaceRepo);
  }
}
```

```ts
// modules/workspace/service.ts — use case
export class WorkspaceService {
  constructor(
    private readonly repos: WorkspaceRepositoryPort,
    private readonly cloneDir: string,
  ) {}

  async overview(workspaceId: string): Promise<WorkspaceOverview> {
    return { workspaceId, cloneDir: this.cloneDir, repos: await this.repos.listRepos(workspaceId) };
  }
}
```

```ts
// modules/workspace/helpers.ts — pure mapping, domain → wire
export const workspaceToDto = (o: WorkspaceOverview) => ({
  workspaceId: o.workspaceId,
  cloneDir: o.cloneDir,
  repos: o.repos.map((r) => ({
    id: r.id,
    full_name: r.fullName,
    clone_path: r.clonePath,
    last_polled_at: r.lastPolledAt?.toISOString() ?? null,
    cloned: r.isCloned,
  })),
});
```

```ts
// modules/workspace/routes.ts — driving adapter, one call
export default async function workspaceRoutes(app: FastifyInstance) {
  const service = app.container.workspaceService;

  app.get('/workspace', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return workspaceToDto(await service.overview(workspaceId));
  });
}
```

`isCloned` moved into the domain type, so the rule is stated once and is testable
without Postgres.

## 2. A route that orchestrates an import

A `src/modules/pulls/routes.ts` that does more: it reads a repo, resolves a GitHub
client, tolerates its absence, upserts every PR, then derives review status and a
findings summary. That is a use case with a fallback policy, written at the transport
layer.

The split, without repeating the body:

| Concern in the route | Ring | Destination |
|---|---|---|
| `select ... from repos where id = ?` | adapter | `RepoRepositoryPort.findById` |
| `container.github()` failing → serve persisted PRs | application | `PullsService.listForRepo` |
| `insert into pull_requests ... on conflict` | adapter | `PullsRepositoryPort.upsertMany` |
| `deriveReviewStatus`, `scoreForFindings` | domain | already pure — keep, move under `domain/` |
| snake_case `PrMeta` shaping | transport | `helpers.ts` |

"Never fail the read — already-imported PRs stay viewable offline" is a business policy
and belongs in the service, where it can be asserted with a stubbed GitHub port.

## 3. Container in a constructor → named ports

### Before — `src/modules/reviews/service.ts`

```ts
export class ReviewService {
  constructor(private container: Container) {
    this.repo = new ReviewRepository(container.db);
    this.agents = container.agentsRepo;
    this.executor = new ReviewRunExecutor(container, this.repo, this.agents);
  }

  async resolveTargets(workspaceId: string, opts: Opts): Promise<AgentRow[]> { /* ... */ }
}
```

Two violations: the whole container is the dependency, and `AgentRow`
(`typeof agents.$inferSelect`) is persistence in an application signature.

### After

```ts
export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepositoryPort,
    private readonly agents: AgentsRepositoryPort,
    private readonly executor: ReviewRunExecutorPort,
  ) {}

  async resolveTargets(workspaceId: string, opts: Opts): Promise<Agent[]> { /* ... */ }
}
```

```ts
// platform/container.ts — the only place that constructs
get reviewService(): ReviewService {
  return (this._reviewService ??= new ReviewService(
    this.reviewRepo,
    this.agentsRepo,
    this.reviewExecutor,
  ));
}
```

The unit test drops from "build a container with overrides" to "hand it three fakes".

## Migration order

The recipe for moving an existing backend onto these rules, one phase at a time:

| Phase | Work | Outcome |
|---|---|---|
| 0 | agree the layer map (`mapping.md`) | the rules have local names |
| 1 | dependency-cruiser config at `warn` + `arch:check` + CI step | a measured baseline of violations |
| 2 | lift the modules whose routes query the DB onto service + repository | the count drops |
| 3 | replace `Container` constructor params with consumer-declared ports | cycles through the container disappear |
| 4 | take row types out of transport and public service signatures | domain types on every boundary |
| 5 | flip each rule to `error` once its count reaches zero | a new violation fails CI |

The order matters. Phase 3 is only obvious after Phase 2: the ports each service needs
cannot be named while routes still bypass the services entirely. And a
`service.ts → container.ts → service.ts` cycle does not disappear by moving code — it
disappears the moment the module declares its own deps interface and stops importing
the composition root at all.

## 4. Consumer-declared ports, in practice

The pattern that carries Phases 2–3. The consumer writes the interface describing only
the slice it needs; the concrete class satisfies it structurally, with no import either
way and no registration step:

```ts
// modules/workspace/service.ts — the consumer states its need
export interface WorkspaceRepoReader {
  list(workspaceId: string): Promise<
    { id: string; fullName: string; clonePath: string | null; lastPolledAt: Date | null }[]
  >;
}
```

`RepoRepository.list` returns rows with more fields than that, which TypeScript accepts.
Any other module can do the same with a one- or two-method interface of its own, or a
`<Module>Deps` interface listing the capabilities the `Container` happens to have.

This is what keeps `no-cross-module-internals` satisfiable: `workspace` never imports
`repos/repository.ts`, it just describes the two fields it reads.
