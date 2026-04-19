import { canManageOfficeAgentBilling } from "@acre/auth";
import {
  updateAgentRecurringChargeRule,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateAgentRecurringChargeRuleBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    recurringChargeRuleId: string;
  }>;
};

type AgentBillingRecurringRuleDetailRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateAgentRecurringChargeRule?: typeof updateAgentRecurringChargeRule;
};

export async function handleUpdateAgentBillingRecurringRulePatch(
  request: NextRequest,
  recurringChargeRuleId: string,
  context: SessionMembershipContext,
  dependencies: AgentBillingRecurringRuleDetailRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateAgentRecurringChargeRuleBodySchema,
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
    const updatedId = await (
      dependencies.updateAgentRecurringChargeRule ?? updateAgentRecurringChargeRule
    )({
      organizationId: context.currentOrganization.id,
      recurringChargeRuleId,
      officeId:
        body.officeId === undefined || body.officeId === null
          ? context.currentOffice?.id ?? null
          : body.officeId,
      membershipId: body.membershipId,
      name: body.name,
      chargeType: body.chargeType,
      description: body.description,
      amount: body.amount,
      frequency: body.frequency,
      customIntervalDays: body.customIntervalDays,
      startDate: body.startDate,
      nextDueDate: body.nextDueDate,
      endDate: body.endDate,
      autoGenerateInvoice: body.autoGenerateInvoice,
      isActive: body.isActive,
      actorMembershipId: context.currentMembership.id
    });

    if (!updatedId) {
      return NextResponse.json({ error: "Recurring billing rule not found." }, { status: 404 });
    }

    return NextResponse.json({ recurringChargeRuleId: updatedId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update recurring billing rule." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Agent billing management access required." }, { status: 403 });
  }

  const { recurringChargeRuleId } = await params;
  return handleUpdateAgentBillingRecurringRulePatch(request, recurringChargeRuleId, context);
}
