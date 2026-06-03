# Deployment

This public repository does not define a private production host, domain, server path, systemd unit, or managed database endpoint.

Use this document as a generic deployment checklist for self-hosting Acre. Keep real deployment details in your own infrastructure configuration, secret manager, or private runbook.

## Deployment Model

Acre is a Next.js application with a PostgreSQL database and Prisma migrations. A typical deployment needs:

- a Node.js runtime
- a PostgreSQL database
- environment variables from a secret manager or private environment file
- persistent document storage if document workflows are enabled
- optional external services for email, observability, Google integrations, QuickBooks, and rate limiting

## Required Build Steps

From a clean checkout:

```bash
npm ci
npm run db:generate
npm run build
```

Before starting the deployed app, apply database migrations against the target database:

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Then start the web application with your platform's process manager:

```bash
npm run start --workspace=@acre/web
```

## Environment

Start from [.env.example](../.env.example) and provide deployment-specific values through your hosting provider or secret manager.

At minimum, production-like deployments usually need:

- `DATABASE_URL`
- `ACRE_SESSION_SECRET`
- `ACRE_SETTINGS_ENCRYPTION_SECRET`
- `ACRE_BASE_URL`
- `ACRE_SECURE_COOKIES=true`
- `ACRE_DOCUMENTS_STORAGE_DIR` or another storage integration

Optional integrations include:

- email and signature delivery
- Google OAuth
- QuickBooks OAuth
- Sentry
- Redis or Upstash rate limiting
- Listing Studio extension store URL

## Operational Checklist

1. Build from a clean checkout.
2. Generate the Prisma client.
3. Apply migrations.
4. Start or restart the app through your process manager.
5. Validate the login page, health endpoint, and one representative office workflow.
6. Check logs for build, migration, auth, database, and storage errors.
7. Keep deployment secrets outside Git.

## What Not to Commit

Do not commit:

- production database URLs
- private domains or public IP addresses
- SSH targets or keys
- server filesystem paths
- process manager service names tied to private infrastructure
- environment files containing real values
- provider tokens or API keys

## Helper Scripts

Some scripts in `scripts/` are designed as configurable examples. They should be run only after setting explicit environment variables for your own infrastructure. Public defaults intentionally avoid private hostnames and server paths.

Review each script before using it in a real deployment.
