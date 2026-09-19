# Safe Settings compatibility

GitHub Safe Settings remains useful for repository and organization settings, but
its current configuration model does not satisfy this project's repository
ruleset requirement.

LibreCodeCoop and LibreSign use GitHub Free for organizations and therefore need
repository-level rulesets for public repositories. Organization-wide rulesets
require GitHub Team or Enterprise.

Safe Settings contains an internal rulesets plugin capable of calling both
organization and repository ruleset REST endpoints. However, its current
configuration flow treats rulesets as organization-level settings:

- the published settings schema describes `rulesets` as org-level only;
- repo/suborg schemas do not expose `rulesets`;
- `Settings.returnRepoSpecificConfigs()` explicitly removes `rulesets`
  before repository-level configuration is applied.

Therefore this project does not use Safe Settings as the repository-ruleset
reconciliation engine.

The project can still integrate Safe Settings later for settings it supports
well, while keeping repository ruleset reconciliation in this shared,
well-tested implementation.


## Upstream opportunity

The limitation appears to be in Safe Settings' configuration plumbing rather
than in its REST implementation. Its rulesets plugin already supports
repository-scoped GET/POST/PUT/DELETE operations and has unit tests for
repository rulesets.

A future upstream contribution can evaluate exposing `rulesets` in repo/suborg
schemas and removing the current filtering from repository-specific config.
Until that behavior is available and released upstream, this project keeps the
repository-ruleset reconciler small and independently tested.
