import { describe, expect, it } from 'vitest';
import { NEXTCLOUD_BOT_ID } from '../src/policies.js';
import { composeRepositoryPolicy } from '../src/policy-composer.js';

describe('composeRepositoryPolicy', () => {
  it('protects default and stable branches for public repositories', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'documentation',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: false,
    });

    expect(policy.rulesets).toHaveLength(1);
    expect(policy.rulesets[0]?.conditions.ref_name.include).toEqual([
      '~DEFAULT_BRANCH',
      'refs/heads/stable*',
    ]);
  });

  it('adds the pinned nextcloud-bot bypass to Nextcloud apps', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'libresign',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: true,
    });

    expect(
      policy.rulesets[0]?.bypass_actors.filter(
        (actor) =>
          actor.actor_type === 'User' &&
          actor.actor_id === NEXTCLOUD_BOT_ID &&
          actor.bypass_mode === 'always',
      ),
    ).toHaveLength(1);
  });

  it('does not add the Nextcloud bot bypass to ordinary repositories', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'documentation',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: false,
    });

    expect(
      policy.rulesets[0]?.bypass_actors.some(
        (actor) =>
          actor.actor_type === 'User' && actor.actor_id === NEXTCLOUD_BOT_ID,
      ),
    ).toBe(false);
  });

  it('does not manage private repositories', () => {
    expect(
      composeRepositoryPolicy({
        owner: 'LibreSign',
        name: 'private',
        isPublic: false,
        isArchived: false,
        isNextcloudApp: false,
      }).rulesets,
    ).toEqual([]);
  });

  it('does not manage archived repositories', () => {
    expect(
      composeRepositoryPolicy({
        owner: 'LibreSign',
        name: 'archive',
        isPublic: true,
        isArchived: true,
        isNextcloudApp: false,
      }).rulesets,
    ).toEqual([]);
  });

  it('adds repository-specific CI policy only to github-governance', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreCodeCoop',
      name: 'github-governance',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: false,
    });

    expect(policy.rulesets.map((ruleset) => ruleset.name)).toEqual([
      'Protect default and stable branches',
      'Require governance CI',
    ]);
  });

  it('does not mutate shared policies between calls', () => {
    const nextcloudPolicy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'libresign',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: true,
    });
    const ordinaryPolicy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'documentation',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: false,
    });

    expect(nextcloudPolicy.rulesets[0]?.bypass_actors).toHaveLength(2);
    expect(ordinaryPolicy.rulesets[0]?.bypass_actors).toHaveLength(1);
  });
});
