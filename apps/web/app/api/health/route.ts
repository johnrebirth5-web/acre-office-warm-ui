import { getApiCatalog, getCurrentOrganization } from "@acre/backoffice";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "acre-agent-os",
    organization: getCurrentOrganization(),
    routes: getApiCatalog(),
    timestamp: new Date().toISOString()
  });
}
