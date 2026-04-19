import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { updateCommissionCalculationStatus, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateCommissionCalculationStatusBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    calculationId: string;
  }>;
};

type CommissionCalculationRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateCommissionCalculationStatus?: typeof updateCommissionCalculationStatus;
};

export async function handleUpdateCommissionCalculationPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  calculationId: string,
  dependencies: CommissionCalculationRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateCommissionCalculationStatusBodySchema,
    {
      error: "Commission calculation payload is invalid.",
      invalidJsonError: "Commission calculation request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const calculation = await (
      dependencies.updateCommissionCalculationStatus ?? updateCommissionCalculationStatus
    )({
      organizationId: context.currentOrganization.id,
      calculationId,
      status: body.status,
      notes: body.notes ?? "",
      actorMembershipId: context.currentMembership.id
    });

    if (!calculation) {
      return NextResponse.json({ error: "Commission calculation not found." }, { status: 404 });
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update commission calculation." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership) && !canApproveOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission review access required." }, { status: 403 });
  }

  const { calculationId } = await params;

  return handleUpdateCommissionCalculationPatch(request, context, calculationId);
}
