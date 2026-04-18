import { canManageOfficeFields } from "@acre/auth";
import {
  getOfficeTransactionReportSearchLayoutSnapshot,
  saveOfficeTransactionReportSearchLayout,
  type OfficeTransactionReportSearchFieldKey,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { updateOfficeTransactionReportSearchLayoutBodySchema } from "./route.schema";

type OfficeTransactionReportSearchLayoutRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveOfficeTransactionReportSearchLayout?: typeof saveOfficeTransactionReportSearchLayout;
  getOfficeTransactionReportSearchLayoutSnapshot?: typeof getOfficeTransactionReportSearchLayoutSnapshot;
};

export async function handleUpdateOfficeTransactionReportSearchLayoutPatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionReportSearchLayoutRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeTransactionReportSearchLayoutBodySchema,
    {
      error: "Report search layout payload is invalid.",
      invalidJsonError: "Report search layout request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    await (
      dependencies.saveOfficeTransactionReportSearchLayout ??
      saveOfficeTransactionReportSearchLayout
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      fields: (parsedBody.data.fields ?? []).map((field) => String(field)) as OfficeTransactionReportSearchFieldKey[]
    });

    const snapshot = await (
      dependencies.getOfficeTransactionReportSearchLayoutSnapshot ??
      getOfficeTransactionReportSearchLayoutSnapshot
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
            : "Failed to save report search layout."
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

  return handleUpdateOfficeTransactionReportSearchLayoutPatch(request, context);
}
