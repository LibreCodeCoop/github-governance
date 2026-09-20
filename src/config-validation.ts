// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  BypassActor,
  RepositoryRuleset,
  RulesetRule,
} from './types.ts';
import type {
  ConditionalGovernanceConfig,
  GovernanceConfig,
  RepositoryGovernanceConfig,
} from './config.ts';

export function validateGovernanceConfig(value: unknown): GovernanceConfig {
  const root = expectRecord(value, '$');
  rejectUnknownKeys(root, '$', ['policies', 'defaults', 'conditions', 'repositories']);

  const config: GovernanceConfig = {};

  if ('policies' in root) {
    const policies = expectRecord(root.policies, '$.policies');
    config.policies = Object.fromEntries(
      Object.entries(policies).map(([name, ruleset]) => [
        name,
        validateRuleset(ruleset, `$.policies.${name}`),
      ]),
    );
  }

  if ('defaults' in root) {
    config.defaults = validateSelection(root.defaults, '$.defaults');
  }

  if ('conditions' in root) {
    const conditions = expectArray(root.conditions, '$.conditions');
    config.conditions = conditions.map((condition, index) =>
      validateCondition(condition, `$.conditions[${index}]`),
    );
  }

  if ('repositories' in root) {
    const repositories = expectRecord(root.repositories, '$.repositories');
    config.repositories = Object.fromEntries(
      Object.entries(repositories).map(([name, selection]) => [
        name,
        validateSelection(selection, `$.repositories.${name}`),
      ]),
    );
  }

  return config;
}

function validateSelection(
  value: unknown,
  path: string,
): RepositoryGovernanceConfig {
  const record = expectRecord(value, path);
  rejectUnknownKeys(record, path, ['policies', 'rulesets']);

  const selection: RepositoryGovernanceConfig = {};
  if ('policies' in record) {
    selection.policies = expectStringArray(record.policies, `${path}.policies`);
  }
  if ('rulesets' in record) {
    selection.rulesets = expectArray(record.rulesets, `${path}.rulesets`).map(
      (ruleset, index) => validateRuleset(ruleset, `${path}.rulesets[${index}]`),
    );
  }
  return selection;
}

function validateCondition(
  value: unknown,
  path: string,
): ConditionalGovernanceConfig {
  const record = expectRecord(value, path);
  rejectUnknownKeys(record, path, [
    'when',
    'policies',
    'rulesets',
    'add_bypass_actors',
  ]);

  const when = expectRecord(record.when, `${path}.when`);
  rejectUnknownKeys(when, `${path}.when`, ['file_exists']);
  const fileExists = expectNonEmptyString(
    when.file_exists,
    `${path}.when.file_exists`,
  );

  const condition: ConditionalGovernanceConfig = {
    when: { file_exists: fileExists },
  };

  if ('policies' in record) {
    condition.policies = expectStringArray(record.policies, `${path}.policies`);
  }
  if ('rulesets' in record) {
    condition.rulesets = expectArray(record.rulesets, `${path}.rulesets`).map(
      (ruleset, index) => validateRuleset(ruleset, `${path}.rulesets[${index}]`),
    );
  }
  if ('add_bypass_actors' in record) {
    const byPolicy = expectRecord(
      record.add_bypass_actors,
      `${path}.add_bypass_actors`,
    );
    condition.add_bypass_actors = Object.fromEntries(
      Object.entries(byPolicy).map(([policy, actors]) => [
        policy,
        expectArray(
          actors,
          `${path}.add_bypass_actors.${policy}`,
        ).map((actor, index) =>
          validateBypassActor(
            actor,
            `${path}.add_bypass_actors.${policy}[${index}]`,
          ),
        ),
      ]),
    );
  }

  return condition;
}

function validateRuleset(value: unknown, path: string): RepositoryRuleset {
  const record = expectRecord(value, path);
  rejectUnknownKeys(record, path, [
    'name',
    'target',
    'enforcement',
    'bypass_actors',
    'conditions',
    'rules',
  ]);

  const target = expectString(record.target, `${path}.target`);
  if (target !== 'branch') {
    fail(`${path}.target`, 'must be "branch"');
  }

  const enforcement = expectString(record.enforcement, `${path}.enforcement`);
  if (!['active', 'disabled', 'evaluate'].includes(enforcement)) {
    fail(`${path}.enforcement`, 'must be active, disabled, or evaluate');
  }

  const conditions = expectRecord(record.conditions, `${path}.conditions`);
  rejectUnknownKeys(conditions, `${path}.conditions`, ['ref_name']);
  const refName = expectRecord(
    conditions.ref_name,
    `${path}.conditions.ref_name`,
  );
  rejectUnknownKeys(refName, `${path}.conditions.ref_name`, [
    'include',
    'exclude',
  ]);

  return {
    name: expectNonEmptyString(record.name, `${path}.name`),
    target: 'branch',
    enforcement: enforcement as RepositoryRuleset['enforcement'],
    bypass_actors: expectArray(
      record.bypass_actors,
      `${path}.bypass_actors`,
    ).map((actor, index) =>
      validateBypassActor(actor, `${path}.bypass_actors[${index}]`),
    ),
    conditions: {
      ref_name: {
        include: expectStringArray(
          refName.include,
          `${path}.conditions.ref_name.include`,
        ),
        exclude: expectStringArray(
          refName.exclude,
          `${path}.conditions.ref_name.exclude`,
        ),
      },
    },
    rules: expectArray(record.rules, `${path}.rules`).map((rule, index) =>
      validateRule(rule, `${path}.rules[${index}]`),
    ),
  };
}

