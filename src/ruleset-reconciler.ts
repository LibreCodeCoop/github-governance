import type { RepositoryRuleset } from './types.js';
import { rulesetsEqual } from './ruleset-normalizer.js';

export type ExistingRepositoryRuleset = RepositoryRuleset & {
  id: number;
};

export interface RepositoryRulesetClient {
  list(owner: string, repository: string): Promise<ExistingRepositoryRuleset[]>;
  create(
    owner: string,
    repository: string,
    ruleset: RepositoryRuleset,
  ): Promise<void>;
  update(
    owner: string,
    repository: string,
    id: number,
    ruleset: RepositoryRuleset,
  ): Promise<void>;
}

export type RulesetChange =
  | { action: 'create'; desired: RepositoryRuleset }
  | {
      action: 'update';
      id: number;
      current: ExistingRepositoryRuleset;
      desired: RepositoryRuleset;
    }
  | { action: 'unchanged'; current: ExistingRepositoryRuleset };

export function planRepositoryRulesets(
  existing: ExistingRepositoryRuleset[],
  desiredRulesets: RepositoryRuleset[],
): RulesetChange[] {
  const byName = new Map(existing.map((ruleset) => [ruleset.name, ruleset]));

  return desiredRulesets.map((desired): RulesetChange => {
    const current = byName.get(desired.name);

    if (!current) {
      return { action: 'create', desired };
    }

    if (rulesetsEqual(current, desired)) {
      return { action: 'unchanged', current };
    }

    return {
      action: 'update',
      id: current.id,
      current,
      desired,
    };
  });
}

export type ReconcileResult = {
  created: string[];
  updated: string[];
  unchanged: string[];
};

export async function reconcileRepositoryRulesets(
  client: RepositoryRulesetClient,
  owner: string,
  repository: string,
  desiredRulesets: RepositoryRuleset[],
): Promise<ReconcileResult> {
  const changes = planRepositoryRulesets(
    await client.list(owner, repository),
    desiredRulesets,
  );

  const result: ReconcileResult = {
    created: [],
    updated: [],
    unchanged: [],
  };

  for (const change of changes) {
    if (change.action === 'create') {
      await client.create(owner, repository, change.desired);
      result.created.push(change.desired.name);
      continue;
    }

    if (change.action === 'update') {
      await client.update(owner, repository, change.id, change.desired);
      result.updated.push(change.desired.name);
      continue;
    }

    result.unchanged.push(change.current.name);
  }

  return result;
}
