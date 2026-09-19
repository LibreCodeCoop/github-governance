<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# GitHub Governance

[![Vitest](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml)
[![TypeScript](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml)
[![REUSE status](https://api.reuse.software/badge/github.com/LibreCodeCoop/github-governance)](https://api.reuse.software/info/github.com/LibreCodeCoop/github-governance)

Security and repository governance as reviewed, testable code.

GitHub Governance reconciles repository rulesets from caller-owned declarative
configuration. The engine contains no organization-specific policy: each
organization defines its own rulesets, defaults, conditional exceptions, and
repository overrides.

The CLI is dry-run by default and the composite action supports short-lived
credentials scoped to one repository.

## Principles

- **Declarative:** policy belongs in configuration, not engine constants.
- **Secure by default:** changes are planned before they are applied.
- **Least privilege:** repository-scoped execution supports short-lived tokens.
- **Testable:** configuration, API behavior, and drift reconciliation have automated tests.
- **Reusable:** the same engine can serve unrelated GitHub organizations.
- **Open:** the project is licensed under AGPL-3.0-or-later and follows REUSE.

## Documentation

- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Development and quality checks](docs/development.md)
- [Safe Settings evaluation](docs/safe-settings.md)
