<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# GitHub Governance

[![Vitest](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/vitest.yml)
[![TypeScript](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml/badge.svg)](https://github.com/LibreCodeCoop/github-governance/actions/workflows/typescript.yml)
[![REUSE status](https://api.reuse.software/badge/github.com/LibreCodeCoop/github-governance)](https://api.reuse.software/info/github.com/LibreCodeCoop/github-governance)

Security and repository governance as reviewed, testable code.

GitHub Governance helps LibreCode Coop and LibreSign keep repository protection
consistent without copying automation between organizations. Policies are
centrally maintained, dry-run by default, and can be applied with short-lived
credentials scoped to a single repository.

The first capability manages GitHub repository rulesets, including automatic
Nextcloud app detection and the required `nextcloud-bot` exception.

## Principles

- **Secure by default:** changes are planned before they are applied.
- **Least privilege:** repository-scoped execution supports short-lived tokens.
- **Testable:** policy composition, API behavior, and drift reconciliation have automated tests.
- **Reusable:** organization repositories keep configuration, not duplicated implementation.
- **Open:** the project is licensed under AGPL-3.0-or-later and follows REUSE.

## Documentation

- [Architecture](docs/architecture.md)
- [Development and quality checks](docs/development.md)
- [Safe Settings evaluation](docs/safe-settings.md)
