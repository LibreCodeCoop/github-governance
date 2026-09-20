#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { runCli } from './cli-runner.ts';
import { GitHubClient } from './github-client.ts';

const code = await runCli(
  process.argv.slice(2),
  { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
  (token) => new GitHubClient(token),
  {
    log: console.log,
    error: console.error,
  },
);

process.exitCode = code;
