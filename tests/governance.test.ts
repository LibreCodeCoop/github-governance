import { describe, expect, it } from 'vitest';
import { planOrganization } from '../src/governance.js';
import { baseRuleset } from '../src/policies.js';
import type {
  ExistingRepositoryRuleset,
  RepositoryRulesetClient,
} from '../src/ruleset-reconciler.js';
import type {
  GitHubContentProbe,
  RepositoryMetadata,
} from '../src/repository-classifier.js';
import type { RepositoryRuleset } from '../src/types.js';

class FakeGovernanceClient
  implements GitHubContentProbe, RepositoryRulesetClient
{
  constructor(
    private readonly repositories: RepositoryMetadata[],
    private readonly nextcloudApps: Set<string>,
    private readonly existing: Map<string, ExistingRepositoryRuleset[]>,
  ) {}

  async listManagedRepositories(): Promise<RepositoryMetadata[]> {
    return structuredClone(this.repositories);
  }

  async exists(owner: string, repository: string): Promise<boolean> {
    return this.nextcloudApps.has(`${owner}/${repository}`);
  }

  async list(
    owner: string,
    repository: string,
  ): Promise<ExistingRepositoryRuleset[]> {
    return structuredClone(this.existing.get(`${owner}/${repository}`) ?? []);
  }

  async create(
    _owner: string,
    _repository: string,
    _ruleset: RepositoryRuleset,
  ): Promise<void> {
    throw new Error('not expected in planning');
  }

  async update(
    _owner: string,
    _repository: string,
    _id: number,
    _ruleset: RepositoryRuleset,
  ): Promise<void> {
    throw new Error('not expected in planning');
  }
}

describe('planOrganization', () => {
  it('plans ordinary and Nextcloud repositories with shared policy rules', async () => {
    const client = new FakeGovernanceClient(
      [
        {
          owner: 'LibreSign',
          name: 'documentation',
          visibility: 'public',
          archived: false,
        },
        {
          owner: 'LibreSign',
          name: 'libresign',
          visibility: 'public',
          archived: false,
        },
      ],
      new Set(['LibreSign/libresign']),
      new Map([
        [
          'LibreSign/documentation',
          [{ ...structuredClone(baseRuleset), id: 1 }],
        ],
      ]),
    );

    const plans = await planOrganization(client, 'LibreSign');

    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      repository: 'LibreSign/documentation',
      isNextcloudApp: false,
      changes: [{ action: 'unchanged' }],
    });
    expect(plans[1]).toMatchObject({
      repository: 'LibreSign/libresign',
      isNextcloudApp: true,
      changes: [{ action: 'create' }],
    });
  });
});
