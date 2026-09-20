#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { validateRelease } from './release-validator.js';

const requestedVersion = process.argv[2];

if (!requestedVersion) {
  console.error('Usage: validate-release vMAJOR.MINOR.PATCH');
  process.exitCode = 2;
} else {
  try {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version?: unknown };

    if (typeof packageJson.version !== 'string') {
      throw new Error('package.json must contain a string version.');
    }

    let tagExists = true;
    try {
      execFileSync(
        'git',
        ['rev-parse', '--verify', '--quiet', `refs/tags/${requestedVersion}`],
        { stdio: 'ignore' },
      );
    } catch {
      tagExists = false;
    }

    validateRelease({
      requestedVersion,
      packageVersion: packageJson.version,
      tagExists,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
