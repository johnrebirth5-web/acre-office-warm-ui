import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { createAgentPayoutStatement } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        membershipId?: string;
        invoiceNumbers?: string[];
        commissionCalculationIds?: string[];
      }
    | null;

  try {
    const result = await createAgentPayoutStatement({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: typeof body?.membershipId === "string" ? body.membershipId : "",
      invoiceNumbers: Array.isArray(body?.invoiceNumbers)
        ? body.invoiceNumbers.filter((value): value is string => typeof value === "string")
        : [],
      commissionCalculationIds: Array.isArray(body?.commissionCalculationIds)
        ? body.commissionCalculationIds.filter((value): value is string => typeof value === "string")
        : [],
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate the agent payout statement." },
      { status: 400 }
    );
  }
}
