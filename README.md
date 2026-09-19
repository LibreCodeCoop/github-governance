# GitHub Governance

Shared, testable GitHub governance tooling for LibreCodeCoop and LibreSign.

The project keeps reusable implementation and shared policies in one repository.
Organization repositories keep only organization-specific configuration and
credentials.

## Scope

The first supported capability is repository ruleset reconciliation for public,
non-archived repositories.

The current policy reproduces the governance behavior already used by LibreSign:

- protect the default branch and `stable*` branches;
- prevent deletion and non-fast-forward updates;
- require pull requests, approval, CODEOWNERS, and resolved review threads;
- automatically allow `nextcloud-bot` to bypass the base policy for
  repositories containing `appinfo/info.xml`;
- fail closed when Nextcloud-app detection fails unexpectedly;
- support repository-specific additional rulesets.

## Safe Settings

Safe Settings was evaluated before implementing reconciliation here.

Its current code contains a ruleset plugin capable of calling repository
ruleset REST endpoints, but the supported configuration flow treats rulesets as
organization-level settings and removes them before applying repository/suborg
configuration.

That does not cover our GitHub Free use case, where public repositories support
repository rulesets but organization-wide rulesets require a paid plan.

See [Safe Settings compatibility](docs/safe-settings.md) for the detailed
finding.

Safe Settings can still be integrated later for repository settings it supports
well; this project does not reimplement those capabilities unnecessarily.

## Development

Install dependencies and run all checks:

```bash
npm install
npm run check
```

The governance CLI is dry-run by default:

```bash
GITHUB_TOKEN=... node dist/cli.js --org LibreSign
```

Mutation requires an explicit `--apply`.

The CLI is not enabled against production organizations until its dry-run output
has been compared with the existing LibreSign ruleset synchronizer.
