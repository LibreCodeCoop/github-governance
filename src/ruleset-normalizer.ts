import type { RepositoryRuleset, RulesetRule } from './types.js';

function normalizeRule(rule: RulesetRule): RulesetRule {
  if (rule.type === 'pull_request') {
    return {
      type: rule.type,
      parameters: {
        allowed_merge_methods: [...rule.parameters.allowed_merge_methods].sort(),
        dismiss_stale_reviews_on_push:
          rule.parameters.dismiss_stale_reviews_on_push,
        require_code_owner_review: rule.parameters.require_code_owner_review,
        require_last_push_approval: rule.parameters.require_last_push_approval,
        required_approving_review_count:
          rule.parameters.required_approving_review_count,
        required_review_thread_resolution:
          rule.parameters.required_review_thread_resolution,
      },
    };
  }

  if (rule.type === 'required_status_checks') {
    return {
      type: rule.type,
      parameters: {
        required_status_checks: [...rule.parameters.required_status_checks].sort(
          (a, b) => a.context.localeCompare(b.context),
        ),
        strict_required_status_checks_policy:
          rule.parameters.strict_required_status_checks_policy,
        do_not_enforce_on_create: rule.parameters.do_not_enforce_on_create,
      },
    };
  }

  return { type: rule.type };
}

export function normalizeRuleset(
  ruleset: RepositoryRuleset,
): RepositoryRuleset {
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    bypass_actors: ruleset.bypass_actors
      .map((actor) => ({
        ...actor,
        actor_id:
          actor.actor_type === 'OrganizationAdmin' ? 0 : actor.actor_id,
      }))
      .sort((a, b) =>
        [a.actor_type, a.actor_id, a.bypass_mode]
          .join(':')
          .localeCompare([b.actor_type, b.actor_id, b.bypass_mode].join(':')),
      ),
    conditions: {
      ref_name: {
        include: [...ruleset.conditions.ref_name.include].sort(),
        exclude: [...ruleset.conditions.ref_name.exclude].sort(),
      },
    },
    rules: ruleset.rules
      .map(normalizeRule)
      .sort((a, b) => a.type.localeCompare(b.type)),
  };
}

export function rulesetsEqual(
  left: RepositoryRuleset,
  right: RepositoryRuleset,
): boolean {
  return JSON.stringify(normalizeRuleset(left)) === JSON.stringify(normalizeRuleset(right));
}
