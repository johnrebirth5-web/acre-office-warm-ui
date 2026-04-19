import { canManageOfficeFields } from "@acre/auth";
import { reorderOfficeFields } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";
import { reorderOfficeFieldsBodySchema } from "./route.schema";

export async function handleReorderOfficeFieldsPost(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    reorderOfficeFields?: typeof reorderOfficeFields;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, reorderOfficeFieldsBodySchema, {
    error: "Field order payload is invalid.",
    invalidJsonError: "Field order payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const snapshot = await (dependencies.reorderOfficeFields ?? reorderOfficeFields)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body.module ?? "transaction",
      fieldOrder:
        body.fieldOrder?.map((entry) => ({
          kind: entry.kind === "custom" ? "custom" : "builtIn",
          fieldKey: String(entry.fieldKey ?? "")
        })) ?? []
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reorder fields."
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  return handleReorderOfficeFieldsPost(request, context);
}
