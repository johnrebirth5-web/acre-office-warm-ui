import { canManageOfficeFields } from "@acre/auth";
import {
  getOfficeTransactionSearchLayoutSnapshot,
  type SessionMembershipContext,
  saveOfficeTransactionSearchLayout
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { updateOfficeTransactionSearchLayoutBodySchema } from "./route.schema";

type OfficeTransactionSearchLayoutRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveOfficeTransactionSearchLayout?: typeof saveOfficeTransactionSearchLayout;
  getOfficeTransactionSearchLayoutSnapshot?: typeof getOfficeTransactionSearchLayoutSnapshot;
};

export async function handleUpdateOfficeTransactionSearchLayoutPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionSearchLayoutRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, updateOfficeTransactionSearchLayoutBodySchema, {
    error: "Transaction search layout payload is invalid.",
    invalidJsonError: "Transaction search layout request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    await (
      dependencies.saveOfficeTransactionSearchLayout ??
      saveOfficeTransactionSearchLayout
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      fields:
        parsedBody.data.fields?.map((field) => ({
          kind:
            field.kind === "system" || field.kind === "builtin" || field.kind === "custom"
              ? field.kind
              : "system",
          key: String(field.key ?? "")
        })) ?? []
    });

    const snapshot = await (
      dependencies.getOfficeTransactionSearchLayoutSnapshot ??
      getOfficeTransactionSearchLayoutSnapshot
    )({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save transaction search layout."
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  return handleUpdateOfficeTransactionSearchLayoutPatch(request, context);
}