function validateBypassActor(value: unknown, path: string): BypassActor {
  const record = expectRecord(value, path);
  rejectUnknownKeys(record, path, ['actor_id', 'actor_type', 'bypass_mode']);

  const actorId = expectNumber(record.actor_id, `${path}.actor_id`);
  const actorType = expectString(record.actor_type, `${path}.actor_type`);
  const bypassMode = expectString(record.bypass_mode, `${path}.bypass_mode`);

  if (!['OrganizationAdmin', 'User', 'Team', 'Integration'].includes(actorType)) {
    fail(`${path}.actor_type`, 'has an unsupported actor type');
  }
  if (!['always', 'pull_request'].includes(bypassMode)) {
    fail(`${path}.bypass_mode`, 'must be always or pull_request');
  }

  return {
    actor_id: actorId,
    actor_type: actorType as BypassActor['actor_type'],
    bypass_mode: bypassMode as BypassActor['bypass_mode'],
  };
}

function validateRule(value: unknown, path: string): RulesetRule {
  const record = expectRecord(value, path);
  const type = expectString(record.type, `${path}.type`);

  if (type === 'deletion' || type === 'non_fast_forward') {
    rejectUnknownKeys(record, path, ['type']);
    return { type };
  }

  if (type === 'pull_request') {
    rejectUnknownKeys(record, path, ['type', 'parameters']);
    const parameters = expectRecord(record.parameters, `${path}.parameters`);
    rejectUnknownKeys(parameters, `${path}.parameters`, [
      'allowed_merge_methods',
      'dismiss_stale_reviews_on_push',
      'require_code_owner_review',
      'require_last_push_approval',
      'required_approving_review_count',
      'required_review_thread_resolution',
    ]);

    const allowedMergeMethods = expectStringArray(
      parameters.allowed_merge_methods,
      `${path}.parameters.allowed_merge_methods`,
    );
    for (const [index, method] of allowedMergeMethods.entries()) {
      if (!['merge', 'squash', 'rebase'].includes(method)) {
        fail(
          `${path}.parameters.allowed_merge_methods[${index}]`,
          'must be merge, squash, or rebase',
        );
      }
    }

    return {
      type,
      parameters: {
        allowed_merge_methods:
          allowedMergeMethods as Array<'merge' | 'squash' | 'rebase'>,
        dismiss_stale_reviews_on_push: expectBoolean(
          parameters.dismiss_stale_reviews_on_push,
          `${path}.parameters.dismiss_stale_reviews_on_push`,
        ),
        require_code_owner_review: expectBoolean(
          parameters.require_code_owner_review,
          `${path}.parameters.require_code_owner_review`,
        ),
        require_last_push_approval: expectBoolean(
          parameters.require_last_push_approval,
          `${path}.parameters.require_last_push_approval`,
        ),
        required_approving_review_count: expectNumber(
          parameters.required_approving_review_count,
          `${path}.parameters.required_approving_review_count`,
        ),
        required_review_thread_resolution: expectBoolean(
          parameters.required_review_thread_resolution,
          `${path}.parameters.required_review_thread_resolution`,
        ),
      },
    };
  }

  if (type === 'required_status_checks') {
    rejectUnknownKeys(record, path, ['type', 'parameters']);
    const parameters = expectRecord(record.parameters, `${path}.parameters`);
    rejectUnknownKeys(parameters, `${path}.parameters`, [
      'required_status_checks',
      'strict_required_status_checks_policy',
      'do_not_enforce_on_create',
    ]);

    const checks = expectArray(
      parameters.required_status_checks,
      `${path}.parameters.required_status_checks`,
    ).map((check, index) => {
      const checkRecord = expectRecord(
        check,
        `${path}.parameters.required_status_checks[${index}]`,
      );
      rejectUnknownKeys(
        checkRecord,
        `${path}.parameters.required_status_checks[${index}]`,
        ['context'],
      );
      return {
        context: expectNonEmptyString(
          checkRecord.context,
          `${path}.parameters.required_status_checks[${index}].context`,
        ),
      };
    });

    return {
      type,
      parameters: {
        required_status_checks: checks,
        strict_required_status_checks_policy: expectBoolean(
          parameters.strict_required_status_checks_policy,
          `${path}.parameters.strict_required_status_checks_policy`,
        ),
        do_not_enforce_on_create: expectBoolean(
          parameters.do_not_enforce_on_create,
          `${path}.parameters.do_not_enforce_on_create`,
        ),
      },
    };
  }

  fail(`${path}.type`, `unsupported rule type: ${type}`);
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  path: string,
  allowed: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail(`${path}.${key}`, 'is not supported');
    }
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'must be a string');
  }
  return value;
}

function expectNonEmptyString(value: unknown, path: string): string {
  const result = expectString(value, path);
  if (result.length === 0) {
    fail(path, 'must not be empty');
  }
  return result;
}

function expectStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) =>
    expectNonEmptyString(item, `${path}[${index}]`),
  );
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'must be a boolean');
  }
  return value;
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'must be a finite number');
  }
  return value;
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid governance config at ${path}: ${message}`);
}
