// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli-runner.js';
import type { GovernanceClient } from '../src/governance.js';
import type { RepositoryMetadata } from '../src/repository-classifier.js';
import type { ExistingRepositoryRuleset } from '../src/ruleset-reconciler.js';
import type { RepositoryRuleset } from '../src/types.js';

const protectedBranches: RepositoryRuleset = {
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

class FakeClient implements GovernanceClient {
  constructor(
    private readonly existing: ExistingRepositoryRuleset[] = [],
  ) {}

  async getRepository(
    owner: string,
    repository: string,
  ): Promise<RepositoryMetadata> {
    return {
      owner,
      name: repository,
      visibility: 'public',
      archived: false,
      description: null,
      homepage: null,
      topics: [],
    };
  }

  async listManagedRepositories(): Promise<RepositoryMetadata[]> {
    return [
      {
        owner: 'ExampleOrg',
        name: 'project',
        visibility: 'public',
        archived: false,
        description: null,
        homepage: null,
        topics: [],
      },
    ];
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async list(): Promise<ExistingRepositoryRuleset[]> {
    return structuredClone(this.existing);
  }

  async create(): Promise<void> {}
  async update(): Promise<void> {}
  async updateRepositoryMetadata(): Promise<void> {}
}

const configLoader = async () => ({
  policies: {
    protected: protectedBranches,
  },
  defaults: {
    policies: ['protected'],
  },
});

describe('runCli', () => {
  it('requires exactly one target selector', async () => {
    const errors: string[] = [];

    const code = await runCli(
      [],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: () => undefined,
        error: (message) => errors.push(message),
      },
      configLoader,
    );

    expect(code).toBe(2);
    expect(errors).toEqual([
      'Specify exactly one of --org OWNER or --repo OWNER/REPO',
    ]);
  });

  it('requires a GitHub token', async () => {
    const errors: string[] = [];

    const code = await runCli(
      ['--org', 'ExampleOrg'],
      {},
      () => new FakeClient(),
      {
        log: () => undefined,
        error: (message) => errors.push(message),
      },
      configLoader,
    );

    expect(code).toBe(2);
    expect(errors).toEqual(['GITHUB_TOKEN is required']);
  });

  it('returns drift status without applying by default', async () => {
    const messages: string[] = [];

    const code = await runCli(
      ['--org', 'ExampleOrg'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
      configLoader,
    );

    expect(code).toBe(1);
    expect(messages[0]).toContain('DRIFT ExampleOrg/project');
  });

  it('supports repository-scoped dry-run with caller policies', async () => {
    const messages: string[] = [];

    const code = await runCli(
      ['--repo', 'ExampleOrg/project', '--config', 'governance.config.json'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
      configLoader,
    );

    expect(code).toBe(1);
    expect(messages).toContain('  - create: Protect branches');
  });

  it('reports organization drift without failing when explicitly allowed', async () => {
    const messages: string[] = [];
    const code = await runCli(
      ['--org', 'ExampleOrg', '--allow-drift'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
      configLoader,
    );
    expect(code).toBe(0);
    expect(messages).toContain('DRIFT ExampleOrg/project');
  });

  it('reports repository drift without failing when explicitly allowed', async () => {
    const messages: string[] = [];
    const code = await runCli(
      ['--repo', 'ExampleOrg/project', '--allow-drift'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
      configLoader,
    );
    expect(code).toBe(0);
    expect(messages).toContain('DRIFT ExampleOrg/project');
  });

  it('does not hide API failures when drift is allowed', async () => {
    class FailedClient extends FakeClient {
      override async list(): Promise<ExistingRepositoryRuleset[]> {
        throw new Error('GitHub API unavailable');
      }
    }
    await expect(runCli(
      ['--org', 'ExampleOrg', '--allow-drift'],
      { GITHUB_TOKEN: 'token' },
      () => new FailedClient(),
      { log: () => undefined, error: () => undefined },
      configLoader,
    )).rejects.toThrow('GitHub API unavailable');
  });

  it('rejects public discovery during apply to preserve installation-scoped writes', async () => {
    const errors: string[] = [];
    const code = await runCli(
      ['--org', 'ExampleOrg', '--apply', '--public-discovery'],
      { GITHUB_TOKEN: 'token' },
      () => { throw new Error('Must not contact GitHub'); },
      { log: () => undefined, error: (message) => errors.push(message) },
      configLoader,
    );
    expect(code).toBe(2);
    expect(errors).toEqual([
      '--public-discovery requires --org and cannot be combined with --apply',
    ]);
  });

  it('rejects public discovery for a repository-scoped run', async () => {
    const errors: string[] = [];
    const code = await runCli(
      ['--repo', 'ExampleOrg/project', '--public-discovery'],
      { GITHUB_TOKEN: 'token' },
      () => { throw new Error('Must not contact GitHub'); },
      { log: () => undefined, error: (message) => errors.push(message) },
      configLoader,
    );
    expect(code).toBe(2);
    expect(errors).toHaveLength(1);
  });

  it('passes the read-only discovery selection only to public organization plans', async () => {
    const modes: boolean[] = [];
    const code = await runCli(
      ['--org', 'ExampleOrg', '--allow-drift', '--public-discovery'],
      { GITHUB_TOKEN: 'token' },
      (_token, discovery) => { modes.push(discovery); return new FakeClient(); },
      { log: () => undefined, error: () => undefined },
      configLoader,
    );
    expect(code).toBe(0);
    expect(modes).toEqual([true]);
  });

  it('uses apply mode only when explicitly requested', async () => {
    const messages: string[] = [];

    const code = await runCli(
      ['--org', 'ExampleOrg', '--apply'],
      { GITHUB_TOKEN: 'token' },
      () => new FakeClient(),
      {
        log: (message) => messages.push(message),
        error: () => undefined,
      },
      configLoader,
    );

    expect(code).toBe(0);
    expect(messages[0]).toContain('APPLIED ExampleOrg/project');
  });
});
