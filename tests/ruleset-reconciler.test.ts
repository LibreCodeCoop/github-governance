// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';
import { baseRuleset } from '../src/policies.js';
import {
  reconcileRepositoryRulesets,
  type ExistingRepositoryRuleset,
  type RepositoryRulesetClient,
} from '../src/ruleset-reconciler.js';
import type { RepositoryRuleset } from '../src/types.js';

class FakeClient implements RepositoryRulesetClient {
  readonly created: RepositoryRuleset[] = [];
  readonly updated: Array<{ id: number; ruleset: RepositoryRuleset }> = [];

  constructor(private readonly existing: ExistingRepositoryRuleset[]) {}

  async list(): Promise<ExistingRepositoryRuleset[]> {
    return structuredClone(this.existing);
  }

  async create(
    _owner: string,
    _repository: string,
    ruleset: RepositoryRuleset,
  ): Promise<void> {
    this.created.push(structuredClone(ruleset));
  }

  async update(
    _owner: string,
    _repository: string,
    id: number,
    ruleset: RepositoryRuleset,
  ): Promise<void> {
    this.updated.push({ id, ruleset: structuredClone(ruleset) });
  }
}

describe('reconcileRepositoryRulesets', () => {
  it('creates a missing managed ruleset', async () => {
    const client = new FakeClient([]);

    const result = await reconcileRepositoryRulesets(
      client,
      'LibreSign',
      'documentation',
      [baseRuleset],
    );

    expect(result.created).toEqual(['Protect default and stable branches']);
    expect(client.created).toHaveLength(1);
  });

  it('does not update an equivalent ruleset', async () => {
    const client = new FakeClient([{ ...structuredClone(baseRuleset), id: 7 }]);

    const result = await reconcileRepositoryRulesets(
      client,
      'LibreSign',
      'documentation',
      [baseRuleset],
    );

    expect(result.unchanged).toEqual(['Protect default and stable branches']);
    expect(client.updated).toEqual([]);
  });

  it('updates a managed ruleset when policy drifts', async () => {
    const current = structuredClone(baseRuleset);
    const pullRequestRule = current.rules.find(
      (rule) => rule.type === 'pull_request',
    );
    if (pullRequestRule?.type !== 'pull_request') {
      throw new Error('pull_request rule was not found');
    }
    pullRequestRule.parameters.required_approving_review_count = 0;

    const client = new FakeClient([{ ...current, id: 9 }]);

    const result = await reconcileRepositoryRulesets(
      client,
      'LibreSign',
      'documentation',
      [baseRuleset],
    );

    expect(result.updated).toEqual(['Protect default and stable branches']);
    expect(client.updated).toEqual([
      { id: 9, ruleset: baseRuleset },
    ]);
  });

  it('does not delete unrelated rulesets', async () => {
    const unrelated: ExistingRepositoryRuleset = {
      ...structuredClone(baseRuleset),
      id: 11,
      name: 'Repository-specific policy',
    };
    const client = new FakeClient([unrelated]);

    await reconcileRepositoryRulesets(
      client,
      'LibreSign',
      'documentation',
      [baseRuleset],
    );

    expect(client.created).toHaveLength(1);
    expect(client.updated).toHaveLength(0);
  });
});
