// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NEXTCLOUD_BOT_ID, baseRuleset } from './policies.js';
import type {
  PolicySet,
  RepositoryClassification,
  RepositoryRuleset,
} from './types.js';

export type RepositoryPolicyOptions = {
  extraRulesets?: RepositoryRuleset[];
};

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
  options: RepositoryPolicyOptions = {},
): PolicySet {
  if (!repository.isPublic || repository.isArchived) {
    return { rulesets: [] };
  }

  const rulesets = [
    repository.isNextcloudApp
      ? withNextcloudBotBypass(baseRuleset)
      : cloneRuleset(baseRuleset),
    ...(options.extraRulesets ?? []).map(cloneRuleset),
  ];

  return { rulesets };
}
