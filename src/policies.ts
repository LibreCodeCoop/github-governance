import type { RepositoryRuleset } from './types.js';

export const NEXTCLOUD_BOT_ID = 20296731;

export const baseRuleset: RepositoryRuleset = {
  name: 'Protect default and stable branches',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [
    {
      actor_id: 0,
      actor_type: 'OrganizationAdmin',
      bypass_mode: 'pull_request',
    },
  ],
  conditions: {
    ref_name: {
      include: ['~DEFAULT_BRANCH', 'refs/heads/stable*'],
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
};

export const governanceRepositoryCiRuleset: RepositoryRuleset = {
  name: 'Require governance CI',
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [
    {
      actor_id: 0,
      actor_type: 'OrganizationAdmin',
      bypass_mode: 'pull_request',
    },
  ],
  conditions: {
    ref_name: {
      include: ['~DEFAULT_BRANCH'],
      exclude: [],
    },
  },
  rules: [
    {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: [
          { context: 'Governance policy tests' },
          { context: 'TypeScript' },
        ],
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: false,
      },
    },
  ],
};
