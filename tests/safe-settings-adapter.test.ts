import { describe, expect, it } from 'vitest';
import { composeRepositoryPolicy } from '../src/policy-composer.js';
import { toSafeSettingsRepositoryConfig } from '../src/safe-settings-adapter.js';

describe('toSafeSettingsRepositoryConfig', () => {
  it('emits Safe Settings repository rulesets without changing semantics', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'libresign',
      isPublic: true,
      isArchived: false,
      isNextcloudApp: true,
    });

    const config = toSafeSettingsRepositoryConfig(policy);

    expect(config.rulesets).toEqual(policy.rulesets);
  });

  it('emits an empty config for unmanaged repositories', () => {
    const policy = composeRepositoryPolicy({
      owner: 'LibreSign',
      name: 'private',
      isPublic: false,
      isArchived: false,
      isNextcloudApp: false,
    });

    expect(toSafeSettingsRepositoryConfig(policy)).toEqual({});
  });
});
