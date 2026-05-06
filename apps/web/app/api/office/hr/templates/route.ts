import { canManageOfficeHrTemplates } from "@acre/auth";
import { listHrDocumentTemplates, saveHrDocumentTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../_shared";

const templateSchema = z.object({
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

export async function GET(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request);
  if (access.response) {
    return access.response;
  }

  const snapshot = await listHrDocumentTemplates({
    organizationId: access.context.currentOrganization.id,
    officeId: access.context.currentOffice?.id ?? null,
    type: request.nextUrl.searchParams.get("type"),
  });

  return NextResponse.json({ snapshot });
}

export async function POST(request: NextRequest) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHrTemplates);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, templateSchema, {
    error: "Template payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const template = await saveHrDocumentTemplate({
      ...parsed.data,
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      actorMembershipId: access.context.currentMembership.id,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to save template.");
  }
}
