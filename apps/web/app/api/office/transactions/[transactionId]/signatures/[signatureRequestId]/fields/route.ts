import { canManageOfficeSignatures } from "@acre/auth";
import { getSignatureEditorSnapshot, replaceSignatureRequestFields } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

const allowedFieldTypes = new Set(["signature", "date", "name", "text", "initials", "email", "title", "company", "checkbox", "dropdown"]);

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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature access required." }, { status: 403 });
  }

  const { transactionId, signatureRequestId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        fields?: Array<{
          id?: string;
          fieldType?: string;
          label?: string;
          page?: number;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          required?: boolean;
          defaultValue?: string | null;
          fontStyle?: string | null;
          assignedRecipientId?: string | null;
          fieldKey?: string | null;
          isReadOnly?: boolean;
          isSystemPrefilled?: boolean;
          visibilityRule?: unknown;
          mirrorGroup?: string | null;
          fieldOptions?: unknown;
          sortOrder?: number;
        }>;
      }
    | null;

  if (!body?.fields || !Array.isArray(body.fields)) {
    return NextResponse.json({ error: "A fields array is required." }, { status: 400 });
  }

  const invalidField = body.fields.find((field) => !field.fieldType || !allowedFieldTypes.has(field.fieldType));
  if (invalidField) {
    return NextResponse.json({ error: "Every signature field needs a valid field type." }, { status: 400 });
  }

  try {
    const fields = await replaceSignatureRequestFields({
      organizationId: context.currentOrganization.id,
      transactionId,
      signatureRequestId,
      actorMembershipId: context.currentMembership.id,
      fields: body.fields.map((field, index) => ({
        id: field.id,
        assignedRecipientId: field.assignedRecipientId?.trim() || null,
        fieldType: field.fieldType as "signature" | "date" | "name" | "text" | "initials" | "email" | "title" | "company" | "checkbox" | "dropdown",
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
