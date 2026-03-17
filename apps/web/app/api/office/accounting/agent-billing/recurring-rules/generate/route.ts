import { canManageOfficeAgentBilling } from "@acre/auth";
import { generateDueAgentBillingCharges } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const transactionIds = await generateDueAgentBillingCharges({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      asOfDate: typeof body?.asOfDate === "string" ? body.asOfDate : "",
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ transactionIds }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate due recurring charges." },
      { status: 400 }
    );
  }
}
