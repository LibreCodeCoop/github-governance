#!/usr/bin/env node

import { runCli } from './cli-runner.js';
import { GitHubClient } from './github-client.js';

const code = await runCli(
  process.argv.slice(2),
  process.env,
  (token) => new GitHubClient(token),
  {
    log: console.log,
    error: console.error,
  },
);

process.exitCode = code;
