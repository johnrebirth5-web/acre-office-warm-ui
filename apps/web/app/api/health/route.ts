import { getApiCatalog, getCurrentOrganization } from "@acre/backoffice";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    service: "acre-agent-os",
    organization: getCurrentOrganization(),
    routes: getApiCatalog(),
    timestamp: new Date().toISOString()
  });
}
