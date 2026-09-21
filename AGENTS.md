<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Agent guidance

## Purpose

This repository owns the organization-agnostic engine that discovers repositories and reconciles declarative GitHub repository governance, rulesets and supported repository metadata.

## Boundaries

- Organization/product policy belongs in caller-owned `governance.config.json`, not hard-coded in the engine.
- Keep dry-run as the safe default; mutation must remain explicit.
- Repository metadata reconciliation may manage GitHub settings such as description, homepage and topics.
- File content such as licenses, README files and `AGENTS.md` remains version-controlled in each repository.
- Release automation belongs in `LibreCodeCoop/github-workflows`, not here.

## Quality gates

Run or rely on CI for:

- TypeScript build/type checks;
- Vitest;
- actionlint;
- zizmor;
- CodeQL;
- REUSE compliance.

## Security

- Use short-lived GitHub App tokens with the narrowest repository scope.
- Do not centralize caller credentials in this repository.
- Do not weaken rulesets silently to make reconciliation pass.
- Keep third-party actions pinned to immutable SHAs.

## SPDX / REUSE

New repository-owned files use AGPL-3.0-or-later and must satisfy REUSE/SPDX checks.
