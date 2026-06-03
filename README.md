# Acre

An open-source real estate brokerage operations workspace and listing workflow toolkit.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black.svg)](https://nextjs.org/)
[![Project Status](https://img.shields.io/badge/status-early%20open--source%20release-informational.svg)](#project-status)

Acre is a public foundation for building real estate brokerage operations software. It combines a Next.js office console, listing workflow tools, transaction pipeline surfaces, CRM-style operations modules, role-aware permissions, Prisma-backed data services, shared UI primitives, and a Chrome extension workspace for listing capture flows.

The project is designed for builders who need more than a generic admin template: it gives developers and brokerage operations teams a realistic starting point for vertical workflow software in real estate.

## Why Acre Exists

Many small and midsize brokerages still coordinate critical work through spreadsheets, inboxes, shared folders, generic CRMs, and disconnected point tools. Those tools can work for individual tasks, but they make it difficult to maintain a reliable operational picture across listings, transactions, agent support, documents, commissions, office activity, and client-facing materials.

Acre exists to make that problem space easier to build in public.

Instead of starting from a blank app shell, contributors can work from a concrete codebase with:

- brokerage-specific workflow surfaces
- listing and transaction domain boundaries
- office-console navigation and module structure
- role and permission foundations
- a database-backed service layer
- a reusable design system package
- extension-to-app listing capture flows
- public documentation for setup, security, and contribution

The goal is not to claim that Acre is already a widely adopted platform. The goal is to provide a serious open-source baseline for an underserved operational domain.

## Open Source Positioning

Acre is an open-source starter kit and toolkit for real estate operations software. It is not a private deployment note, a hosted SaaS promise, or a public brokerage marketing website.

The repository is useful for:

- small brokerages that want a customizable internal operations workspace
- operations teams coordinating listings, transactions, documents, tasks, and office workflows
- listing coordinators building structured listing intake, review, sharing, and export processes
- agent support teams building CRM-style follow-up, resource, notification, and admin workflows
- developers building vertical SaaS tools for real estate brokerage operations
- maintainers who want a realistic, domain-specific codebase for testing workflow, permission, and contributor automation patterns

## What Acre Provides

### Office Console

Operational surfaces for brokerage teams, including dashboard, pipeline, transactions, contacts, tasks, reports, notifications, settings, billing, accounting, HR, admin office, activity, library, and resource workflows.

### Listing Studio

Listing workflow foundations for saving, organizing, editing, sharing, exporting, and reviewing listing materials. These flows are intended to support listing coordinators, agents, and operations teams who need reusable packet and collection workflows.

### Transaction Operations

Transaction workflow foundations covering transaction detail pages, contacts, finance, tasks and checklists, documents, forms, signatures, offers, and commission-related surfaces.

### CRM and Agent Support

CRM-style surfaces for contacts, client follow-up, agent resources, front-office handoff, operational notifications, and office support workflows.

### Chrome Extension Workspace

A Manifest V3 Chrome extension workspace in `apps/extension` for capturing supported external listing pages and sending listing context into Acre workflows.

### Shared Platform Foundations

- `packages/auth` for roles, permissions, and access helpers
- `packages/db` for Prisma schema, migrations, seed data, and service-layer helpers
- `packages/ui` for shared office UI primitives
- npm workspaces and Turborepo for monorepo development
- local Docker setup for PostgreSQL-backed development

## Project Principles

- **Domain first:** Acre models real brokerage operations workflows rather than generic dashboard examples.
- **Public by default:** Documentation should be safe for open-source readers and should avoid private hosts, credentials, deployment paths, or company-only operating notes.
- **Composable foundations:** Modules should be useful as references even when adopters replace individual workflows.
- **Contributor-friendly maintenance:** Issues, docs, tests, and small workflow improvements should be approachable without understanding the entire monorepo.
- **Honest maturity:** Acre is active and early. APIs, module boundaries, UI details, and data contracts may change.

## What This Is Not

Acre is not:

- a hosted production SaaS offering
- a public real estate marketing website template
- a claim of broad adoption, download volume, or production scale
- a turnkey compliance solution for brokerage operations
- a place for private deployment notes, production secrets, or customer data

## Architecture Overview

This repository uses npm workspaces and Turborepo.

```text
apps/
  extension/     Chrome extension for Listing Studio capture flows
  web/           Next.js App Router application

packages/
  auth/          Roles, permissions, and access helpers
  backoffice/    Domain/view-model helpers that support transitional flows
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

Edit `.env.local` with local-only values. The example file is intentionally safe for public development and does not include production credentials.

Start local services:

```bash
npm run docker:dev:up
npm run dev
```

The web app runs on:

```text
http://localhost:3105
```

If you already have PostgreSQL available, configure `DATABASE_URL` in `.env.local` and run:

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

## Development Workflow

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

Focused workspace scripts include:

```bash
npm run build --workspace=@acre/web
npm run build --workspace=@acre/extension
npm run typecheck --workspace=@acre/db
```

Before opening a pull request, run the smallest validation set that matches the change. For shared code, auth, database, or workflow-critical changes, prefer broader validation.

## Project Status

Acre is in active development and is an early open-source release.

The repository contains substantial brokerage workflow foundations, but it should be treated as a development foundation rather than a drop-in hosted product. APIs, internal modules, UI details, seed data, and data contracts may change while the public surface matures.

Current priorities:

- improve public onboarding and contributor documentation
- stabilize core listing, transaction, and office workflow contracts
- expand focused tests around permissions and workflow-critical APIs
- continue replacing transitional paths with Prisma-backed services
- clarify extension setup, integration boundaries, and safe deployment options

## Maintainer Workflow

Primary maintainer: `johnrebirth5-web`

The maintainer is responsible for keeping the public repository safe, reviewable, and useful for contributors. That includes issue triage, pull request review, release hygiene, security-sensitive documentation review, and continued cleanup of workflow modules as the project matures.

Codex and other maintainer automation can help with:

- turning vague workflow reports into reproducible issues
- reviewing documentation, tests, permissions, and route-level changes
- generating focused regression tests for listing, transaction, CRM, and office-console behavior
- checking public docs for secret-like values, private paths, or deployment-only details
- reducing maintenance load while preserving human review for product and security decisions

## Roadmap

The public roadmap is maintained in [ROADMAP.md](ROADMAP.md).

Roadmap themes include:

- contributor onboarding and local setup
- Listing Studio workflow stability
- transaction and office operations contracts
- permission and access-control test coverage
- Chrome extension setup and capture-flow documentation
- shared UI primitives that are easier to extend safely

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

## License

MIT. See [LICENSE](LICENSE).
