<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Adoption guide

This guide describes the production model used by LibreSign and LibreCode Coop.

## 1. Create the caller repository

Keep organization-specific policy in the organization's own `.github`
repository. The shared engine does not need organization-specific code.

A caller needs:

- `governance.config.json`;
- a governance workflow;
- a protected environment for GitHub App credentials.

Reference implementations:

- https://github.com/LibreSign/.github
- https://github.com/LibreCodeCoop/.github

## 2. Create and install a GitHub App

Use a GitHub App owned by or trusted by the organization being managed.

The current public-repository model needs repository administration access.
GitHub requires administration write access for complete ruleset responses,
including bypass actors, even during dry-run.

Keep the App private key in an environment secret. Do not commit it or move it
to the shared governance repository.

Recommended caller variables:

- `RULESET_APP_CLIENT_ID`: environment variable;
- `RULESET_APP_PRIVATE_KEY`: environment secret.

## 3. Protect the environment

Create an environment such as `ruleset-sync`.

Recommended controls:

- restrict deployment branches to `main`;
- require reviewers for privileged/manual operations where the GitHub plan supports it;
- limit who can administer the environment;
- keep the App private key only in the environment.

The workflow should also reject manually-dispatched privileged jobs outside
`main`. Environment restrictions remain an independent defense-in-depth layer.

## 4. Define policy

The caller owns the desired rulesets.

A minimal configuration can define one named policy and select it by default:

```json
{
  "policies": {
    "protected-branches": {
      "name": "Protect default branch",
      "target": "branch",
      "enforcement": "active",
      "bypass_actors": [],
      "conditions": {
        "ref_name": {
          "include": ["~DEFAULT_BRANCH"],
          "exclude": []
        }
      },
      "rules": [
        {"type": "deletion"},
        {"type": "non_fast_forward"}
      ]
    }
  },
  "defaults": {
    "policies": ["protected-branches"]
  }
}
```

See [Configuration](configuration.md) for conditions, repository overrides and
supported rules.

## 5. Pin the shared action

Never execute a floating branch or major-version tag.

After `v0.1.0` is published, use the release commit SHA:

```yaml
uses: LibreCodeCoop/github-governance/discover@<v0.1.0-commit-sha> # v0.1.0
uses: LibreCodeCoop/github-governance@<v0.1.0-commit-sha> # v0.1.0
```

Dependabot can propose future pinned updates.

## 6. Roll out safely

Recommended rollout:

1. merge caller configuration and workflow;
2. run organization-wide dry-run;
3. inspect every reported change;
4. resolve unexpected drift;
5. run one controlled `apply=true`;
6. run dry-run again;
7. require zero drift before retiring older automation.

Do not use `apply=true` as a way to discover what a policy does.

## 7. Maintain it

- review Dependabot pull requests;
- keep major dependency upgrades isolated;
- keep action SHAs immutable;
- review policy changes through pull requests;
- run scheduled dry-runs to detect manual drift;
- periodically review GitHub App and environment permissions.
