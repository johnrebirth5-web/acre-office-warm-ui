import { canManageOfficeCommissions } from "@acre/auth";
import {
  deleteCommissionSplitTemplate,
  saveCommissionSplitTemplate,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { upsertCommissionSplitTemplateBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    splitTemplateId: string;
  }>;
};

type CommissionSplitTemplateDetailRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveCommissionSplitTemplate?: typeof saveCommissionSplitTemplate;
};

export async function handleUpdateCommissionSplitTemplatePatch(
  request: NextRequest,
  context: SessionMembershipContext,
  splitTemplateId: string,
  dependencies: CommissionSplitTemplateDetailRouteDependencies = {}
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
    const splitTemplate = await (
      dependencies.saveCommissionSplitTemplate ?? saveCommissionSplitTemplate
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      splitTemplateId,
      name: body.name,
      agentPercent: body.agentPercent,
      isActive: body.isActive ?? true,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ splitTemplate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update split template." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { splitTemplateId } = await params;

  return handleUpdateCommissionSplitTemplatePatch(request, context, splitTemplateId);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(_request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeCommissions(context.currentMembership)) {
    return NextResponse.json({ error: "Commission management access required." }, { status: 403 });
  }

  const { splitTemplateId } = await params;

  try {
    const result = await deleteCommissionSplitTemplate({
      organizationId: context.currentOrganization.id,
      splitTemplateId,
      actorMembershipId: context.currentMembership.id
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete split template." },
      { status: 400 }
    );
  }
}
