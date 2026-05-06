import { canManageOfficeHr } from "@acre/auth";
import { updateHrChecklistItemStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import {
  buildOfficeHrErrorResponse,
  requireOfficeHrApiContext,
} from "../../../_shared";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

const checklistItemSchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeHrApiContext(request, canManageOfficeHr);
  if (access.response) {
    return access.response;
  }

  const parsed = await parseJsonBody(request, checklistItemSchema, {
    error: "Checklist item payload is invalid.",
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const { itemId } = await params;
  try {
    const item = await updateHrChecklistItemStatus({
      organizationId: access.context.currentOrganization.id,
      actorMembershipId: access.context.currentMembership.id,
      itemId,
      completed: parsed.data.completed,
    });

    if (!item) {
      return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return buildOfficeHrErrorResponse(error, "Failed to update checklist item.");
  }
}
