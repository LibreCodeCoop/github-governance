import type {
  RepositoryMetadata,
  GitHubContentProbe,
} from './repository-classifier.js';
import type {
  ExistingRepositoryRuleset,
  RepositoryRulesetClient,
} from './ruleset-reconciler.js';
import type {
  BypassActor,
  RepositoryRuleset,
  RulesetRule,
} from './types.js';

type FetchLike = typeof fetch;

type GitHubRepository = {
  name?: unknown;
  archived?: unknown;
  visibility?: unknown;
  owner?: {
    login?: unknown;
  };
};

type RulesetSummary = {
  id?: unknown;
  source_type?: unknown;
};

export class GitHubClient
  implements GitHubContentProbe, RepositoryRulesetClient
{
  constructor(
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly apiUrl = 'https://api.github.com',
  ) {}

  async getRepository(
    owner: string,
    repository: string,
  ): Promise<RepositoryMetadata> {
    const data = await this.requestJson<GitHubRepository>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
    );

    const name = data.name;
    const login = data.owner?.login;
    const visibility = data.visibility;
    const archived = data.archived;

    if (
      login !== owner ||
      name !== repository ||
      !(
        visibility === 'public' ||
        visibility === 'private' ||
        visibility === 'internal'
      ) ||
      typeof archived !== 'boolean'
    ) {
      throw new Error(`Invalid repository response for ${owner}/${repository}`);
    }

    return {
      owner: login,
      name,
      visibility,
      archived,
    };
  }

  async listManagedRepositories(
    organization: string,
  ): Promise<RepositoryMetadata[]> {
    const result: RepositoryMetadata[] = [];

    for (let page = 1; ; page += 1) {
      const response = await this.requestJson<{
        repositories?: GitHubRepository[];
      }>(
        `/installation/repositories?per_page=100&page=${page}`,
      );
      const repositories = response.repositories ?? [];

      for (const repository of repositories) {
        const owner = repository.owner?.login;
        const name = repository.name;
        const visibility = repository.visibility;
        const archived = repository.archived;

        if (
          owner === organization &&
          typeof name === 'string' &&
          (visibility === 'public' ||
            visibility === 'private' ||
            visibility === 'internal') &&
          typeof archived === 'boolean'
        ) {
          result.push({
            owner,
            name,
            visibility,
            archived,
          });
        }
      }

      if (repositories.length < 100) {
        break;
      }
    }

    return result.filter(
      (repository) =>
        repository.visibility === 'public' && !repository.archived,
    );
  }

  async exists(
    owner: string,
    repository: string,
    path: string,
  ): Promise<boolean> {
    const response = await this.fetchImpl(
      this.url(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      ),
      {
        headers: this.headers(),
      },
    );

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw new Error(
        `GitHub content probe failed with HTTP ${response.status} for ${owner}/${repository}:${path}`,
      );
    }

    return true;
  }

  async list(
    owner: string,
    repository: string,
  ): Promise<ExistingRepositoryRuleset[]> {
    const summaries = await this.requestJson<RulesetSummary[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/rulesets?per_page=100`,
    );

    const rulesets: ExistingRepositoryRuleset[] = [];

    for (const summary of summaries) {
      if (
        summary.source_type !== 'Repository' ||
        typeof summary.id !== 'number'
      ) {
        continue;
      }

      const detail = await this.requestJson<unknown>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/rulesets/${summary.id}`,
      );
      rulesets.push(parseExistingRuleset(detail));
    }

    return rulesets;
  }

  async create(
    owner: string,
    repository: string,
    ruleset: RepositoryRuleset,
  ): Promise<void> {
    await this.requestJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/rulesets`,
      {
        method: 'POST',
        body: JSON.stringify(ruleset),
      },
    );
  }

  async update(
    owner: string,
    repository: string,
    id: number,
    ruleset: RepositoryRuleset,
  ): Promise<void> {
    await this.requestJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/rulesets/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(ruleset),
      },
    );
  }

  private async requestJson<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this.fetchImpl(this.url(path), {
      ...init,
      headers: {
        ...this.headers(),
        ...(init.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}${
          body === '' ? '' : `: ${body}`
        }`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2026-03-10',
    };
  }

  private url(path: string): string {
    return `${this.apiUrl}${path}`;
  }
}

