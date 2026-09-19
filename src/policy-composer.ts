import {
  NEXTCLOUD_BOT_ID,
  baseRuleset,
  governanceRepositoryCiRuleset,
} from './policies.js';
import type {
  PolicySet,
  RepositoryClassification,
  RepositoryRuleset,
} from './types.js';

function cloneRuleset(ruleset: RepositoryRuleset): RepositoryRuleset {
  return structuredClone(ruleset);
}

function withNextcloudBotBypass(ruleset: RepositoryRuleset): RepositoryRuleset {
  const next = cloneRuleset(ruleset);
  const alreadyPresent = next.bypass_actors.some(
    (actor) =>
      actor.actor_type === 'User' &&
      actor.actor_id === NEXTCLOUD_BOT_ID &&
      actor.bypass_mode === 'always',
  );

  if (!alreadyPresent) {
    next.bypass_actors.push({
      actor_id: NEXTCLOUD_BOT_ID,
      actor_type: 'User',
      bypass_mode: 'always',
    });
  }

  return next;
}

export function composeRepositoryPolicy(
  repository: RepositoryClassification,
): PolicySet {
  if (!repository.isPublic || repository.isArchived) {
    return { rulesets: [] };
  }

  const rulesets = [
    repository.isNextcloudApp
      ? withNextcloudBotBypass(baseRuleset)
      : cloneRuleset(baseRuleset),
  ];

  if (
    repository.owner === 'LibreCodeCoop' &&
    repository.name === 'github-governance'
  ) {
    rulesets.push(cloneRuleset(governanceRepositoryCiRuleset));
  }

  return { rulesets };
}
