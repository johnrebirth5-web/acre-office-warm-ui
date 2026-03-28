import { canAccessOfficeAdminAccountingWorkspace } from "@acre/auth";
import { updateAgentPayoutStatementManualLineItems } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeAdminAccountingWorkspace(context.currentMembership)) {
    return NextResponse.json({ error: "Office admin access required." }, { status: 403 });
  }

  const { statementId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        manualLineItems?: Array<{
          id?: unknown;
          memo?: unknown;
          amount?: unknown;
        }>;
      }
    | null;

  try {
    const result = await updateAgentPayoutStatementManualLineItems({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      statementId,
      manualLineItems: Array.isArray(body?.manualLineItems)
        ? body.manualLineItems.map((lineItem) => ({
            ...(typeof lineItem?.id === "string" ? { id: lineItem.id } : {}),
            memo: typeof lineItem?.memo === "string" ? lineItem.memo : "",
            amount: typeof lineItem?.amount === "string" ? lineItem.amount : ""
          }))
        : [],
      actorMembershipId: context.currentMembership.id
    });

    if (!result) {
      return NextResponse.json({ error: "Statement not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update statement manual line items." },
      { status: 400 }
    );
  }
}
