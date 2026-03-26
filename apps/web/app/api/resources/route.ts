import { can } from "@acre/auth";
import { listResources, listVendors } from "@acre/backoffice";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!can(context.currentMembership, "resources:view")) {
    return NextResponse.json({ error: "Resource access required." }, { status: 403 });
  }

  return NextResponse.json({
    resources: listResources(),
    vendors: listVendors()
  });
}
