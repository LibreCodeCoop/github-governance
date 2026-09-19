// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from 'node:fs/promises';
import type {
  BypassActor,
  RepositoryRuleset,
} from './types.js';
import type {
  GitHubContentProbe,
  RepositoryMetadata,
} from './repository-classifier.js';

export type RepositoryGovernanceConfig = {
  policies?: string[];
  rulesets?: RepositoryRuleset[];
};

export type ConditionalGovernanceConfig = {
  when: {
    file_exists: string;
  };
  policies?: string[];
  rulesets?: RepositoryRuleset[];
  add_bypass_actors?: Record<string, BypassActor[]>;
};

export type GovernanceConfig = {
  policies?: Record<string, RepositoryRuleset>;
  defaults?: RepositoryGovernanceConfig;
  conditions?: ConditionalGovernanceConfig[];
  repositories?: Record<string, RepositoryGovernanceConfig>;
};

export async function loadGovernanceConfig(
  path: string | undefined,
): Promise<GovernanceConfig> {
  if (!path) {
    return {};
  }

  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error('Governance config must be a JSON object');
  }

  return parsed as GovernanceConfig;
}

export async function resolveRepositoryRulesets(
  config: GovernanceConfig,
  repository: RepositoryMetadata,
  probe: GitHubContentProbe,
): Promise<RepositoryRuleset[]> {
  if (repository.visibility !== 'public' || repository.archived) {
    return [];
  }

  const resolved = new Map<string, RepositoryRuleset>();

  applySelection(config, config.defaults, resolved);

  applySelection(config, config.repositories?.[repository.name], resolved);

  for (const condition of config.conditions ?? []) {
    if (
      await probe.exists(
        repository.owner,
        repository.name,
        condition.when.file_exists,
      )
    ) {
      applySelection(config, condition, resolved);
      applyBypassActors(config, condition, resolved);
    }
  }

  return [...resolved.values()].map((ruleset) => structuredClone(ruleset));
}

function applySelection(
  config: GovernanceConfig,
  selection: RepositoryGovernanceConfig | ConditionalGovernanceConfig | undefined,
  resolved: Map<string, RepositoryRuleset>,
): void {
  if (!selection) {
    return;
  }

  for (const policy of selection.policies ?? []) {
    const ruleset = config.policies?.[policy];
    if (!ruleset) {
      throw new Error(`Unknown governance policy: ${policy}`);
    }
    resolved.set(ruleset.name, structuredClone(ruleset));
  }

  for (const ruleset of selection.rulesets ?? []) {
    resolved.set(ruleset.name, structuredClone(ruleset));
  }
}

function applyBypassActors(
  config: GovernanceConfig,
  condition: ConditionalGovernanceConfig,
  resolved: Map<string, RepositoryRuleset>,
): void {
  for (const [policy, actors] of Object.entries(
    condition.add_bypass_actors ?? {},
  )) {
    const configured = config.policies?.[policy];
    if (!configured) {
      throw new Error(`Unknown governance policy: ${policy}`);
    }

    const target = resolved.get(configured.name);
    if (!target) {
      throw new Error(
        `Conditional bypass targets policy that is not selected: ${policy}`,
      );
    }

    for (const actor of actors) {
      const exists = target.bypass_actors.some(
        (candidate) =>
          candidate.actor_id === actor.actor_id &&
          candidate.actor_type === actor.actor_type &&
          candidate.bypass_mode === actor.bypass_mode,
      );
      if (!exists) {
        target.bypass_actors.push(structuredClone(actor));
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
