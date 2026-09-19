// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { baseRuleset, governanceRepositoryCiRuleset } from '../src/policies.js';
import { normalizeRuleset, rulesetsEqual } from '../src/ruleset-normalizer.js';

describe('normalizeRuleset', () => {
  it('normalizes organization admin actor IDs returned by GitHub', () => {
    const current = structuredClone(baseRuleset);
    current.bypass_actors[0]!.actor_id = 999;

    expect(rulesetsEqual(current, baseRuleset)).toBe(true);
  });

  it('preserves required status checks as managed policy', () => {
    const normalized = normalizeRuleset(governanceRepositoryCiRuleset);
    const rule = normalized.rules.find(
      (candidate) => candidate.type === 'required_status_checks',
    );

    expect(rule).toMatchObject({
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true,
      },
    });

    if (rule?.type !== 'required_status_checks') {
      throw new Error('required_status_checks rule was not found');
    }

    expect(rule.parameters.required_status_checks.map(({ context }) => context)).toEqual([
      'Governance policy tests',
      'TypeScript',
    ]);
  });
});
