import { canCreateProjectSigning, saveProjectSigningTemplateFields } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { saveProjectSigningTemplateFieldsBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function PUT(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, saveProjectSigningTemplateFieldsBodySchema, {
    error: "Project signing template fields payload is invalid.",
    invalidJsonError: "Project signing template fields request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { templateId } = await routeContext.params;

  try {
    const snapshot = await saveProjectSigningTemplateFields({
      ...buildProjectSigningContext(context),
      templateId,
      fields: parsedBody.data.fields,
    });

    return NextResponse.json({ template: snapshot.template });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project signing template fields could not be saved." },
      { status: 400 },
    );
  }
}
