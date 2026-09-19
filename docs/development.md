<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Development and quality

Quality checks are intentionally split by tool so failures are easy to identify
and each workflow has a clear responsibility.

## Local checks

Install dependencies and run the complete local check:

```bash
npm install
npm run check
```

Build the CLI with:

```bash
npm run build
```

## GitHub Actions

The repository uses separate workflows for:

- `actionlint.yml`: validates GitHub Actions syntax and embedded shell;
- `vitest.yml`: runs behavior and policy tests;
- `typescript.yml`: runs strict TypeScript checks and builds the CLI;
- `reuse.yml`: validates SPDX and REUSE compliance;
- `zizmor.yml`: audits GitHub Actions security.

Actions are pinned to commit SHAs and workflows use read-only permissions unless
additional access is required.

## Licensing

Source and test files carry SPDX headers directly. Formats where inline comments
are undesirable are covered by `REUSE.toml`.

The project license is AGPL-3.0-or-later and the canonical license text is stored
under `LICENSES/`.

## Governance CLI

The CLI is dry-run by default:

```bash
GITHUB_TOKEN=... node dist/cli.js --org LibreSign --config /path/to/governance.config.json
GITHUB_TOKEN=... node dist/cli.js --repo LibreSign/libresign --config /path/to/governance.config.json
```

Mutation requires `--apply`.

Production integration must prove parity with the existing LibreSign ruleset
automation before the old implementation is removed.
