# Roadmap

Acre is an early open-source release. This roadmap describes current project direction without promising dates, adoption, production usage, or commercial support.

## Near Term

- Improve public documentation and contributor onboarding.
- Keep `.env.example` and `docs/env.md` aligned with safe local development.
- Expand tests around permissions, auth/session behavior, transaction workflows, and Listing Studio APIs.
- Clarify Chrome extension setup and packaging docs.
- Continue replacing transitional helper paths with Prisma-backed services where the application already has stable workflow contracts.

## Core Product Direction

- Listing workflows: improve saved listing review, packet editing, sharing, asset handling, and extension handoff documentation.
- Transaction operations: strengthen transaction detail, finance, checklist/task, document, forms, signature, and offer workflows.
- Office console: refine dashboard, pipeline, contacts, reports, activity, library, accounting, HR, admin office, and settings surfaces.
- CRM and agent support: improve follow-up workflows, front-office handoff, contact context, and operational notifications.
- Permissions: keep role, company/office scope, and workflow access behavior explicit and testable.

## Developer Experience

- Keep setup reproducible with npm workspaces and Docker.
- Improve test speed and documentation around focused validation.
- Add examples for safe local-only integrations.
- Make the shared UI primitives easier to discover and extend.

## Not in Scope Right Now

- Claims of broad adoption or production readiness.
- A public brokerage marketing website.
- A hosted SaaS offering from this repository.
- Rewriting the application architecture without a specific, reviewed need.
- Replacing working modules solely for cosmetic reasons.

## How to Suggest Roadmap Changes

Open a feature request issue with:

- the user or contributor persona
- the workflow pain
- the proposed outcome
- risks, constraints, or compatibility notes
