<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Security model

GitHub Governance changes repository rulesets, so its caller workflow is a
privileged automation boundary.

## Trust boundaries

### Shared engine

The engine receives a repository-scoped token and caller-owned configuration.
It does not own organization credentials.

### Caller repository

The caller owns:

- policy;
- GitHub App identity;
- protected environment;
- organization discovery;
- repository-scoped token creation;
- the explicit decision to apply changes.

### GitHub App

The App private key is long-lived and sensitive. Installation access tokens are
short-lived and should be scoped as narrowly as the API allows.

## Credential model

Repository discovery requires visibility across the installation and therefore
uses one short-lived organization installation token. That token is used only
by the discovery job.

Reconciliation creates a separate token restricted to the current repository.
Mutation-capable credentials are not shared across the matrix.

The private key must remain in the caller's protected environment.

## Workflow controls

Production callers should:

- pin every third-party Action to a full commit SHA;
- keep the exact release version in a comment beside the SHA;
- set explicit workflow/job permissions;
- disable persisted checkout credentials unless required;
- avoid `pull_request_target` for code execution;
- avoid interpolating untrusted event data directly into shell commands;
- restrict privileged manual dispatches to `main`;
- protect privileged environments with branch restrictions and reviewers;
- keep dry-run as the default;
- make mutation an explicit action.

## Policy-change controls

Ruleset configuration is code and should receive the same review discipline as
application code.

Recommended required checks for the shared engine include:

- DCO;
- actionlint;
- REUSE Compliance Check;
- TypeScript;
- Vitest;
- zizmor.

Caller `.github` repositories should at minimum require DCO, actionlint and
zizmor for policy/workflow changes.

## Supply-chain controls

Current controls:

- immutable SHA pins for third-party Actions;
- Dependabot;
- separated major dependency updates;
- lifecycle scripts disabled during npm installation;
- REUSE licensing checks;
- actionlint and zizmor.

A remaining hardening item is to make runtime dependency installation fully
reproducible or eliminate it through a prebuilt/bundled action. That work is
tracked separately.

## Drift and fail-closed behavior

Dry-run returns failure when managed state differs from declared policy.
Configuration references to missing policies fail closed. Content-probe API
errors are not treated as negative matches.

The engine manages only resolved rulesets and must not delete unrelated
rulesets.

## Operational recommendations

Periodically audit:

- GitHub App installation permissions;
- repositories included in the installation;
- environment administrators and reviewers;
- branch/ruleset bypass actors;
- required status checks;
- Dependabot and security-scanner findings;
- scheduled dry-run results.
