// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { resolveExtraRulesets } from '../src/config.js';

describe('resolveExtraRulesets', () => {
  it('resolves shared named policies without duplicating their ruleset body', () => {
    const rulesets = resolveExtraRulesets(
      {
        repositories: {
          'github-governance': {
            policies: ['governance-ci'],
          },
        },
      },
      'github-governance',
    );

    expect(rulesets.map(({ name }) => name)).toEqual([
      'Require governance CI',
    ]);
  });

  it('supports repository-local rulesets for exceptional requirements', () => {
    const rulesets = resolveExtraRulesets(
      {
        repositories: {
          '.github': {
            rulesets: [
              {
                name: 'Organization repository CI',
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
      '.github',
    );

    expect(rulesets[0]?.name).toBe('Organization repository CI');
  });

  it('fails closed for an unknown shared policy', () => {
    expect(() =>
      resolveExtraRulesets(
        {
          repositories: {
            repo: {
              policies: ['unknown-policy'],
            },
          },
        },
        'repo',
      ),
    ).toThrow('Unknown governance policy');
  });

  it('returns no extra rulesets when the repository has no override', () => {
    expect(resolveExtraRulesets({}, 'libresign')).toEqual([]);
  });
});
