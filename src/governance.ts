// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  planRepositoryRulesets,
  reconcileRepositoryRulesets,
  type RepositoryRulesetClient,
  type RulesetChange,
} from './ruleset-reconciler.ts';
import type {
  GitHubContentProbe,
  RepositoryMetadata,
} from './repository-classifier.ts';
import type { RepositoryRuleset } from './types.ts';

export interface GovernanceClient
  extends GitHubContentProbe,
    RepositoryRulesetClient {
  getRepository(
    owner: string,
    repository: string,
  ): Promise<RepositoryMetadata>;
  listManagedRepositories(organization: string): Promise<RepositoryMetadata[]>;
}

export type RepositoryPlan = {
  repository: string;
  changes: RulesetChange[];
};

export type RepositoryPolicyResolver = (
  repository: RepositoryMetadata,
) => Promise<RepositoryRuleset[]> | RepositoryRuleset[];

export async function planRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  desiredRulesets: RepositoryRuleset[] = [],
): Promise<RepositoryPlan> {
  const existing = await client.list(repository.owner, repository.name);

  return {
    repository: `${repository.owner}/${repository.name}`,
    changes: planRepositoryRulesets(existing, desiredRulesets),
  };
}

export async function planOrganization(
  client: GovernanceClient,
  organization: string,
  resolveRulesets: RepositoryPolicyResolver = () => [],
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await planRepository(
        client,
        repository,
        await resolveRulesets(repository),
      ),
    );
  }

  return plans;
}

export async function syncRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  desiredRulesets: RepositoryRuleset[] = [],
): Promise<RepositoryPlan> {
  const plan = await planRepository(client, repository, desiredRulesets);
  const desired = plan.changes.flatMap((change) =>
    change.action === 'unchanged' ? [change.current] : [change.desired],
  );

  await reconcileRepositoryRulesets(
    client,
    repository.owner,
    repository.name,
    desired,
  );

  return plan;
}

export async function syncOrganization(
  client: GovernanceClient,
  organization: string,
  resolveRulesets: RepositoryPolicyResolver = () => [],
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await syncRepository(
        client,
        repository,
        await resolveRulesets(repository),
      ),
    );
  }

  return plans;
}
