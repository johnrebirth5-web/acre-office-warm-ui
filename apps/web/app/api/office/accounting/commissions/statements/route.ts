import { canApproveOfficeCommissions, canManageOfficeCommissions } from "@acre/auth";
import { generateCommissionStatementSnapshot, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { createCommissionStatementBodySchema } from "./route.schema";

type CommissionStatementsRouteDependencies = {
  generateCommissionStatementSnapshot?: typeof generateCommissionStatementSnapshot;
  parseJsonBody?: typeof parseJsonBody;
};

export async function handleCreateCommissionStatementPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: CommissionStatementsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createCommissionStatementBodySchema,
    {
      error: "Commission statement payload is invalid.",
      invalidJsonError: "Commission statement request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const statement = await (
      dependencies.generateCommissionStatementSnapshot ?? generateCommissionStatementSnapshot
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      startDate: body.startDate,
      endDate: body.endDate,
      actorMembershipId: context.currentMembership.id
    });

    if (!statement) {
      return NextResponse.json({ error: "Agent not found for statement generation." }, { status: 404 });
    }

    return NextResponse.json({ statement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate commission statement." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership) && !canApproveOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission statement management access required." }, { status: 403 });
  }

  return handleCreateCommissionStatementPost(request, context);
}
