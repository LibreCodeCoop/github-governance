// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { onboardRepository, type OnboardingClient } from '../src/onboarding.js';
import { resolveRepositoryRulesets, type GovernanceConfig } from '../src/config.js';
import { protectedBranchesFixture } from './ruleset-fixtures.js';
import type { ExistingRepositoryRuleset } from '../src/ruleset-reconciler.js';
import type { RepositoryMetadata } from '../src/repository-classifier.js';
import type { RepositoryRuleset } from '../src/types.js';

const bot = { actor_id: 20296731, actor_type: 'User' as const, bypass_mode: 'always' as const };
const normalRepo: RepositoryMetadata = {
  owner: 'ExampleOrg', name: 'ordinary', visibility: 'public', archived: false,
  description: null, homepage: null, topics: [], defaultBranch: 'main',
};
const config: GovernanceConfig = {
  policies: { protected: protectedBranchesFixture },
  defaults: { policies: ['protected'] },
  conditions: [{
    when: { file_exists: 'appinfo/info.xml' },
    add_bypass_actors: { protected: [bot] },
  }],
};

function client(options: {
  existing?: ExistingRepositoryRuleset[];
  protection?: 'absent' | 'present' | 'uninitialized';
  failures?: boolean;
} = {}) {
  const writes: RepositoryRuleset[] = [];
  const calls: string[] = [];
  const fake = {
    async list() { calls.push('list'); return structuredClone(options.existing ?? []); },
    async classicProtection() {
      calls.push('classicProtection');
      if (options.failures) throw new Error('Access to classic branch protection denied');
      return options.protection ?? 'absent';
    },
    async create(_owner: string, _repo: string, rule: RepositoryRuleset) {
      calls.push('create');
      writes.push(structuredClone(rule));
    },
    async update() { throw new Error('Existing rulesets must never be updated during onboarding'); },
    async updateRepositoryMetadata() { throw new Error('Repository metadata must never be changed during onboarding'); },
    async exists(_owner: string, _repo: string, path: string) { return path === 'appinfo/info.xml'; },
  };
  return { fake: fake as unknown as OnboardingClient, calls, writes };
}

async function expected(fake: OnboardingClient, repo = normalRepo) {
  return (await resolveRepositoryRulesets(config, repo, fake))[0]!;
}

describe('privileged default-ruleset onboarding', () => {
  it('creates the common policy with the Nextcloud translation-bot direct-push exception', async () => {
    const { fake, writes, calls } = client();
    const desired = await expected(fake);
    expect(desired.bypass_actors).toContainEqual(bot);
    const result = await onboardRepository(fake, normalRepo, desired);
    expect(result.status).toBe('created');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual(desired);
    expect(calls).toEqual(['classicProtection', 'list', 'create']);
  });

  it('does not grant translation-bot rights to non-Nextcloud repositories', async () => {
    const { fake, writes } = client();
    fake.exists = async () => false;
    const desired = await expected(fake);
    expect(desired.bypass_actors).not.toContainEqual(bot);
    await onboardRepository(fake, normalRepo, desired);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.bypass_actors).not.toContainEqual(bot);
  });

  it('never changes an existing common ruleset with missing bot bypass', async () => {
    const current = { ...structuredClone(protectedBranchesFixture), id: 1 };
    const { fake, writes } = client({ existing: [current] });
    const result = await onboardRepository(fake, normalRepo, await expected(fake));
    expect(result.status).toBe('review');
    expect(result.reason).toContain('differs');
    expect(writes).toHaveLength(0);
  });

  it('accepts a Nextcloud app with a separate DCO ruleset that grants bot bypass', async () => {
    const { fake, writes } = client();
    const desired = await expected(fake);
    const dco = { ...structuredClone(protectedBranchesFixture), name: 'Require DCO', id: 10,
      bypass_actors: [bot], rules: [] } as ExistingRepositoryRuleset;
    const current = { ...structuredClone(desired), id: 11 };
    const originalList = fake.list;
    fake.list = async (...args) => { await originalList(...args); return [current, dco]; };
    const result = await onboardRepository(fake, normalRepo, desired);
    expect(result.status).toBe('unchanged');
    expect(writes).toHaveLength(0);
  });

  it('rejects a separate active DCO rule that would block the same bot', async () => {
    const { fake, writes } = client();
    const desired = await expected(fake);
    const current = { ...structuredClone(desired), id: 11 };
    const dco = { ...structuredClone(protectedBranchesFixture), name: 'Require DCO', id: 10,
      bypass_actors: [] } as ExistingRepositoryRuleset;
    fake.list = async () => [current, dco];
    const result = await onboardRepository(fake, normalRepo, desired);
    expect(result.status).toBe('review');
    expect(result.reason).toContain('direct-push actor');
    expect(writes).toHaveLength(0);
  });

  it('ignores an inactive CI rule but does not modify it', async () => {
    const { fake, writes } = client();
    const desired = await expected(fake);
    fake.list = async () => [
      { ...structuredClone(desired), id: 11 },
      { ...structuredClone(protectedBranchesFixture), name: 'CI disabled', enforcement: 'disabled', id: 12, bypass_actors: [] },
    ];
    expect((await onboardRepository(fake, normalRepo, desired)).status).toBe('unchanged');
    expect(writes).toHaveLength(0);
  });

  it.each(['present', 'uninitialized'] as const)('never changes %s classic/default branch state', async (protection) => {
    const { fake, writes, calls } = client({ protection });
    const result = await onboardRepository(fake, normalRepo, await expected(fake));
    expect(result.status).toBe('review');
    expect(writes).toHaveLength(0);
    expect(calls).not.toContain('create');
  });

  it('detects legacy protection even if the common ruleset is already present', async () => {
    const { fake, writes } = client({ protection: 'present', existing: [{ ...structuredClone(protectedBranchesFixture), id: 1 }] });
    expect((await onboardRepository(fake, normalRepo, await expected(fake))).status).toBe('review');
    expect(writes).toHaveLength(0);
  });

  it('requires manual review if another ruleset already exists', async () => {
    const { fake, writes } = client({ existing: [{ ...structuredClone(protectedBranchesFixture), name: 'Custom CI', id: 5 }] });
    const result = await onboardRepository(fake, normalRepo, await expected(fake));
    expect(result.status).toBe('review');
    expect(writes).toHaveLength(0);
  });

  it('skips private and archived repositories', async () => {
    for (const repo of [{ ...normalRepo, archived: true }, { ...normalRepo, visibility: 'private' as const }]) {
      const { fake, writes, calls } = client();
      const result = await onboardRepository(fake, repo, await expected(fake, repo));
      expect(result.status).toBe('skipped');
      expect(calls).toEqual([]);
      expect(writes).toHaveLength(0);
    }
  });

  it('fails closed when it cannot inspect branch protection', async () => {
    const { fake, writes } = client({ failures: true });
    await expect(onboardRepository(fake, normalRepo, await expected(fake))).rejects.toThrow('denied');
    expect(writes).toHaveLength(0);
  });
});
