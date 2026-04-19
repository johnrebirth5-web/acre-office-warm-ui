import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  generateDueAgentBillingCharges,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { generateAgentBillingChargesBodySchema } from "./route.schema";

type AgentBillingRecurringRuleGenerateRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  generateDueAgentBillingCharges?: typeof generateDueAgentBillingCharges;
};

export async function handleGenerateAgentBillingChargesPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingRecurringRuleGenerateRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    generateAgentBillingChargesBodySchema,
    {
      error: "Recurring billing charge generation payload is invalid.",
      invalidJsonError:
        "Recurring billing charge generation request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const transactionIds = await (
      dependencies.generateDueAgentBillingCharges ?? generateDueAgentBillingCharges
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId ?? "",
      asOfDate: body.asOfDate ?? "",
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

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  return handleGenerateAgentBillingChargesPost(request, context);
}
