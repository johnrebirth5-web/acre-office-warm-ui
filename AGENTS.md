# Acre Repository Guide

This guide is for AI coding agents and human contributors working in the Acre repository.

## Project Identity

Acre is an open-source real estate brokerage operations workspace and listing workflow toolkit. Treat it as a reusable starter kit for brokerage workflow software, not as a private internal deployment.

Primary product areas:

- Office Console / Back Office
- Front Office / agent support workflows
- Listing Studio
- Chrome extension support for listing capture
- transactions, contacts, tasks, documents, forms, signatures, offers, reports, accounting, HR, admin office, and settings

## Start Here

Before substantial work, read:

- [README.md](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/env.md](docs/env.md)
- [docs/deployment.md](docs/deployment.md)
- relevant files under [docs/specs](docs/specs)

For Front Office work, also read:

- [docs/specs/frontoffice-overview.md](docs/specs/frontoffice-overview.md)

For Back Office work, also read:

- [docs/specs/backoffice-overview.md](docs/specs/backoffice-overview.md)

## Repository Structure

- `apps/web`: Next.js App Router application
- `apps/extension`: Manifest V3 Chrome extension
- `packages/auth`: roles, permissions, and access helpers
- `packages/db`: Prisma schema, seed, migrations, and services
- `packages/ui`: shared office UI primitives
- `packages/backoffice`: transitional domain/view-model helpers
- `docs`: architecture, environment, product, and operations documentation
- `scripts`: development and maintenance helpers

## Local Development

```bash
npm install
cp .env.example .env.local
npm run docker:dev:up
npm run dev
```

The default local app URL is `http://localhost:3105`.

## Engineering Rules

- Reuse existing modules and helpers before adding new abstractions.
- Reuse `@acre/ui` shared primitives for Office UI work.
- Reuse `@acre/db` services before adding page-local data access.
- Keep organization, office/company, role, and permission scoping explicit.
- Keep activity/audit behavior integrated with the existing activity model.
- Prefer incremental changes over broad rewrites.
- Avoid unrelated refactors.
- Do not change database schema unless the task explicitly requires it.
- Do not remove working code to make documentation look cleaner.
- Do not fake external integrations, production status, adoption, or customer usage.

## Documentation Rules

Update docs when changing:

- public setup steps
- scripts
- environment variables
- permissions
- routes or APIs
- database schema
- workflow behavior
- Chrome extension behavior
- deployment expectations

Keep public documentation free of:

- real credentials
- tokens
- API keys
- private domains
- public IP addresses tied to private infrastructure
- private server paths
- local machine paths
- private environment file paths
- private process manager service names

## Validation

Run the relevant checks from the repository root:

```bash
npm run typecheck
npm run lint
npm run build
```

If Prisma schema or database services changed, also consider:

```bash
npm run db:validate
npm run db:generate
npm run db:seed
```

If the Chrome extension changed:

```bash
npm run lint --workspace=@acre/extension
npm run build --workspace=@acre/extension
```

## Deployment

Do not assume any private production host, domain, SSH target, environment file path, or process manager service name. Public deployment guidance lives in [docs/deployment.md](docs/deployment.md).

Deployment should be explicitly requested, configured through environment variables, and reviewed against the target operator's own private runbook.

## Security

- Do not commit `.env`, `.env.local`, credentials, tokens, private keys, real provider secrets, production database URLs, or private deployment notes.
- Use `.env.example` for safe placeholders only.
- Run `npm run scan:secrets` when touching docs, scripts, configuration, auth, or integration code.
- Follow [SECURITY.md](SECURITY.md) for vulnerability reporting expectations.
