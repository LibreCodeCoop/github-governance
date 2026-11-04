// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { protectedBranchesFixture, requiredCiFixture } from './ruleset-fixtures.js';
import { normalizeRuleset, rulesetsEqual } from '../src/ruleset-normalizer.js';

describe('normalizeRuleset', () => {
  it('normalizes organization admin actor IDs returned by GitHub', () => {
    const current = structuredClone(protectedBranchesFixture);
    current.bypass_actors[0]!.actor_id = 999;

    expect(rulesetsEqual(current, protectedBranchesFixture)).toBe(true);
  });

  it('compares integration-bound checks without drifting unbound configurations', () => {
    const current = structuredClone(requiredCiFixture);
    const desired = structuredClone(requiredCiFixture);
    const currentRule = current.rules.find((rule) => rule.type === 'required_status_checks');
    const desiredRule = desired.rules.find((rule) => rule.type === 'required_status_checks');
    if (currentRule?.type !== 'required_status_checks' || desiredRule?.type !== 'required_status_checks') {
      throw new Error('missing fixture checks');
    }
    currentRule.parameters.required_status_checks[0]!.integration_id = 15368;
    expect(rulesetsEqual(current, desired)).toBe(true);
    desiredRule.parameters.required_status_checks[0]!.integration_id = 15368;
    expect(rulesetsEqual(current, desired)).toBe(true);
    currentRule.parameters.required_status_checks[0]!.integration_id = 999;
    expect(rulesetsEqual(current, desired)).toBe(false);
  });

  it('preserves required signatures as a managed rule', () => {
    const ruleset = structuredClone(protectedBranchesFixture);
    ruleset.rules.push({ type: 'required_signatures' });
    expect(normalizeRuleset(ruleset).rules.some((rule) => rule.type === 'required_signatures')).toBe(true);
    expect(rulesetsEqual(ruleset, protectedBranchesFixture)).toBe(false);
  });

  it('preserves required status checks as managed policy', () => {
    const normalized = normalizeRuleset(requiredCiFixture);
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
      'Policy tests',
      'TypeScript',
    ]);
  });
});
