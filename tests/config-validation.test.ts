// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { validateGovernanceConfig } from '../src/config-validation.js';

const validConfig = {
  policies: {
    protected: {
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
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        {
          type: 'pull_request',
          parameters: {
            allowed_merge_methods: ['merge', 'squash', 'rebase'],
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: true,
            require_last_push_approval: false,
            required_approving_review_count: 1,
            required_review_thread_resolution: true,
          },
        },
      ],
    },
  },
  defaults: {
    policies: ['protected'],
  },
  repositories: {
    'ExampleOrg/project': {
      metadata: {
        description: 'Example project',
        homepage: 'https://example.test',
        topics: ['hacktoberfest', 'example'],
      },
    },
  },
};

describe('validateGovernanceConfig', () => {
  it('accepts a valid caller configuration', () => {
    expect(validateGovernanceConfig(validConfig)).toEqual(validConfig);
  });

  it('rejects unknown top-level keys', () => {
    expect(() =>
      validateGovernanceConfig({ ...validConfig, typo: true }),
    ).toThrow('$.typo');
  });

  it('rejects invalid nested scalar types with a precise path', () => {
    const config = structuredClone(validConfig) as any;
    config.policies.protected.rules[2].parameters.required_approving_review_count =
      '1';

    expect(() => validateGovernanceConfig(config)).toThrow(
      '$.policies.protected.rules[2].parameters.required_approving_review_count',
    );
  });

  it('rejects unsupported rule types', () => {
    const config = structuredClone(validConfig) as any;
    config.policies.protected.rules = [{ type: 'creation' }];

    expect(() => validateGovernanceConfig(config)).toThrow(
      'unsupported rule type: creation',
    );
  });

  it('rejects invalid bypass actors', () => {
    const config = structuredClone(validConfig) as any;
    config.policies.protected.bypass_actors = [
      {
        actor_id: 1,
        actor_type: 'Robot',
        bypass_mode: 'always',
      },
    ];

    expect(() => validateGovernanceConfig(config)).toThrow(
      '$.policies.protected.bypass_actors[0].actor_type',
    );
  });

  it('rejects unsupported repository metadata keys', () => {
    const config = structuredClone(validConfig) as any;
    config.repositories['ExampleOrg/project'].metadata.typo = true;

    expect(() => validateGovernanceConfig(config)).toThrow(
      '$.repositories.ExampleOrg/project.metadata.typo',
    );
  });

});
