import { canUseOfficeForms } from "@acre/auth";
import {
  updateTransactionForm,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { updateOfficeTransactionFormBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    formId: string;
  }>;
};

type OfficeTransactionFormRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  updateTransactionForm?: typeof updateTransactionForm;
};

export async function handleUpdateOfficeTransactionFormPatch(
  request: NextRequest,
  transactionId: string,
  formId: string,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionFormRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeTransactionFormBodySchema, {
    error: "Transaction form update payload is invalid.",
    invalidJsonError: "Transaction form update request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const form = await (
      dependencies.updateTransactionForm ?? updateTransactionForm
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      formId,
      actorMembershipId: context.currentMembership.id,
      name: parsedBody.data.name,
      linkedTaskId: parsedBody.data.linkedTaskId ?? undefined,
      offerId: parsedBody.data.offerId ?? undefined,
      generatedPayload: parsedBody.data.generatedPayload,
      status: parsedBody.data.status as never
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canUseOfficeForms(context.currentMembership)) {
    return NextResponse.json({ error: "Form access required." }, { status: 403 });
  }

  const { transactionId, formId } = await params;
  return handleUpdateOfficeTransactionFormPatch(request, transactionId, formId, context);
}
