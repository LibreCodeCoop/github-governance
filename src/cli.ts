#!/usr/bin/env node

import { GitHubClient } from './github-client.js';
import { planOrganization, syncOrganization } from './governance.js';

const args = process.argv.slice(2);
const organization = option(args, '--org');
const apply = args.includes('--apply');
const token = process.env.GITHUB_TOKEN;

if (!organization) {
  console.error('Missing required --org OWNER');
  process.exit(2);
}

if (!token) {
  console.error('GITHUB_TOKEN is required');
  process.exit(2);
}

const client = new GitHubClient(token);
const plans = apply
  ? await syncOrganization(client, organization)
  : await planOrganization(client, organization);

for (const plan of plans) {
  const changes = plan.changes.filter((change) => change.action !== 'unchanged');
  const prefix = plan.isNextcloudApp ? 'Nextcloud app' : 'repository';

  if (changes.length === 0) {
    console.log(`OK ${plan.repository} (${prefix})`);
    continue;
  }

  console.log(`${apply ? 'APPLIED' : 'DRIFT'} ${plan.repository} (${prefix})`);
  for (const change of changes) {
    console.log(`  - ${change.action}: ${change.action === 'unchanged' ? change.current.name : change.desired.name}`);
  }
}

if (!apply && plans.some((plan) => plan.changes.some((change) => change.action !== 'unchanged'))) {
  process.exitCode = 1;
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}
