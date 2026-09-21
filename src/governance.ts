// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RepositoryPresentation } from './config.ts';
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
  updateRepositoryMetadata(
    owner: string,
    repository: string,
    metadata: RepositoryPresentation,
  ): Promise<void>;
}

export type RepositoryMetadataChange = {
  action: 'unchanged' | 'update';
  fields: string[];
  current: {
    description: string | null;
    homepage: string | null;
    topics: string[];
  };
  desired: RepositoryPresentation;
};

export type RepositoryPlan = {
  repository: string;
  changes: RulesetChange[];
  metadata?: RepositoryMetadataChange;
};

export type RepositoryPolicyResolver = (
  repository: RepositoryMetadata,
) => Promise<RepositoryRuleset[]> | RepositoryRuleset[];

export type RepositoryMetadataResolver = (
  repository: RepositoryMetadata,
) => Promise<RepositoryPresentation | undefined> | RepositoryPresentation | undefined;

export async function planRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  desiredRulesets: RepositoryRuleset[] = [],
  desiredMetadata?: RepositoryPresentation,
): Promise<RepositoryPlan> {
  const existing = await client.list(repository.owner, repository.name);

  return {
    repository: `${repository.owner}/${repository.name}`,
    changes: planRepositoryRulesets(existing, desiredRulesets),
    metadata: planRepositoryMetadata(repository, desiredMetadata),
  };
}

export async function planOrganization(
  client: GovernanceClient,
  organization: string,
  resolveRulesets: RepositoryPolicyResolver = () => [],
  resolveMetadata: RepositoryMetadataResolver = () => undefined,
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await planRepository(
        client,
        repository,
        await resolveRulesets(repository),
        await resolveMetadata(repository),
      ),
    );
  }

  return plans;
}

export async function syncRepository(
  client: GovernanceClient,
  repository: RepositoryMetadata,
  desiredRulesets: RepositoryRuleset[] = [],
  desiredMetadata?: RepositoryPresentation,
): Promise<RepositoryPlan> {
  const plan = await planRepository(
    client,
    repository,
    desiredRulesets,
    desiredMetadata,
  );
  const desired = plan.changes.flatMap((change) =>
    change.action === 'unchanged' ? [change.current] : [change.desired],
  );

  await reconcileRepositoryRulesets(
    client,
    repository.owner,
    repository.name,
    desired,
  );

  if (plan.metadata?.action === 'update') {
    await client.updateRepositoryMetadata(
      repository.owner,
      repository.name,
      plan.metadata.desired,
    );
  }

  return plan;
}

export async function syncOrganization(
  client: GovernanceClient,
  organization: string,
  resolveRulesets: RepositoryPolicyResolver = () => [],
  resolveMetadata: RepositoryMetadataResolver = () => undefined,
): Promise<RepositoryPlan[]> {
  const repositories = await client.listManagedRepositories(organization);
  const plans: RepositoryPlan[] = [];

  for (const repository of repositories) {
    plans.push(
      await syncRepository(
        client,
        repository,
        await resolveRulesets(repository),
        await resolveMetadata(repository),
      ),
    );
  }

  return plans;
}

function planRepositoryMetadata(
  repository: RepositoryMetadata,
  requested: RepositoryPresentation | undefined,
): RepositoryMetadataChange | undefined {
  if (requested === undefined) {
    return undefined;
  }

  const fields: string[] = [];
  const desired: RepositoryPresentation = {};

  if (requested.description !== undefined) {
    desired.description = requested.description;
    if (requested.description !== repository.description) {
      fields.push('description');
    }
  }

  if (requested.homepage !== undefined) {
    desired.homepage = requested.homepage;
    if (requested.homepage !== repository.homepage) {
      fields.push('homepage');
    }
  }

  if (requested.topics !== undefined) {
    const existing = new Set(repository.topics);
    const merged = [...new Set([...repository.topics, ...requested.topics])].sort();
    desired.topics = merged;

    if (requested.topics.some((topic) => !existing.has(topic))) {
      fields.push('topics');
    }
  }

  return {
    action: fields.length === 0 ? 'unchanged' : 'update',
    fields,
    current: {
      description: repository.description,
      homepage: repository.homepage,
      topics: [...repository.topics],
    },
    desired,
  };
}
