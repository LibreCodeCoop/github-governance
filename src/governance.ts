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

export interface GovernanceClient
  extends GitHubContentProbe,
    RepositoryRulesetClient {
  listManagedRepositories(organization: string): Promise<RepositoryMetadata[]>;
}

export type RepositoryPlan = {
  repository: string;
  isNextcloudApp: boolean;
  changes: RulesetChange[];
};

export async function planOrganization(
  client: GovernanceClient,
  organization: string,
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    const classification = await classifyRepository(repository, client);
    const policy = composeRepositoryPolicy(classification);
    const existing = await client.list(repository.owner, repository.name);

    plans.push({
      repository: `${repository.owner}/${repository.name}`,
      isNextcloudApp: classification.isNextcloudApp,
      changes: planRepositoryRulesets(existing, policy.rulesets),
    });
  }

  return plans;
}

export async function syncOrganization(
  client: GovernanceClient,
  organization: string,
): Promise<RepositoryPlan[]> {
  const plans = await planOrganization(client, organization);

  for (const plan of plans) {
    const [owner, repository] = plan.repository.split('/');
    if (!owner || !repository) {
      throw new Error(`Invalid repository name: ${plan.repository}`);
    }

    const desired = plan.changes.flatMap((change) =>
      change.action === 'unchanged'
        ? [change.current]
        : [change.desired],
    );

    await reconcileRepositoryRulesets(client, owner, repository, desired);
  }

  return plans;
}
