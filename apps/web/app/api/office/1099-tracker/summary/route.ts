import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099SummaryRows } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

function readSearchParamValue(value: string | null) {
  return value?.trim() ? value.trim() : undefined;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  const rows = await getOffice1099SummaryRows({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    taxYear: readSearchParamValue(request.nextUrl.searchParams.get("taxYear")) ?? ""
  });

  return NextResponse.json({ rows });
}
