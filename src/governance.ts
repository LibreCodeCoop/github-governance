// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { classifyRepository } from './repository-classifier.js';
import { composeRepositoryPolicy } from './policy-composer.js';
import {
  planRepositoryRulesets,
  reconcileRepositoryRulesets,
  type RepositoryRulesetClient,
  type RulesetChange,
} from './ruleset-reconciler.js';
import type {
  GitHubContentProbe,
  RepositoryMetadata,
} from './repository-classifier.js';
import type { RepositoryRuleset } from './types.js';

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
  isNextcloudApp: boolean;
  changes: RulesetChange[];
};

export type RepositoryPolicyResolver = (
  repository: RepositoryMetadata,
) => Promise<RepositoryRuleset[]> | RepositoryRuleset[];

export async function planRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  extraRulesets: RepositoryRuleset[] = [],
): Promise<RepositoryPlan> {
  const classification = await classifyRepository(repository, client);
  const policy = composeRepositoryPolicy(classification, { extraRulesets });
  const existing = await client.list(repository.owner, repository.name);

  return {
    repository: `${repository.owner}/${repository.name}`,
    isNextcloudApp: classification.isNextcloudApp,
    changes: planRepositoryRulesets(existing, policy.rulesets),
  };
}

export async function planOrganization(
  client: GovernanceClient,
  organization: string,
  resolveExtraRulesets: RepositoryPolicyResolver = () => [],
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await planRepository(
        client,
        repository,
        await resolveExtraRulesets(repository),
      ),
    );
  }

  return plans;
}

export async function syncRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  extraRulesets: RepositoryRuleset[] = [],
): Promise<RepositoryPlan> {
  const plan = await planRepository(client, repository, extraRulesets);
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
  resolveExtraRulesets: RepositoryPolicyResolver = () => [],
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await syncRepository(
        client,
        repository,
        await resolveExtraRulesets(repository),
      ),
    );
  }

  return plans;
}
