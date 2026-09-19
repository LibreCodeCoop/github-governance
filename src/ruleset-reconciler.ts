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
  const existing = await client.list(owner, repository);
  const byName = new Map(existing.map((ruleset) => [ruleset.name, ruleset]));

  const result: ReconcileResult = {
    created: [],
    updated: [],
    unchanged: [],
  };

  for (const desired of desiredRulesets) {
    const current = byName.get(desired.name);

    if (!current) {
      await client.create(owner, repository, desired);
      result.created.push(desired.name);
      continue;
    }

    if (rulesetsEqual(current, desired)) {
      result.unchanged.push(desired.name);
      continue;
    }

    await client.update(owner, repository, current.id, desired);
    result.updated.push(desired.name);
  }

  return result;
}
