#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { discoverPublicRepositories } from './repository-discovery.js';

const organization = process.argv[2];

if (!organization) {
  console.error('Usage: discover-repositories ORGANIZATION');
  process.exitCode = 2;
} else {
  try {
    const repositories = await discoverPublicRepositories(
      organization,
      process.env.GITHUB_TOKEN,
    );
    console.log(JSON.stringify(repositories));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
