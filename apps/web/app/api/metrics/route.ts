import { monitorEventLoopDelay } from "node:perf_hooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventLoopLagHistogram = monitorEventLoopDelay({ resolution: 10 });

eventLoopLagHistogram.enable();

function formatGaugeMetric(name: string, help: string, value: number) {
  return `# HELP ${name} ${help}
# TYPE ${name} gauge
${name} ${value}`;
}

function getEventLoopLagMs() {
  const mean = eventLoopLagHistogram.mean;
  const lagMs = Number.isFinite(mean) ? mean / 1e6 : 0;

  eventLoopLagHistogram.reset();

  return lagMs;
}

export async function GET(request: Request) {
  const expectedToken = process.env.ACRE_METRICS_TOKEN?.trim();
  const providedToken = request.headers.get("x-metrics-token");

  if (!expectedToken || providedToken !== expectedToken) {
    return new Response("Unauthorized\n", {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const memoryUsage = process.memoryUsage();
  const metrics = [
    formatGaugeMetric(
      "nodejs_process_rss_bytes",
      "Resident set size in bytes.",
      memoryUsage.rss,
    ),
    formatGaugeMetric(
      "nodejs_process_heap_used_bytes",
      "V8 heap used in bytes.",
      memoryUsage.heapUsed,
    ),
    formatGaugeMetric(
      "nodejs_process_heap_total_bytes",
      "V8 heap total in bytes.",
      memoryUsage.heapTotal,
    ),
    formatGaugeMetric(
      "nodejs_process_external_bytes",
      "External memory in bytes.",
      memoryUsage.external,
    ),
    formatGaugeMetric(
      "nodejs_process_uptime_seconds",
      "Process uptime in seconds.",
      process.uptime(),
    ),
    formatGaugeMetric(
      "nodejs_event_loop_lag_ms",
      "Mean event loop lag in milliseconds since the last scrape.",
      getEventLoopLagMs(),
    ),
  ];

  return new Response(`${metrics.join("\n")}\n`, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
