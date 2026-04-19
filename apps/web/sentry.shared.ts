function parseTracesSampleRate() {
  const parsed = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");

  if (!Number.isFinite(parsed)) {
    return 0.1;
  }

  return parsed;
}

export function getSentryInitOptions() {
  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn) {
    return null;
  }

  return {
    dsn,
    tracesSampleRate: parseTracesSampleRate(),
    environment: process.env.NODE_ENV,
  };
}
