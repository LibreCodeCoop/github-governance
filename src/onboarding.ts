// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { GovernanceClient } from './governance.ts';
import type { RepositoryMetadata } from './repository-classifier.ts';
import type { RepositoryRuleset } from './types.ts';
import { rulesetsEqual } from './ruleset-normalizer.ts';

export interface OnboardingClient extends GovernanceClient {
  classicProtection(
    owner: string,
    repository: string,
    branch: string,
  ): Promise<'absent' | 'present' | 'uninitialized'>;
}

export type OnboardingResult = {
  repository: string;
  status: 'created' | 'unchanged' | 'review' | 'skipped';
  reason: string;
};

/**
 * Only install a missing, already-classified organization default ruleset.
 * Never update existing rulesets, repository metadata, or legacy protection.
 */
export async function onboardRepository(
  client: OnboardingClient,
  repo: RepositoryMetadata,
  expected: RepositoryRuleset,
): Promise<OnboardingResult> {
  const repository = `${repo.owner}/${repo.name}`;
  if (repo.archived || repo.visibility !== 'public') {
    return { repository, status: 'skipped', reason: 'only public, non-archived repositories are eligible' };
  }
  if (!repo.defaultBranch || !/^[A-Za-z0-9._/-]+$/.test(repo.defaultBranch)) {
    return { repository, status: 'review', reason: 'default branch could not be verified' };
  }
  // Inspect legacy protection even on repositories whose common ruleset is
  // already present: overlapping classic protection can defeat its bypass.
  const classic = await client.classicProtection(repo.owner, repo.name, repo.defaultBranch);
  if (classic !== 'absent') {
    return {
      repository,
      status: 'review',
      reason: classic === 'present' ? 'classic branch protection requires manual migration' : 'default branch not initialized',
    };
  }
  const current = await client.list(repo.owner, repo.name);
  // A conditional direct-push exception (e.g. the Nextcloud translation bot)
  // must be honored by EVERY active rule protecting the default branch.
  const directPushActors = expected.bypass_actors.filter(
    (actor) => actor.actor_type === 'User' && actor.bypass_mode === 'always',
  );
  for (const rule of current) {
    if (rule.name === expected.name || rule.enforcement !== 'active') continue;
    if (directPushActors.some((actor) => !rule.bypass_actors.some(
      (candidate) => candidate.actor_type === actor.actor_type &&
        candidate.actor_id === actor.actor_id && candidate.bypass_mode === 'always',
    ))) {
      return { repository, status: 'review', reason: `active ruleset ${rule.name} does not permit required direct-push actor` };
    }
  }
  const matching = current.find((rule) => rule.name === expected.name);
  if (matching) {
    if (matching.bypass_actors_redacted || !rulesetsEqual(matching, expected)) {
      return { repository, status: 'review', reason: 'existing common ruleset differs or has hidden bypass actors' };
    }
    return { repository, status: 'unchanged', reason: 'common ruleset already present' };
  }
  // A repository with any other ruleset needs human inspection, including the
  // case of another active CI/DCO policy that might block a translation bot.
  if (current.length > 0) {
    return { repository, status: 'review', reason: 'existing additional rulesets require review' };
  }
  await client.create(repo.owner, repo.name, expected);
  return { repository, status: 'created', reason: 'default organization ruleset created' };
}
