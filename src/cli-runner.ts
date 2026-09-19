import type { GovernanceClient } from './governance.js';
import { planOrganization, syncOrganization } from './governance.js';

export type CliEnvironment = {
  GITHUB_TOKEN?: string;
};

export type CliOutput = {
  log(message: string): void;
  error(message: string): void;
};

export async function runCli(
  args: string[],
  environment: CliEnvironment,
  clientFactory: (token: string) => GovernanceClient,
  output: CliOutput,
): Promise<number> {
  const organization = option(args, '--org');
  const apply = args.includes('--apply');
  const token = environment.GITHUB_TOKEN;

  if (!organization) {
    output.error('Missing required --org OWNER');
    return 2;
  }

  if (!token) {
    output.error('GITHUB_TOKEN is required');
    return 2;
  }

  const client = clientFactory(token);
  const plans = apply
    ? await syncOrganization(client, organization)
    : await planOrganization(client, organization);

  let hasDrift = false;

  for (const plan of plans) {
    const changes = plan.changes.filter(
      (change) => change.action !== 'unchanged',
    );
    const kind = plan.isNextcloudApp ? 'Nextcloud app' : 'repository';

    if (changes.length === 0) {
      output.log(`OK ${plan.repository} (${kind})`);
      continue;
    }

    hasDrift = true;
    output.log(
      `${apply ? 'APPLIED' : 'DRIFT'} ${plan.repository} (${kind})`,
    );
    for (const change of changes) {
      const name =
        change.action === 'unchanged'
          ? change.current.name
          : change.desired.name;
      output.log(`  - ${change.action}: ${name}`);
    }
  }

  return !apply && hasDrift ? 1 : 0;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}
