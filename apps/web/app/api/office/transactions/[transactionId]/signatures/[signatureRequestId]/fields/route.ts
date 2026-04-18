import { canManageOfficeSignatures } from "@acre/auth";
import {
  getSignatureEditorSnapshot,
  replaceSignatureRequestFields,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";
import { replaceOfficeSignatureFieldsBodySchema } from "./route.schema";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature access required." }, { status: 403 });
  }

  const { transactionId, signatureRequestId } = await params;
  const snapshot = await getSignatureEditorSnapshot(context.currentOrganization.id, transactionId, signatureRequestId);

  if (!snapshot) {
    return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
  }

  return NextResponse.json({ fields: snapshot.fields });
}

type OfficeSignatureFieldsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  replaceSignatureRequestFields?: typeof replaceSignatureRequestFields;
};

export async function handleReplaceOfficeSignatureFieldsPut(
  request: NextRequest,
  transactionId: string,
  signatureRequestId: string,
  context: SessionMembershipContext,
  dependencies: OfficeSignatureFieldsRouteDependencies = {},
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    replaceOfficeSignatureFieldsBodySchema,
    {
      error: "Signature fields payload is invalid.",
      invalidJsonError: "Signature fields request body must be valid JSON.",
    },
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const fields = await (
      dependencies.replaceSignatureRequestFields ?? replaceSignatureRequestFields
    )({
      organizationId: context.currentOrganization.id,
      transactionId,
      signatureRequestId,
      actorMembershipId: context.currentMembership.id,
      fields: parsedBody.data.fields.map((field, index) => ({
        id: field.id,
        assignedRecipientId: field.assignedRecipientId?.trim() || null,
        fieldType: field.fieldType,
        label: field.label?.trim() || "",
        page: typeof field.page === "number" ? field.page : 1,
        x: typeof field.x === "number" ? field.x : 0.1,
        y: typeof field.y === "number" ? field.y : 0.1,
        width: typeof field.width === "number" ? field.width : 0.2,
        height: typeof field.height === "number" ? field.height : 0.06,
        required: field.required ?? true,
        defaultValue: field.defaultValue ?? null,
        fontStyle: field.fontStyle ?? null,
        fieldKey: field.fieldKey ?? null,
        isReadOnly: field.isReadOnly ?? false,
        isSystemPrefilled: field.isSystemPrefilled ?? false,
        visibilityRule: (field.visibilityRule ?? null) as never,
        mirrorGroup: field.mirrorGroup ?? null,
        fieldOptions: (field.fieldOptions ?? null) as never,
        sortOrder: typeof field.sortOrder === "number" ? field.sortOrder : index
      }))
    });

    if (!fields) {
      return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
    }

    return NextResponse.json({ fields });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature fields could not be saved." },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature access required." }, { status: 403 });
  }

  const { transactionId, signatureRequestId } = await params;
  return handleReplaceOfficeSignatureFieldsPut(
    request,
    transactionId,
    signatureRequestId,
    context,
  );
}
