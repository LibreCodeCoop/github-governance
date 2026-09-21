// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  loadGovernanceConfig,
  resolveRepositoryMetadata,
  resolveRepositoryRulesets,
  type GovernanceConfig,
} from './config.ts';
import type { GovernanceClient } from './governance.ts';
import {
  planOrganization,
  planRepository,
  syncOrganization,
  syncRepository,
} from './governance.ts';

export type CliEnvironment = {
  GITHUB_TOKEN?: string | undefined;
};

export type CliOutput = {
  log(message: string): void;
  error(message: string): void;
};

export type GovernanceConfigLoader = (
  path: string | undefined,
) => Promise<GovernanceConfig>;

export async function runCli(
  args: string[],
  environment: CliEnvironment,
  clientFactory: (token: string) => GovernanceClient,
  output: CliOutput,
  configLoader: GovernanceConfigLoader = loadGovernanceConfig,
): Promise<number> {
  const organization = option(args, '--org');
  const repositoryArgument = option(args, '--repo');
  const configPath = option(args, '--config');
  const apply = args.includes('--apply');
  const token = environment.GITHUB_TOKEN;

  if ((organization ? 1 : 0) + (repositoryArgument ? 1 : 0) !== 1) {
    output.error('Specify exactly one of --org OWNER or --repo OWNER/REPO');
    return 2;
  }

  if (!token) {
    output.error('GITHUB_TOKEN is required');
    return 2;
  }

  const client = clientFactory(token);
  const config = await configLoader(configPath);
  const resolveRulesets = (repository: {
    owner: string;
    name: string;
    visibility: 'public' | 'private' | 'internal';
    archived: boolean;
    description: string | null;
    homepage: string | null;
    topics: string[];
  }) => resolveRepositoryRulesets(config, repository, client);
  const resolveMetadata = (repository: {
    owner: string;
    name: string;
    visibility: 'public' | 'private' | 'internal';
    archived: boolean;
    description: string | null;
    homepage: string | null;
    topics: string[];
  }) => resolveRepositoryMetadata(config, repository);

  if (repositoryArgument) {
    const [owner, repository, ...extra] = repositoryArgument.split('/');
    if (!owner || !repository || extra.length > 0) {
      output.error('--repo must use OWNER/REPO');
      return 2;
    }

    const metadata = await client.getRepository(owner, repository);
    const desiredRulesets = await resolveRulesets(metadata);
    const desiredMetadata = resolveMetadata(metadata);
    const plan = apply
      ? await syncRepository(client, metadata, desiredRulesets, desiredMetadata)
      : await planRepository(client, metadata, desiredRulesets, desiredMetadata);

    writePlans([plan], apply, output);
    return !apply && hasDrift([plan]) ? 1 : 0;
  }

  const plans = apply
    ? await syncOrganization(client, organization!, resolveRulesets, resolveMetadata)
    : await planOrganization(client, organization!, resolveRulesets, resolveMetadata);

  writePlans(plans, apply, output);
  return !apply && hasDrift(plans) ? 1 : 0;
}

function writePlans(
  plans: Awaited<ReturnType<typeof planOrganization>>,
  apply: boolean,
  output: CliOutput,
): void {
  for (const plan of plans) {
    const changes = plan.changes.filter(
      (change) => change.action !== 'unchanged',
    );

    const metadataDrift = plan.metadata?.action === 'update';

    if (changes.length === 0 && !metadataDrift) {
      output.log(`OK ${plan.repository}`);
      continue;
    }

    output.log(`${apply ? 'APPLIED' : 'DRIFT'} ${plan.repository}`);
    for (const change of changes) {
      output.log(`  - ${change.action}: ${change.desired.name}`);
    }
    if (metadataDrift) {
      output.log(`  - update metadata: ${plan.metadata!.fields.join(', ')}`);
    }
  }
}

function hasDrift(
  plans: Awaited<ReturnType<typeof planOrganization>>,
): boolean {
  return plans.some(
    (plan) =>
      plan.changes.some((change) => change.action !== 'unchanged') ||
      plan.metadata?.action === 'update',
  );
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}
