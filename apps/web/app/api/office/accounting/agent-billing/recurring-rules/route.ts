import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  createAgentRecurringChargeRule,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createAgentRecurringChargeRuleBodySchema } from "./route.schema";

type AgentBillingRecurringRulesRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createAgentRecurringChargeRule?: typeof createAgentRecurringChargeRule;
};

export async function handleCreateAgentBillingRecurringRulePost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: AgentBillingRecurringRulesRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createAgentRecurringChargeRuleBodySchema,
    {
      error: "Recurring billing rule payload is invalid.",
      invalidJsonError: "Recurring billing rule request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const recurringChargeRuleId = await (
      dependencies.createAgentRecurringChargeRule ?? createAgentRecurringChargeRule
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      name: body.name,
      chargeType: body.chargeType,
      description: body.description ?? "",
      amount: body.amount,
      frequency: body.frequency,
      customIntervalDays: body.customIntervalDays ?? "",
      startDate: body.startDate,
      nextDueDate: body.nextDueDate,
      endDate: body.endDate ?? "",
      autoGenerateInvoice: body.autoGenerateInvoice ?? false,
      isActive: body.isActive ?? true,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ recurringChargeRuleId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recurring billing rule." },
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

  return handleCreateAgentBillingRecurringRulePost(request, context);
}
