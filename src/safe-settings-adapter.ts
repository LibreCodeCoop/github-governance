import type { PolicySet, RepositoryRuleset } from './types.js';

export type SafeSettingsRepositoryConfig = {
  rulesets?: RepositoryRuleset[];
};

export function toSafeSettingsRepositoryConfig(
  policy: PolicySet,
): SafeSettingsRepositoryConfig {
  if (policy.rulesets.length === 0) {
    return {};
  }

  return {
    rulesets: structuredClone(policy.rulesets),
  };
}
