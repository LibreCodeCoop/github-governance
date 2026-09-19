import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli-runner.js';
import type { GovernanceClient } from '../src/governance.js';
import type { RepositoryMetadata } from '../src/repository-classifier.js';
import type {
  ExistingRepositoryRuleset,
} from '../src/ruleset-reconciler.js';
import type { RepositoryRuleset } from '../src/types.js';

class FakeClient implements GovernanceClient {
  constructor(
    private readonly existing: ExistingRepositoryRuleset[] = [],
  ) {}

  async listManagedRepositories(): Promise<RepositoryMetadata[]> {
    return [
      {
        owner: 'LibreSign',
        name: 'documentation',
        visibility: 'public',
        archived: false,
      },
    ];
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async list(): Promise<ExistingRepositoryRuleset[]> {
    return structuredClone(this.existing);
  }

  async create(
    _owner: string,
    _repository: string,
    _ruleset: RepositoryRuleset,
  ): Promise<void> {}

  async update(
    _owner: string,
    _repository: string,
    _id: number,
    _ruleset: RepositoryRuleset,
  ): Promise<void> {}
}

describe('runCli', () => {
  it('requires an organization', async () => {
    const errors: string[] = [];

    const code = await runCli(
      [],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: () => undefined,
        error: (message) => errors.push(message),
      },
    );

    expect(code).toBe(2);
    expect(errors).toEqual(['Missing required --org OWNER']);
  });

  it('requires a GitHub token', async () => {
    const errors: string[] = [];

    const code = await runCli(
      ['--org', 'LibreSign'],
      {},
      () => new FakeClient(),
      {
        log: () => undefined,
        error: (message) => errors.push(message),
      },
    );

    expect(code).toBe(2);
    expect(errors).toEqual(['GITHUB_TOKEN is required']);
  });

  it('returns drift status without applying by default', async () => {
    const messages: string[] = [];

    const code = await runCli(
      ['--org', 'LibreSign'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
    );

    expect(code).toBe(1);
    expect(messages[0]).toContain('DRIFT LibreSign/documentation');
  });

  it('uses apply mode only when explicitly requested', async () => {
    const messages: string[] = [];

    const code = await runCli(
      ['--org', 'LibreSign', '--apply'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
    );

    expect(code).toBe(0);
    expect(messages[0]).toContain('APPLIED LibreSign/documentation');
  });
});
