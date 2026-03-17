import { canManageOfficeChecklists } from "@acre/auth";
import { updateChecklistTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeChecklists(context.currentMembership)) {
    return NextResponse.json({ error: "Checklist management permission required." }, { status: 403 });
  }

  const { templateId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        description?: string;
        transactionType?: string;
        isActive?: boolean;
        items?: Array<{
          checklistGroup?: string;
          title?: string;
          description?: string;
          dueDaysOffset?: string;
          requiresDocument?: boolean;
          requiresDocumentApproval?: boolean;
          requiresSecondaryApproval?: boolean;
        }>;
      }
    | null;

  try {
    const template = await updateChecklistTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      templateId,
      name: body?.name ?? "",
      description: body?.description ?? "",
      transactionType: body?.transactionType ?? "",
      isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
      items: body?.items ?? []
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update checklist template." }, { status: 400 });
  }
}
