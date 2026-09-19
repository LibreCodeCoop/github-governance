# GitHub Governance

Shared, testable GitHub governance tooling for LibreCodeCoop and LibreSign.

The project will provide a thin policy/composition layer around upstream GitHub
governance tooling such as Safe Settings. Organization repositories keep only
their organization-specific configuration; reusable implementation and shared
policies live here.

Development starts by reproducing the current LibreSign ruleset behavior with
automated tests before any production synchronization is migrated.
