import { canManageOfficeCommissions } from "@acre/auth";
import { saveCommissionPlan, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { upsertCommissionPlanBodySchema } from "./route.schema";

type CommissionPlanRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveCommissionPlan?: typeof saveCommissionPlan;
};

function mapCommissionPlanRules(
  rules: Array<{
    ruleType: "base_split" | "brokerage_fee" | "referral_fee" | "flat_fee_deduction" | "sliding_scale";
    ruleName?: string;
    sortOrder?: number;
    splitPercent?: string;
    flatAmount?: string;
    feeType?: "percentage" | "flat";
    feeAmount?: string;
    thresholdStart?: string;
    thresholdEnd?: string;
    appliesToRole?: string;
    recipientType?: "agent" | "brokerage" | "referral";
    isActive?: boolean;
  }>
) {
  return rules.map((rule) => ({
    ruleType: rule.ruleType,
    ruleName: rule.ruleName ?? "",
    sortOrder: rule.sortOrder,
    splitPercent: rule.splitPercent ?? "",
    flatAmount: rule.flatAmount ?? "",
    feeType: rule.feeType ?? "",
    feeAmount: rule.feeAmount ?? "",
    thresholdStart: rule.thresholdStart ?? "",
    thresholdEnd: rule.thresholdEnd ?? "",
    appliesToRole: rule.appliesToRole ?? "",
    recipientType: rule.recipientType ?? "",
    isActive: rule.isActive ?? true
  }));
}

export async function handleCreateCommissionPlanPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: CommissionPlanRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    upsertCommissionPlanBodySchema,
    {
      error: "Commission plan payload is invalid.",
      invalidJsonError: "Commission plan request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const commissionPlan = await (dependencies.saveCommissionPlan ?? saveCommissionPlan)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      name: body.name,
      description: body.description ?? "",
      calculationMode: body.calculationMode ?? "",
      isActive: body.isActive ?? true,
      defaultCurrency: body.defaultCurrency ?? "",
      rules: mapCommissionPlanRules(body.rules ?? []),
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ commissionPlan }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save commission plan." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  return handleCreateCommissionPlanPost(request, context);
}
