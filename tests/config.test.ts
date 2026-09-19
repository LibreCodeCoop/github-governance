// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { resolveRepositoryRulesets } from '../src/config.js';
import type { GovernanceConfig } from '../src/config.js';

const protectedBranches = {
  name: 'Protect branches',
  target: 'branch' as const,
  enforcement: 'active' as const,
  bypass_actors: [],
  conditions: {
    ref_name: {
      include: ['~DEFAULT_BRANCH'],
      exclude: [],
    },
  },
  rules: [],
};

const config: GovernanceConfig = {
  policies: {
    protected: protectedBranches,
  },
  defaults: {
    policies: ['protected'],
  },
  conditions: [
    {
      when: {
        file_exists: 'marker/file',
      },
      add_bypass_actors: {
        protected: [
          {
            actor_id: 1234,
            actor_type: 'User',
            bypass_mode: 'always',
          },
        ],
      },
    },
  ],
};

describe('resolveRepositoryRulesets', () => {
  it('resolves default policies from caller configuration', async () => {
    const rulesets = await resolveRepositoryRulesets(
      config,
      {
        owner: 'ExampleOrg',
        name: 'project',
        visibility: 'public',
        archived: false,
      },
      { exists: async () => false },
    );

    expect(rulesets).toEqual([protectedBranches]);
  });

  it('applies generic file-exists conditional bypasses', async () => {
    const rulesets = await resolveRepositoryRulesets(
      config,
      {
        owner: 'ExampleOrg',
        name: 'project',
        visibility: 'public',
        archived: false,
      },
      { exists: async () => true },
    );

    expect(rulesets[0]?.bypass_actors).toEqual([
      {
        actor_id: 1234,
        actor_type: 'User',
        bypass_mode: 'always',
      },
    ]);
  });

  it('supports repository-specific policies and rulesets', async () => {
    const rulesets = await resolveRepositoryRulesets(
      {
        policies: {
          protected: protectedBranches,
        },
        repositories: {
          special: {
            policies: ['protected'],
            rulesets: [
              {
                name: 'Special CI',
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
              },
            ],
          },
        },
      },
      {
        owner: 'ExampleOrg',
        name: 'special',
        visibility: 'public',
        archived: false,
      },
      { exists: async () => false },
    );

    expect(rulesets.map(({ name }) => name)).toEqual([
      'Protect branches',
      'Special CI',
    ]);
  });

  it('does not manage private or archived repositories', async () => {
    await expect(
      resolveRepositoryRulesets(
        config,
        {
          owner: 'ExampleOrg',
          name: 'private',
          visibility: 'private',
          archived: false,
        },
        { exists: async () => true },
      ),
    ).resolves.toEqual([]);

    await expect(
      resolveRepositoryRulesets(
        config,
        {
          owner: 'ExampleOrg',
          name: 'archive',
          visibility: 'public',
          archived: true,
        },
        { exists: async () => true },
      ),
    ).resolves.toEqual([]);
  });

  it('fails closed for unknown policies', async () => {
    await expect(
      resolveRepositoryRulesets(
        {
          defaults: {
            policies: ['missing'],
          },
        },
        {
          owner: 'ExampleOrg',
          name: 'project',
          visibility: 'public',
          archived: false,
        },
        { exists: async () => false },
      ),
    ).rejects.toThrow('Unknown governance policy');
  });

  it('fails closed when a conditional probe fails', async () => {
    await expect(
      resolveRepositoryRulesets(
        config,
        {
          owner: 'ExampleOrg',
          name: 'project',
          visibility: 'public',
          archived: false,
        },
        {
          exists: async () => {
            throw new Error('HTTP 403');
          },
        },
      ),
    ).rejects.toThrow('HTTP 403');
  });
});
