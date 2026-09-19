// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { planOrganization } from '../src/governance.js';
import type {
  ExistingRepositoryRuleset,
  RepositoryRulesetClient,
} from '../src/ruleset-reconciler.js';
import type {
  GitHubContentProbe,
  RepositoryMetadata,
} from '../src/repository-classifier.js';
import type { RepositoryRuleset } from '../src/types.js';

const ruleset: RepositoryRuleset = {
  name: 'Protect branches',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [],
  conditions: {
    ref_name: {
      include: ['~DEFAULT_BRANCH'],
      exclude: [],
    },
  },
  rules: [],
};

class FakeGovernanceClient
  implements GitHubContentProbe, RepositoryRulesetClient
{
  constructor(
    private readonly repositories: RepositoryMetadata[],
    private readonly existing: Map<string, ExistingRepositoryRuleset[]>,
  ) {}

  async getRepository(owner: string, repository: string): Promise<RepositoryMetadata> {
    const match = this.repositories.find(
      (candidate) => candidate.owner === owner && candidate.name === repository,
    );
    if (!match) {
      throw new Error('repository not found');
    }
    return structuredClone(match);
  }

  async listManagedRepositories(): Promise<RepositoryMetadata[]> {
    return structuredClone(this.repositories);
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async list(
    owner: string,
    repository: string,
  ): Promise<ExistingRepositoryRuleset[]> {
    return structuredClone(this.existing.get(`${owner}/${repository}`) ?? []);
  }

  async create(): Promise<void> {
    throw new Error('not expected in planning');
  }

  async update(): Promise<void> {
    throw new Error('not expected in planning');
  }
}

describe('planOrganization', () => {
  it('plans repositories using caller-resolved policies', async () => {
    const client = new FakeGovernanceClient(
      [
        {
          owner: 'ExampleOrg',
          name: 'one',
          visibility: 'public',
          archived: false,
        },
        {
          owner: 'ExampleOrg',
          name: 'two',
          visibility: 'public',
          archived: false,
        },
      ],
      new Map([
        ['ExampleOrg/one', [{ ...structuredClone(ruleset), id: 1 }]],
      ]),
    );

    const plans = await planOrganization(
      client,
      'ExampleOrg',
      async () => [structuredClone(ruleset)],
    );

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      repository: 'ExampleOrg/one',
      changes: [{ action: 'unchanged' }],
    });
    expect(plans[1]).toMatchObject({
      repository: 'ExampleOrg/two',
      changes: [{ action: 'create' }],
    });
  });
});
