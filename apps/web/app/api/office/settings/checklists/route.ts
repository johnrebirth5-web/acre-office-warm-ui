import { canManageOfficeChecklists } from "@acre/auth";
import { createChecklistTemplate } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeChecklists(context.currentMembership)) {
    return NextResponse.json({ error: "Checklist management permission required." }, { status: 403 });
  }

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
    const template = await createChecklistTemplate({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      name: body?.name ?? "",
      description: body?.description ?? "",
      transactionType: body?.transactionType ?? "",
      isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
      items: body?.items ?? []
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create checklist template." }, { status: 400 });
  }
}
