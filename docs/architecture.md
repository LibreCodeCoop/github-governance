<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Architecture

GitHub Governance separates a generic reconciliation engine from caller-owned
policy.

## Responsibilities

The central repository owns:

- configuration loading and validation;
- generic repository metadata and content probes;
- GitHub API access;
- ruleset normalization;
- drift planning and reconciliation;
- dry-run and apply behavior;
- automated tests.

Caller repositories own:

- named rulesets;
- default policy selection;
- conditional policy changes;
- repository-specific overrides;
- GitHub App credentials;
- the workflow that invokes the shared implementation.

The engine must not need product names, organization names, repository names,
actor IDs, or product-specific file paths to reconcile policy.

## Execution model

Repository-scoped execution is preferred for production changes.

A caller uses a short-lived organization installation token only for repository
discovery, then generates a separate short-lived GitHub App token restricted to
one repository for reconciliation. The organization-wide token is intentionally
limited to the discovery job; mutation-capable tokens remain repository-scoped.

The CLI is dry-run by default. Mutation requires an explicit `--apply`.

Production callers create tokens in their own protected environment. This keeps
credential ownership and approval boundaries in the organization being managed.

## Policy model

Policies are declared in the caller's configuration and can be selected:

- by default for every managed public, non-archived repository;
- for a specific repository;
- conditionally when a generic repository probe such as `file_exists` matches.

Conditions can add policies, local rulesets, or bypass actors to an already
selected policy. The reconciliation engine only manages rulesets named in the
resolved desired configuration and does not delete unrelated rulesets.

See [Configuration](configuration.md).

## Current scope

The first capability is repository ruleset reconciliation. Other GitHub settings
should use established upstream tooling when it provides the required behavior.
See [Safe Settings evaluation](safe-settings.md).
