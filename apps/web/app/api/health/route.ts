import { getDatabaseHealthCheck } from "@acre/db";
import { NextResponse } from "next/server";

export async function GET() {
  const database = await getDatabaseHealthCheck();
  const isHealthy = database.status === "available";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      service: "acre-agent-os",
      checks: {
        app: {
          status: "alive",
        },
        database,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
