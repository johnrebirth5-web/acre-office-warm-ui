import { canManageOfficeTasks } from "@acre/auth";
import {
  saveTaskListView,
  type OfficeTaskListFilters,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createTaskListViewBodySchema } from "./route.schema";

const defaultTaskListFilters: OfficeTaskListFilters = {
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
} as const;

type OfficeTaskViewsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveTaskListView?: typeof saveTaskListView;
};

export async function handleCreateOfficeTaskViewPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeTaskViewsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    createTaskListViewBodySchema,
    {
      error: "Task view payload is invalid.",
      invalidJsonError: "Task view request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  const view = await (dependencies.saveTaskListView ?? saveTaskListView)({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    name: body.name,
    isShared: body.isShared,
    filters: body.filters ?? defaultTaskListFilters,
    visibleColumns: body.visibleColumns,
    sort: body.sort
  });

  if (!view) {
    return NextResponse.json({ error: "View could not be saved." }, { status: 400 });
  }

  return NextResponse.json({ view }, { status: 201 });
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  return handleCreateOfficeTaskViewPost(request, context);
}
