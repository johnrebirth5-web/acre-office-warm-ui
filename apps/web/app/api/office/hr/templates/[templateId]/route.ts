import { canManageOfficeHrTemplates } from "@acre/auth";
import { getHrDocumentTemplate, saveHrDocumentTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

const templateUpdateSchema = z.object({
  type: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1),
  company: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  body: z.string().optional().nullable(),
  variables: z.array(z.string()).optional(),
  driveFileId: z.string().trim().optional().nullable(),
  driveFolderId: z.string().trim().optional().nullable(),
  sourceUrl: z.string().trim().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const { templateId } = await params;
  const template = await getHrDocumentTemplate({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    templateId,
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHrTemplates);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, templateUpdateSchema, {
    error: "Template update payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { templateId } = await params;
  try {
    const template = await saveHrDocumentTemplate({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
      templateId,
    });
    return NextResponse.json({ template });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to update template.");
  }
}
