# Acre

An open-source real estate brokerage operations workspace and listing workflow toolkit.

Acre is a Next.js monorepo for building brokerage office consoles, listing workflows, transaction pipelines, CRM-style operations tools, and agent support surfaces. It is intended to be a practical starter kit for teams that want to build vertical SaaS tools for real estate operations without starting from a blank application shell.

## Open Source Positioning

Acre is published as an open-source foundation for brokerage operations software. It keeps the project identity and real estate workflow focus, but the public repository should be treated as a reusable toolkit rather than a private company deployment.

The codebase is useful for:

- small real estate brokerages that need a customizable operations workspace
- operations teams coordinating listings, transactions, documents, and office workflows
- listing coordinators who want structured listing intake and sharing flows
- agent support teams building internal tools for pipeline, CRM, and admin work
- developers building vertical SaaS products for real estate operations

## Features

- Office console for brokerage operations, including dashboard, pipeline, transactions, contacts, tasks, reports, notifications, settings, billing, accounting, HR, admin office, activity, and library surfaces.
- Listing Studio workflows for saving, organizing, editing, sharing, and exporting listing packets.
- Chrome extension workspace in `apps/extension` for saving supported external listing pages into Listing Studio.
- Transaction workflow foundations, including transaction detail, contacts, finance, tasks/checklists, documents, forms, signatures, offers, and commission-related surfaces.
- CRM and agent-support surfaces for contacts, client follow-up, resources, notifications, and front-office handoff flows.
- Role and permission foundations in `packages/auth`.
- Prisma-backed data layer and services in `packages/db`.
- Shared office UI primitives in `packages/ui`.
- Local Docker development environment for the web app and PostgreSQL.

The repository is not a public brokerage website template. It focuses on internal operations, listing workflows, and office tooling.

## Why This Project Matters

Many small brokerages still run core operations through spreadsheets, email threads, shared folders, and disconnected point tools. That works for a while, but it becomes hard to track transaction status, listing material, agent support requests, document workflows, and office accountability in one place.

Acre provides a reusable foundation for listing workflows, transaction pipelines, and office operations. It gives developers a concrete starting point for building real estate operations software with a real application structure, a database layer, permissions, module boundaries, and workflow-oriented screens.

For developers building vertical SaaS in real estate, this repo can help shorten the path from prototype to a specialized brokerage operations product.

## Architecture Overview

This repository uses npm workspaces and Turborepo.

```text
apps/
  extension/     Chrome extension for Listing Studio capture flows
  web/           Next.js App Router application

packages/
  auth/          Roles, permissions, and access helpers
  backoffice/    Domain/view-model helpers that still support some transitional flows
  db/            Prisma schema, seed data, migrations, and database services
  ui/            Shared office UI primitives

docs/            Architecture, environment, operational, and product notes
scripts/         Development, validation, deployment, and maintenance helpers
```

Core technologies:

- Next.js 16
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Turborepo
- npm workspaces
- Manifest V3 Chrome extension

See [docs/architecture.md](docs/architecture.md) for deeper implementation notes.

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker, if you want the included local PostgreSQL development setup

### Local Setup

```bash
git clone https://github.com/johnrebirth5-web/acre-office-warm-ui.git
cd acre-office-warm-ui
npm install
cp .env.example .env.local
```

Edit `.env.local` with local-only values. The default example is safe for local development and does not include production secrets.

Start local services:

```bash
npm run docker:dev:up
npm run dev
```

The web app runs on:

```text
http://localhost:3105
```

If you only want to run the Next.js app against an already available database, configure `DATABASE_URL` in `.env.local` and run:

```bash
npm run dev
```

### Database Commands

```bash
npm run db:generate
npm run db:validate
npm run db:migrate -- --name your_migration_name
npm run db:seed
```

Only run migration or seed commands when you intentionally need database changes or seed data.

### Chrome Extension

```bash
npm run build --workspace=@acre/extension
npm run package --workspace=@acre/extension
```

The extension source lives in `apps/extension`.

## Environment Variables

Start from [.env.example](.env.example). Keep real secrets in `.env.local` or your deployment environment, never in Git.

Common local variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `ACRE_SESSION_SECRET` | Local session signing secret |
| `ACRE_BASE_URL` | Public base URL used for generated absolute links |
| `ACRE_DOCUMENTS_STORAGE_DIR` | Local document storage path |
| `ACRE_SETTINGS_ENCRYPTION_SECRET` | Secret used to encrypt integration settings |
| `ACRE_RATE_LIMIT_BACKEND` | `memory`, `redis`, or `upstash` |
| `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL` | Optional public Chrome Web Store URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional public browser key for map features |

See [docs/env.md](docs/env.md) for the longer environment reference.

## Development Scripts

Root scripts from `package.json` include:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run docker:dev:up
npm run docker:dev:down
npm run docker:dev:logs
npm run scan:secrets
```

The project also includes focused workspace scripts, such as:

```bash
npm run build --workspace=@acre/web
npm run build --workspace=@acre/extension
npm run typecheck --workspace=@acre/db
```

## Project Status

Acre is in active development and is an early open-source release.

The current repository contains substantial brokerage workflow foundations, but APIs, data contracts, UI details, and internal module boundaries may change as the project matures. Treat it as a starter kit and development foundation, not a drop-in hosted product.

## Roadmap

The public roadmap is maintained in [ROADMAP.md](ROADMAP.md).

Current themes:

- improve open-source onboarding and local setup
- stabilize core transaction, listing, and office workflow contracts
- continue replacing transitional/mock paths with Prisma-backed services
- improve test coverage around permissions and workflow-critical APIs
- document extension setup, integration boundaries, and deployment options
- make the UI system easier for contributors to extend safely

## Good First Issues

Suggested starter contributions are listed in [docs/good-first-issues.md](docs/good-first-issues.md).

Good first contribution areas include:

- improving public documentation
- adding small UI consistency fixes using existing `@acre/ui` primitives
- expanding route or service tests
- improving environment variable docs
- clarifying Chrome extension setup instructions

## Contributing

Contributions are welcome through issues and pull requests.

Before opening a PR:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md).
2. Keep changes focused.
3. Avoid unrelated architecture rewrites.
4. Do not commit credentials, local environment files, private server paths, or deployment-only secrets.
5. Run the relevant validation commands.

## Security

Please do not report vulnerabilities through public issues with exploit details. See [SECURITY.md](SECURITY.md) for the disclosure process and supported expectations.

## Maintainer

Primary maintainer: `johnrebirth5-web`

Issues and pull requests are welcome. Please include enough context for maintainers and contributors to reproduce bugs, understand proposed changes, and review the impact.

## License

MIT. See [LICENSE](LICENSE).
