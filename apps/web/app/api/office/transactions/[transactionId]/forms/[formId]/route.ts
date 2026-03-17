import { canUseOfficeForms } from "@acre/auth";
import { updateTransactionForm } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    formId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canUseOfficeForms(context.currentMembership)) {
    return NextResponse.json({ error: "Form access required." }, { status: 403 });
  }

  const { transactionId, formId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        linkedTaskId?: string | null;
        offerId?: string | null;
        generatedPayload?: Record<string, string>;
        status?: string;
      }
    | null;

  try {
    const form = await updateTransactionForm({
      organizationId: context.currentOrganization.id,
      transactionId,
      formId,
      actorMembershipId: context.currentMembership.id,
      name: body?.name,
      linkedTaskId: body?.linkedTaskId ?? undefined,
      offerId: body?.offerId ?? undefined,
      generatedPayload: body?.generatedPayload,
      status: body?.status as never
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Form update failed." },
      { status: 400 }
    );
  }
}
