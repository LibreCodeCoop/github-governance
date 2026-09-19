import { readFile } from 'node:fs/promises';
import { namedRulesets } from './policies.js';
import type { RepositoryRuleset } from './types.js';

export type RepositoryGovernanceConfig = {
  policies?: string[];
  rulesets?: RepositoryRuleset[];
};

export type GovernanceConfig = {
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

  const repositories = parsed.repositories;
  if (repositories === undefined) {
    return {};
  }
  if (!isRecord(repositories)) {
    throw new Error('Governance config repositories must be an object');
  }

  return {
    repositories: repositories as Record<string, RepositoryGovernanceConfig>,
  };
}

export function resolveExtraRulesets(
  config: GovernanceConfig,
  repository: string,
): RepositoryRuleset[] {
  const repositoryConfig = config.repositories?.[repository];
  if (!repositoryConfig) {
    return [];
  }

  const rulesets: RepositoryRuleset[] = [];

  for (const policy of repositoryConfig.policies ?? []) {
    const ruleset = namedRulesets[policy];
    if (!ruleset) {
      throw new Error(`Unknown governance policy: ${policy}`);
    }
    rulesets.push(structuredClone(ruleset));
  }

  for (const ruleset of repositoryConfig.rulesets ?? []) {
    rulesets.push(structuredClone(ruleset));
  }

  return rulesets;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
