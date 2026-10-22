// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RepositoryRuleset } from './types.ts';
import { rulesetsEqual } from './ruleset-normalizer.ts';

export type ExistingRepositoryRuleset = RepositoryRuleset & {
  id: number;
  // GitHub hides bypass_actors unless the caller can write the ruleset.
  bypass_actors_redacted?: boolean;
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
  | { action: 'unchanged'; current: ExistingRepositoryRuleset }
  | { action: 'unverified'; current: ExistingRepositoryRuleset; desired: RepositoryRuleset };

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

    if (current.bypass_actors_redacted) {
      // Compare only the fields GitHub actually exposed; bypass must be verified by Apply.
      if (rulesetsEqual({ ...current, bypass_actors: desired.bypass_actors }, desired)) {
        return { action: 'unverified', current, desired };
      }
    } else if (rulesetsEqual(current, desired)) {
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

  const redacted = changes.find((change) => change.action === 'unverified');
  if (redacted) {
    throw new Error(`Cannot apply with hidden bypass actors: ${redacted.current.name}`);
  }

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
