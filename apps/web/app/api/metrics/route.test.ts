import assert from "node:assert/strict";
import test from "node:test";
import { handleMetricsGet } from "./route";

function createRequest(token?: string) {
  return new Request("http://localhost:3105/api/metrics", {
    headers: token
      ? {
          "x-metrics-token": token,
        }
      : {},
  });
}

test("handleMetricsGet returns 401 when the metrics token is unset", async () => {
  const response = await handleMetricsGet(createRequest(), {
    expectedToken: "",
  });

  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  assert.equal(await response.text(), "Unauthorized\n");
});

test("handleMetricsGet returns 401 when the provided token does not match", async () => {
  const response = await handleMetricsGet(createRequest("wrong-token"), {
    expectedToken: "correct-token",
  });

  assert.equal(response.status, 401);
});

test("handleMetricsGet returns all Prometheus gauges when the token matches", async () => {
  const response = await handleMetricsGet(createRequest("correct-token"), {
    expectedToken: "correct-token",
    getEventLoopLagMs: () => 7.5,
    memoryUsage: () => ({
      arrayBuffers: 16,
      external: 32,
      heapTotal: 2048,
      heapUsed: 1024,
      rss: 4096,
    }),
    uptime: () => 18,
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/plain; version=0.0.4; charset=utf-8",
  );

  const body = await response.text();

  assert.match(body, /nodejs_process_rss_bytes 4096/);
  assert.match(body, /nodejs_process_heap_used_bytes 1024/);
  assert.match(body, /nodejs_process_heap_total_bytes 2048/);
  assert.match(body, /nodejs_process_external_bytes 32/);
  assert.match(body, /nodejs_process_uptime_seconds 18/);
  assert.match(body, /nodejs_event_loop_lag_ms 7.5/);
});
