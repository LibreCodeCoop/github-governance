<!--
SPDX-FileCopyrightText: 2026 LibreCode coop and contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Releases

Releases provide stable, human-readable versions for consumers while callers
continue pinning the reusable actions to immutable commit SHAs.

## Publishing

1. Update the version in `package.json` through a reviewed pull request.
2. Merge only after TypeScript, Vitest, REUSE, actionlint and zizmor pass.
3. Run the `Release` workflow from `main` with the matching `vMAJOR.MINOR.PATCH`
   value.
4. The workflow runs the project checks again and creates the Git tag and GitHub
   Release from the exact `main` commit that was validated.

The workflow refuses to release from another branch, rejects malformed versions,
rejects versions that do not match `package.json`, and refuses to overwrite an
existing tag.

## Consuming the actions

Consumers should pin the full immutable commit SHA and keep the corresponding
release version as a comment:

```yaml
uses: LibreCodeCoop/github-governance@<full-commit-sha> # v0.1.0
uses: LibreCodeCoop/github-governance/discover@<full-commit-sha> # v0.1.0
```

The version comment is informational; execution remains pinned to the immutable
SHA.


## Environment protection

Create a `release` environment in GitHub and restrict it to the `main` branch.
Where supported, require reviewer approval for release jobs.

The workflow also rejects execution outside `main`; the environment restriction
is an independent defense-in-depth control.

## Post-release

After publishing a reusable-action release:

1. record the release commit SHA;
2. update every production caller to that exact SHA;
3. add the real release version as the adjacent comment;
4. run caller CI and an organization-wide dry-run;
5. merge only after the new pin is validated.

For `v0.1.0`, update both production callers:

```yaml
uses: LibreCodeCoop/github-governance/discover@<v0.1.0-commit-sha> # v0.1.0
uses: LibreCodeCoop/github-governance@<v0.1.0-commit-sha> # v0.1.0
```

Reference callers:

- `LibreSign/.github`
- `LibreCodeCoop/.github`

Do not close the release tracking issue until the release is published and all
production callers are pinned to the released commit.
