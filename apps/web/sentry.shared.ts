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
    sendDefaultPii: false,
    beforeSend(event: any) {
      if (event?.request) {
        event.request.cookies = undefined;
        event.request.data = undefined;

        const headers = event.request.headers as
          | Record<string, unknown>
          | undefined;
        if (headers) {
          delete headers.authorization;
          delete headers.Authorization;
          delete headers.cookie;
          delete headers.Cookie;
          delete headers["x-metrics-token"];
          delete headers["X-Metrics-Token"];
        }
      }

      return event;
    },
  };
}
