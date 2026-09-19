// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type BypassActor = {
  actor_id: number;
  actor_type: 'OrganizationAdmin' | 'User' | 'Team' | 'Integration';
  bypass_mode: 'always' | 'pull_request';
};

export type PullRequestRule = {
  type: 'pull_request';
  parameters: {
    allowed_merge_methods: Array<'merge' | 'squash' | 'rebase'>;
    dismiss_stale_reviews_on_push: boolean;
    require_code_owner_review: boolean;
    require_last_push_approval: boolean;
    required_approving_review_count: number;
    required_review_thread_resolution: boolean;
  };
};

export type RequiredStatusChecksRule = {
  type: 'required_status_checks';
  parameters: {
    required_status_checks: Array<{ context: string }>;
    strict_required_status_checks_policy: boolean;
    do_not_enforce_on_create: boolean;
  };
};

export type SimpleRule = {
  type: 'deletion' | 'non_fast_forward';
};

export type RulesetRule = PullRequestRule | RequiredStatusChecksRule | SimpleRule;

export type RepositoryRuleset = {
  name: string;
  target: 'branch';
  enforcement: 'active' | 'disabled' | 'evaluate';
  bypass_actors: BypassActor[];
  conditions: {
    ref_name: {
      include: string[];
      exclude: string[];
    };
  };
  rules: RulesetRule[];
};

export type RepositoryClassification = {
  owner: string;
  name: string;
  isPublic: boolean;
  isArchived: boolean;
  isNextcloudApp: boolean;
};

export type PolicySet = {
  rulesets: RepositoryRuleset[];
};
