import { canManageOfficeCommissions } from "@acre/auth";
import { saveCommissionPlan } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    commissionPlanId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { commissionPlanId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const commissionPlan = await saveCommissionPlan({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      commissionPlanId,
      name: typeof body?.name === "string" ? body.name : "",
      description: typeof body?.description === "string" ? body.description : "",
      calculationMode: typeof body?.calculationMode === "string" ? body.calculationMode : "",
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      defaultCurrency: typeof body?.defaultCurrency === "string" ? body.defaultCurrency : "",
      rules: Array.isArray(body?.rules)
        ? body.rules.map((rule) => {
            const input = typeof rule === "object" && rule !== null ? (rule as Record<string, unknown>) : {};

            return {
              ruleType: typeof input.ruleType === "string" ? input.ruleType : "",
              ruleName: typeof input.ruleName === "string" ? input.ruleName : "",
              sortOrder: typeof input.sortOrder === "number" ? input.sortOrder : undefined,
              splitPercent: typeof input.splitPercent === "string" ? input.splitPercent : "",
              flatAmount: typeof input.flatAmount === "string" ? input.flatAmount : "",
              feeType: typeof input.feeType === "string" ? input.feeType : "",
              feeAmount: typeof input.feeAmount === "string" ? input.feeAmount : "",
              thresholdStart: typeof input.thresholdStart === "string" ? input.thresholdStart : "",
              thresholdEnd: typeof input.thresholdEnd === "string" ? input.thresholdEnd : "",
              appliesToRole: typeof input.appliesToRole === "string" ? input.appliesToRole : "",
              recipientType: typeof input.recipientType === "string" ? input.recipientType : "",
              isActive: input.isActive === undefined ? true : Boolean(input.isActive)
            };
          })
        : [],
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ commissionPlan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update commission plan." },
      { status: 400 }
    );
  }
}
