import { canManageOfficeCommissions } from "@acre/auth";
import { saveCommissionSplitTemplate, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { upsertCommissionSplitTemplateBodySchema } from "./route.schema";

type CommissionSplitTemplateRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveCommissionSplitTemplate?: typeof saveCommissionSplitTemplate;
};

export async function handleCreateCommissionSplitTemplatePost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: CommissionSplitTemplateRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    upsertCommissionSplitTemplateBodySchema,
    {
      error: "Commission split template payload is invalid.",
      invalidJsonError: "Commission split template request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const splitTemplate = await (dependencies.saveCommissionSplitTemplate ?? saveCommissionSplitTemplate)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      name: body.name,
      agentPercent: body.agentPercent,
      isActive: body.isActive ?? true,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ splitTemplate }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save split template." },
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

  return handleCreateCommissionSplitTemplatePost(request, context);
}
