#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { runCli } from './cli-runner.ts';
import { GitHubClient } from './github-client.ts';

const code = await runCli(
  process.argv.slice(2),
  { GITHUB_TOKEN: process.env.GITHUB_TOKEN, GOVERNANCE_CONTENTS_TOKEN: process.env.GOVERNANCE_CONTENTS_TOKEN },
  (token, publicDiscovery, contentsToken) =>
    new GitHubClient(token, fetch, 'https://api.github.com', publicDiscovery ? 'public' : 'installation', contentsToken),
  {
    log: console.log,
    error: console.error,
  },
);

process.exitCode = code;
