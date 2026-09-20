<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# GitHub Governance

[![Vitest](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml)
[![TypeScript](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml)
[![REUSE status](https://api.reuse.software/badge/github.com/LibreCodeCoop/github-governance)](https://api.reuse.software/info/github.com/LibreCodeCoop/github-governance)

Declarative, testable GitHub repository governance for organizations that want
consistent security controls without maintaining rulesets repository by
repository.

GitHub Governance reconciles repository rulesets from configuration owned by
each organization. The engine stays organization-agnostic: branch protections,
review requirements, required checks, conditional exceptions and repository
overrides are declared by the caller.

## Why use it

- **Consistent governance:** define policy once and reconcile it across an organization.
- **Reviewable changes:** policy evolves through pull requests instead of manual UI changes.
- **Safe operations:** dry-run is the default and mutation requires explicit apply.
- **Credential isolation:** each organization owns its GitHub App and protected environment.
- **Least privilege:** reconciliation uses short-lived tokens scoped to one repository.
- **Reusable architecture:** product-specific exceptions stay in caller configuration, not engine code.
- **Auditable dependencies:** third-party Actions are pinned to immutable commit SHAs.

## Production references

The same engine is used by two independent caller repositories:

- [LibreSign/.github](https://github.com/LibreSign/.github) — LibreSign organization policy.
- [LibreCodeCoop/.github](https://github.com/LibreCodeCoop/.github) — LibreCode Coop organization policy and additional CI requirements for this project.

These are reference implementations, not engine dependencies.

## How it works

1. The caller discovers public, non-archived repositories.
2. A short-lived organization token is used only for discovery.
3. Each repository gets its own short-lived GitHub App token.
4. Caller-owned configuration resolves the desired rulesets.
5. The engine compares desired and current state.
6. Dry-run reports drift; explicit apply reconciles it.

## Adopt it

Start with the [adoption guide](docs/adoption.md). It covers the GitHub App,
protected environment, caller workflow, configuration, dry-run validation and
controlled rollout.

Consumers should pin releases by immutable SHA and keep the corresponding
version as a comment:

```yaml
uses: LibreCodeCoop/github-governance@<full-release-sha> # v0.1.0
```

The SHA is the security boundary; the version comment is the human-readable
release reference.

## Security

Read the [security model](docs/security.md) before production adoption.
Vulnerabilities should be reported according to [SECURITY.md](SECURITY.md).

## Documentation

- [Adoption guide](docs/adoption.md)
- [Configuration reference](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Development and quality checks](docs/development.md)
- [Release process](docs/releases.md)
- [Safe Settings evaluation](docs/safe-settings.md)

GitHub Governance is free software licensed under AGPL-3.0-or-later and follows
the REUSE specification.
