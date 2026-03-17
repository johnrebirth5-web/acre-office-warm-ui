import { canManageOfficeTasks } from "@acre/auth";
import { saveTaskListView } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        isShared?: boolean;
        filters?: unknown;
        visibleColumns?: unknown;
        sort?: unknown;
      }
    | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "View name is required." }, { status: 400 });
  }

  const view = await saveTaskListView({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    name: body.name,
    isShared: body.isShared,
    filters: typeof body.filters === "object" && body.filters ? (body.filters as never) : {
      transactionStatus: "Active",
      assigneeMembershipId: "",
      dueWindow: "",
      noDueDate: false,
      reviewStatus: "",
      requiresSecondaryApproval: false,
      complianceStatuses: [],
      transactionId: "",
      q: "",
      includeCompleted: false
    },
    visibleColumns: Array.isArray(body.visibleColumns) ? (body.visibleColumns as never) : undefined,
    sort: typeof body.sort === "object" && body.sort ? (body.sort as never) : undefined
  });

  if (!view) {
    return NextResponse.json({ error: "View could not be saved." }, { status: 400 });
  }

  return NextResponse.json({ view }, { status: 201 });
}
