# Phase 0: Observability instrumentation

## Summary

Installs the observability baseline required before any scalability work. This change does **not** modify business logic, database schema, rate limits, auth, or deployment topology — every addition is either wrapped or gated behind an environment variable so the current production behavior is preserved when the new variables are unset.

Three things become visible after this lands:
1. **Slow queries** — Prisma now emits structured JSON to stderr when any query crosses configurable thresholds (default 500ms / 2000ms), and routes Prisma-level errors to Sentry when a DSN is configured.
2. **Resource pressure** — `/api/health` now exposes DB ping latency, Postgres connection-pool usage, and Node RSS/heap/uptime alongside the existing `status` field. A new `/api/metrics` endpoint exposes Prometheus-formatted process gauges (RSS, heap, external, uptime, event-loop lag) behind a token-auth header.
3. **Application errors** — Sentry is wired into `withApiGuard`, the Prisma `$on("error")` handler, and the global error boundary. If `SENTRY_DSN` is empty, Sentry stays silent and the build still passes without `SENTRY_AUTH_TOKEN`.

## Scope of changes

- `packages/db/src/client.ts` — add `log: [{ emit: "event", level }]` config, register typed `$on("query" | "error")` listeners, emit structured JSON above configurable thresholds, redact `params` when `NODE_ENV=production`, route `$on("error")` through Sentry when DSN is present.
- `packages/db/src/health.ts` — new `getHealthSnapshot()` export returning `{ status, db: { ping_ms, pool_in_use, pool_idle, pool_max }, process: { rss_bytes, heap_used_bytes, heap_total_bytes, uptime_seconds }, timestamp }`. Pool stats come from `pg_stat_activity` filtered to `current_database()`. On failure the pool fields degrade to `null` and status drops to `"degraded"`, not `"error"`.
- `apps/web/app/api/health/route.ts` — merges snapshot fields into the existing payload. **Preserves the existing `status` field's `"ok" | "degraded"` semantics** (internal `"error"` maps to `"degraded"` for legacy consumers) and adds a new `health_status` field that exposes the finer-grained state.
- `apps/web/app/api/metrics/route.ts` — new Prometheus-format endpoint behind `X-Metrics-Token: $ACRE_METRICS_TOKEN`. 401 when token is unset or mismatched. Uses a module-level `perf_hooks.monitorEventLoopDelay` histogram, resetting on each scrape.
- `apps/web/sentry.server.config.ts`, `apps/web/sentry.edge.config.ts`, `apps/web/instrumentation-client.ts`, `apps/web/instrumentation.ts`, `apps/web/sentry.shared.ts` — follows Next.js 16's current convention (`instrumentation-client.ts` replaces the deprecated `sentry.client.config.ts`). Factored a shared `getSentryInitOptions()` that returns `null` when `SENTRY_DSN` is empty.
- `apps/web/next.config.ts` — wraps with `withSentryConfig({ silent: true, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } })` so the build never fails when `SENTRY_AUTH_TOKEN` is absent.
- `apps/web/lib/with-api-guard.ts` — adds a catch wrapper that lazy-imports `@sentry/nextjs` only when `SENTRY_DSN` is set, captures the exception, and rethrows so existing error semantics are preserved.
- `apps/web/app/global-error.tsx` — new client-side error boundary forwarding to `Sentry.captureException`.
- `.env.example` — new placeholders: `ACRE_METRICS_TOKEN`, `PRISMA_SLOW_QUERY_MS=500`, `PRISMA_VERY_SLOW_QUERY_MS=2000`, `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE=0.1`, `SENTRY_AUTH_TOKEN`.
- `docs/OBSERVABILITY.md` — operator-facing doc: where slow-query logs land, how to grep them from journald, semantics of each new health field, how to curl `/api/metrics`, where Sentry DSN lives.
- `packages/db/src/health.test.ts` — new unit coverage for `getHealthSnapshot` including pool-query failure path and ping timing.

## Behavior changes operators should know

1. **`/api/health` HTTP status code changed.** Previously always returned 200. Now returns **503** when `status !== "ok"` (degraded pool stats, ping > 1000ms, or error). Uptime monitors and load-balancer health checks that expected 200 for "degraded" will now mark the node unhealthy in that window. If this is undesired, flip the route's `snapshot.status === "ok" ? 200 : 503` to always 200.
2. **New required env var for `/api/metrics`.** `ACRE_METRICS_TOKEN` must be set in `<deployment-env-file>` for the metrics endpoint to return data. Unset → all requests 401.
3. **Slow query logs appear in journald.** Any query > 500ms produces a `[WARN]` JSON line with `kind: "slow_query"`. Above 2000ms it's `[ERROR] kind: "very_slow_query"`. Adjust thresholds via env if the defaults are too noisy.

## Explicitly out of scope (deferred to Phase 1)

- No changes to the Prisma `connection_limit`, `pool_timeout`, or `statement_timeout`
- No session caching or request-level memoization
- No transaction refactoring
- No Prisma schema changes
- No deployment or systemd unit changes

## Test plan

- [ ] CI `verify` job passes (typecheck + lint + build)
- [ ] CI `hardening-tests` passes (node --test suite, including updated `packages/db/src/health.test.ts`)
- [ ] Confirm `/api/health` on staging returns 200 with new fields populated when DB is healthy
- [ ] Confirm `/api/health` returns 503 when DB is stopped locally (or `pg_stat_activity` query is simulated to fail)
- [ ] Confirm `/api/metrics` returns 401 without `X-Metrics-Token`
- [ ] Confirm `/api/metrics` returns Prometheus text with all 6 gauges when token matches
- [ ] Confirm `pnpm build` (or `npm run build`) passes locally with `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` both unset
- [ ] After deploy: tail `journalctl -u <app-service-name> | grep slow_query` for a few minutes, capture a baseline of which endpoints emit the most
- [ ] After `SENTRY_DSN` is configured: manually trigger `throw new Error("sentry-probe")` in a dev route and confirm it lands in Sentry

## Follow-ups (Phase 1 candidates, not in this PR)

- Tune Prisma `connection_limit` using the real pool metrics this PR exposes
- Memoize session membership per request to cut 3–4 DB queries per hot-path request
- Split long transactions in `packages/db/src/agent-billing.ts`
- Add `take` limits to the 614 unbounded `findMany` call sites flagged in `docs/SCALE_AUDIT_2026_04_19.md`
