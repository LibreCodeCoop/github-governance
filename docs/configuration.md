<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Configuration

The caller owns the complete desired policy. The engine does not ship a default
branch-protection policy or product-specific exception.

## Top-level keys

- `policies`: reusable named repository rulesets.
- `defaults`: policies or inline rulesets applied to every managed public,
  non-archived repository.
- `conditions`: generic conditional additions evaluated per repository.
- `repositories`: additions or overrides selected by repository name.

## Conditional policy

The first generic matcher is `file_exists`.

A condition can add policies, inline rulesets, or bypass actors. Bypass actors
are keyed by policy name so the engine can modify the selected ruleset without
knowing why the exception exists.

Example:

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
  },
  "conditions": [
    {
      "when": {
        "file_exists": "path/to/marker"
      },
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

A caller can therefore express framework- or product-specific behavior without
adding that framework or product to the engine.

## Safety

Missing named policies fail closed. Failed content probes also fail closed; an
API error is not treated as a negative match.

Private and archived repositories resolve to no managed rulesets.

## Caller workflow prerequisites

A caller workflow using the composite action needs a GitHub App installed in
the organization it manages.

The caller should keep:

- the GitHub App client ID in `RULESET_APP_CLIENT_ID`;
- the GitHub App private key in the `RULESET_APP_PRIVATE_KEY` secret;
- both values inside, or available to, the protected environment used by the
  reconciliation job.

The client ID is configuration, not a secret. The private key must remain a
secret and must not be stored in this repository.

`administration: write` is required even for dry-run when the caller needs an
accurate repository ruleset representation: GitHub omits `bypass_actors` from
ruleset responses without write access. Dry-run safety therefore comes from the
engine's explicit `apply=false` behavior rather than from reducing the token to
administration read-only access.

Callers that use `file_exists` conditions must also request `contents: read`.
