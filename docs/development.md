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

## Composite action

Organization repositories should keep repository discovery and GitHub App token
generation in their own privileged workflow, then call this repository's
`action.yml` once per repository.

This is intentional: environment-protected credentials remain owned by the
caller and are never moved to a broader repository or organization secret just
to satisfy reusable-workflow secret propagation.

The action remains dry-run unless `apply: 'true'` is passed.


## GitHub Actions dependencies

Third-party GitHub Actions must be pinned to an immutable full commit SHA and
annotated with the exact release version represented by that SHA:

```yaml
uses: actions/checkout@<full-commit-sha> # vX.Y.Z
```

Do not use floating tags such as `@v3` or `@main` in workflow execution.

Dependabot monitors GitHub Actions dependencies and should update both the
immutable pin and its corresponding release reference.

Reusable actions from this repository follow the same convention once a real
Git tag/release exists. Do not label a SHA with a version that has not actually
been published.
