import { canManageOfficeTasks } from "@acre/auth";
import { createTransactionTask } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeTasks(context.currentMembership)) {
    return NextResponse.json({ error: "Task list access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        checklistGroup?: string;
        title?: string;
        description?: string;
        assigneeMembershipId?: string;
        dueAt?: string;
        status?: string;
        requiresDocument?: boolean;
        requiresDocumentApproval?: boolean;
        requiresSecondaryApproval?: boolean;
      }
    | null;

  const title = body?.title?.trim();

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  try {
    const task = await createTransactionTask({
      organizationId: context.currentOrganization.id,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      checklistGroup: body?.checklistGroup ?? "",
      title,
      description: body?.description ?? "",
      assigneeMembershipId: body?.assigneeMembershipId ?? "",
      dueAt: body?.dueAt ?? "",
      status: body?.status as never,
      requiresDocument: body?.requiresDocument,
      requiresDocumentApproval: body?.requiresDocumentApproval,
      requiresSecondaryApproval: body?.requiresSecondaryApproval
    });

    if (!task) {
      return NextResponse.json({ error: "Transaction not found or task could not be created." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task could not be created." },
      { status: 400 }
    );
  }
}
