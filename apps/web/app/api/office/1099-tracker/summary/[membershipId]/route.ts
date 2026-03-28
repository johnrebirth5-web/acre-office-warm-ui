import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099SummaryDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

function readSearchParamValue(value: string | null) {
  return value?.trim() ? value.trim() : undefined;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const detail = await getOffice1099SummaryDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId,
    taxYear: readSearchParamValue(request.nextUrl.searchParams.get("taxYear")) ?? ""
  });

  if (!detail) {
    return NextResponse.json({ error: "1099 summary detail not found." }, { status: 404 });
  }

  return NextResponse.json({ detail });
}