function parseExistingRuleset(value: unknown): ExistingRepositoryRuleset {
  if (!isRecord(value)) {
    throw new Error('Invalid ruleset response from GitHub');
  }

  const id = value.id;
  const name = value.name;
  const target = value.target;
  const enforcement = value.enforcement;
  const conditions = value.conditions;

  if (
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    target !== 'branch' ||
    !(
      enforcement === 'active' ||
      enforcement === 'disabled' ||
      enforcement === 'evaluate'
    ) ||
    !isRecord(conditions) ||
    !isRecord(conditions.ref_name)
  ) {
    throw new Error('Invalid ruleset response from GitHub');
  }

  const bypassActors = Array.isArray(value.bypass_actors)
    ? value.bypass_actors.map(parseBypassActor)
    : [];
  const rules = Array.isArray(value.rules)
    ? value.rules.map(parseRule)
    : [];

  return {
    id,
    name,
    target,
    enforcement,
    bypass_actors: bypassActors,
    conditions: {
      ref_name: {
        include: stringArray(conditions.ref_name.include),
        exclude: stringArray(conditions.ref_name.exclude),
      },
    },
    rules,
  };
}

function parseBypassActor(value: unknown): BypassActor {
  if (!isRecord(value)) {
    throw new Error('Invalid bypass actor from GitHub');
  }

  const actorType = value.actor_type;
  const bypassMode = value.bypass_mode;
  const actorId = value.actor_id;

  if (
    !(
      actorType === 'OrganizationAdmin' ||
      actorType === 'User' ||
      actorType === 'Team' ||
      actorType === 'Integration'
    ) ||
    !(bypassMode === 'always' || bypassMode === 'pull_request') ||
    !(typeof actorId === 'number' || actorId === null)
  ) {
    throw new Error('Invalid bypass actor from GitHub');
  }

  return {
    actor_id: actorId ?? 0,
    actor_type: actorType,
    bypass_mode: bypassMode,
  };
}

function parseRule(value: unknown): RulesetRule {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Invalid ruleset rule from GitHub');
  }

  if (value.type === 'deletion' || value.type === 'non_fast_forward') {
    return { type: value.type };
  }

  if (value.type === 'pull_request' && isRecord(value.parameters)) {
    const parameters = value.parameters;
    const allowedMergeMethods = stringArray(parameters.allowed_merge_methods);

    if (
      !allowedMergeMethods.every(
        (method) =>
          method === 'merge' || method === 'squash' || method === 'rebase',
      )
    ) {
      throw new Error('Invalid merge method from GitHub');
    }

    return {
      type: 'pull_request',
      parameters: {
        allowed_merge_methods: allowedMergeMethods as Array<
          'merge' | 'squash' | 'rebase'
        >,
        dismiss_stale_reviews_on_push: boolean(
          parameters.dismiss_stale_reviews_on_push,
        ),
        require_code_owner_review: boolean(
          parameters.require_code_owner_review,
        ),
        require_last_push_approval: boolean(
          parameters.require_last_push_approval,
        ),
        required_approving_review_count: number(
          parameters.required_approving_review_count,
        ),
        required_review_thread_resolution: boolean(
          parameters.required_review_thread_resolution,
        ),
      },
    };
  }

  if (
    value.type === 'required_status_checks' &&
    isRecord(value.parameters)
  ) {
    const parameters = value.parameters;
    const checks = Array.isArray(parameters.required_status_checks)
      ? parameters.required_status_checks.map((check) => {
          if (!isRecord(check) || typeof check.context !== 'string') {
            throw new Error('Invalid required status check from GitHub');
          }
          return { context: check.context };
        })
      : [];

    return {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: checks,
        strict_required_status_checks_policy: boolean(
          parameters.strict_required_status_checks_policy,
        ),
        do_not_enforce_on_create: boolean(
          parameters.do_not_enforce_on_create,
        ),
      },
    };
  }

  throw new Error(`Unsupported managed ruleset rule: ${value.type}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Expected an array of strings from GitHub');
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error('Expected a boolean from GitHub');
  }
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('Expected a number from GitHub');
  }
  return value;
}
