<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Configuration reference

The caller owns the complete desired policy. The engine does not ship a default
branch-protection policy or product-specific exception.

The configuration file is JSON and is typically named
`governance.config.json`.

## Resolution order

For each managed public, non-archived repository the engine resolves desired
rulesets in this order:

1. `defaults`;
2. `repositories.<repository-name>`;
3. matching `conditions`.

Rulesets are keyed internally by ruleset name. A later selection with the same
ruleset name replaces the earlier selected definition. Conditional bypass actors
are applied after policy selection.

Private and archived repositories currently resolve to no managed rulesets.

## Top-level keys

### `policies`

A map of reusable named rulesets.

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
  }
}
```

The map key such as `protected-branches` is the policy identifier used by
`defaults`, `conditions` and `repositories`. The ruleset's `name` is the
actual GitHub ruleset name.

### `defaults`

Select policies or inline rulesets for every managed repository.

```json
{
  "defaults": {
    "policies": ["protected-branches"]
  }
}
```

### `repositories`

Add or replace policy selection for a repository by repository name.

```json
{
  "repositories": {
    "critical-repository": {
      "policies": [
        "protected-branches",
        "required-ci"
      ]
    }
  }
}
```

Repository-specific selection is useful when one repository has stronger CI or
review requirements than the organization default.

### `conditions`

Apply generic behavior based on repository properties. The currently supported
matcher is `file_exists`.

```json
{
  "conditions": [
    {
      "when": {
        "file_exists": "path/to/marker"
      },
      "policies": ["framework-policy"],
      "add_bypass_actors": {
        "protected-branches": [
          {
            "actor_id": 1234,
            "actor_type": "User",
            "bypass_mode": "always"
          }
        ]
      }
    }
  ]
}
```

A failed content probe fails closed. An API error is not interpreted as
"file does not exist".

## Ruleset fields

### `target`

Currently supported value:

- `branch`

### `enforcement`

Supported values:

- `active`
- `disabled`
- `evaluate`

### `conditions.ref_name`

`include` and `exclude` are arrays of GitHub ref patterns.

Examples:

- `~DEFAULT_BRANCH`
- `refs/heads/stable*`

### `bypass_actors`

Supported actor types:

- `OrganizationAdmin`
- `User`
- `Team`
- `Integration`

Supported bypass modes:

- `always`
- `pull_request`

Actor IDs are GitHub numeric IDs and belong in caller configuration, not in the
shared engine.

## Supported rules

### Prevent deletion

```json
{"type": "deletion"}
```

### Prevent non-fast-forward updates

```json
{"type": "non_fast_forward"}
```

### Pull request requirements

```json
{
  "type": "pull_request",
  "parameters": {
    "allowed_merge_methods": ["merge", "squash", "rebase"],
    "dismiss_stale_reviews_on_push": true,
    "require_code_owner_review": true,
    "require_last_push_approval": false,
    "required_approving_review_count": 1,
    "required_review_thread_resolution": true
  }
}
```

Supported merge methods are `merge`, `squash` and `rebase`.

### Required status checks

```json
{
  "type": "required_status_checks",
  "parameters": {
    "required_status_checks": [
      {"context": "actionlint"},
      {"context": "zizmor"}
    ],
    "strict_required_status_checks_policy": true,
    "do_not_enforce_on_create": false
  }
}
```

Use exact GitHub check context names. A typo can create an impossible required
check, so validate the check name against an actual successful workflow run
before applying policy.

## Complete example

```json
{
  "policies": {
    "protected-branches": {
      "name": "Protect default and stable branches",
      "target": "branch",
      "enforcement": "active",
      "bypass_actors": [
        {
          "actor_id": 0,
          "actor_type": "OrganizationAdmin",
          "bypass_mode": "pull_request"
        }
      ],
      "conditions": {
        "ref_name": {
          "include": [
            "~DEFAULT_BRANCH",
            "refs/heads/stable*"
          ],
          "exclude": []
        }
      },
      "rules": [
        {"type": "deletion"},
        {"type": "non_fast_forward"},
        {
          "type": "pull_request",
          "parameters": {
            "allowed_merge_methods": ["merge", "squash", "rebase"],
            "dismiss_stale_reviews_on_push": true,
            "require_code_owner_review": true,
            "require_last_push_approval": false,
            "required_approving_review_count": 1,
            "required_review_thread_resolution": true
          }
        }
      ]
    },
    "required-ci": {
      "name": "Require CI",
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
        {
          "type": "required_status_checks",
          "parameters": {
            "required_status_checks": [
              {"context": "actionlint"},
              {"context": "zizmor"}
            ],
            "strict_required_status_checks_policy": true,
            "do_not_enforce_on_create": false
          }
        }
      ]
    }
  },
  "defaults": {
    "policies": ["protected-branches"]
  },
  "conditions": [
    {
      "when": {
        "file_exists": "path/to/framework-marker"
      },
      "add_bypass_actors": {
        "protected-branches": [
          {
            "actor_id": 1234,
            "actor_type": "Integration",
            "bypass_mode": "always"
          }
        ]
      }
    }
  ],
  "repositories": {
    "critical-repository": {
      "policies": [
        "protected-branches",
        "required-ci"
      ]
    }
  }
}
```

## Failure behavior

The engine fails closed when:

- a selected named policy does not exist;
- a condition tries to modify a policy that is not selected;
- a content probe fails;
- GitHub returns an unsupported managed rule shape.

Configuration schema validation at file-load time is a planned hardening item;
until then, review caller configuration carefully and validate it through
dry-run before apply.

## Caller workflow prerequisites

A caller workflow needs a GitHub App installed in the organization it manages.

Keep:

- GitHub App client ID in `RULESET_APP_CLIENT_ID`;
- GitHub App private key in `RULESET_APP_PRIVATE_KEY`;
- both values in, or available to, the protected environment used by the
  governance workflow.

The client ID is configuration, not a secret. The private key is sensitive and
must not be stored in the repository.

`administration: write` is required even for dry-run when the caller needs an
accurate repository ruleset representation: GitHub omits `bypass_actors` from
ruleset responses without write access. Dry-run safety therefore comes from the
engine's explicit `apply=false` behavior rather than from reducing the token to
administration read-only access.

The current managed scope is public, non-archived repositories. Public content
probes used by `file_exists` have been validated without requesting a separate
`contents: read` permission from the GitHub App installation. If private or
internal repository management is added later, review the permission model
explicitly.

See also:

- [Adoption guide](adoption.md)
- [Security model](security.md)
- [LibreSign reference caller](https://github.com/LibreSign/.github)
- [LibreCode Coop reference caller](https://github.com/LibreCodeCoop/.github)
