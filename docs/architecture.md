<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Architecture

GitHub Governance separates shared implementation from organization-specific
configuration.

## Responsibilities

The central repository owns:

- shared repository policies;
- repository classification;
- GitHub API access;
- drift planning and reconciliation;
- dry-run and apply behavior;
- automated tests.

Organization repositories such as `LibreSign/.github` and
`LibreCodeCoop/.github` should keep only:

- organization-specific policy selection;
- exceptional repository overrides;
- GitHub App credentials;
- a small workflow that invokes the shared implementation.

## Execution model

Repository-scoped execution is preferred for production changes.

A caller can enumerate repositories with read-only permissions, generate a
short-lived GitHub App token restricted to one repository, and invoke the
governance CLI for that repository. This preserves the limited blast radius of
the existing LibreSign automation without duplicating its implementation.

The CLI is dry-run by default. Mutation requires an explicit `--apply`.

Production callers invoke the repository's composite action from their own
privileged workflow. Token creation remains in the caller so GitHub App
credentials can stay protected by the caller's environment and each token can
remain scoped to one repository.

## Policy model

The base policy applies to public, non-archived repositories.

Nextcloud applications are detected through `appinfo/info.xml`. They receive
the pinned `nextcloud-bot` bypass required for translation workflows.

Shared additional policies can be selected by name from caller configuration.
Exceptional repository-specific rulesets can be declared by the caller without
hardcoding organization or repository names in the engine.

## Current scope

The first capability is repository ruleset reconciliation. Other GitHub settings
should use established upstream tooling when it provides the required behavior.
See [Safe Settings evaluation](safe-settings.md).
