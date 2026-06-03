# Codex Next Phase

This file is a public-safe backlog prompt for future repository hardening work. It intentionally avoids private infrastructure details, historical secret values, and deployment-only instructions.

## Priority 0: Open-Source Readiness

- Keep README, CONTRIBUTING, SECURITY, ROADMAP, CHANGELOG, and issue templates current.
- Keep `.env.example` limited to safe placeholders.
- Continue scanning docs and scripts for private paths, private domains, public IP addresses, service names tied to private infrastructure, and secret-like examples.
- Make onboarding easier for first-time contributors.

## Priority 1: Security and Configuration Hygiene

- Keep secret scanning in CI.
- Expand documentation for safe local configuration.
- Ensure scripts that touch deployment, sync, or rotation require explicit operator-provided environment variables.
- Keep rotation runbooks generic and free of real hostnames, credentials, and production paths.
- Add or improve tests around auth, permissions, CSRF, rate limiting, and route guards.

## Priority 2: Workflow Test Coverage

Focus coverage on behavior that protects brokerage operations data:

- transaction create/detail/update flows
- contact linking and scope behavior
- listing import and share flows
- document and signature access boundaries
- offer workflow status transitions
- accounting and commission calculations
- HR and admin-office permission boundaries

## Priority 3: Developer Experience

- Improve local database setup troubleshooting.
- Document focused validation commands for common contribution types.
- Clarify extension development flow.
- Make shared UI primitives easier to discover.
- Keep architecture docs aligned with the current monorepo structure.

## Guardrails

- Do not commit secrets or private deployment details.
- Do not claim production readiness, customers, funding, adoption, or community size without evidence.
- Do not rewrite architecture or database schema unless the task explicitly requires it.
- Do not remove working code for cosmetic cleanup.
- Keep changes reviewable and scoped.
