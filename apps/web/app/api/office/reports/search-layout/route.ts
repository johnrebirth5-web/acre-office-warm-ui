import { canManageOfficeFields } from "@acre/auth";
import {
  getOfficeTransactionReportSearchLayoutSnapshot,
  saveOfficeTransactionReportSearchLayout,
  type OfficeTransactionReportSearchFieldKey
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

export async function PATCH(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fields?: string[];
      }
    | null;

  try {
    await saveOfficeTransactionReportSearchLayout({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      fields: (body?.fields ?? []).map((field) => String(field)) as OfficeTransactionReportSearchFieldKey[]
    });

    const snapshot = await getOfficeTransactionReportSearchLayoutSnapshot({
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
