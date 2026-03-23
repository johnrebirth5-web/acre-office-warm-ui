import { canManageOfficeFields } from "@acre/auth";
import {
  getOfficeTransactionSearchLayoutSnapshot,
  saveOfficeTransactionSearchLayout
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
        fields?: Array<{
          kind?: string;
          key?: string;
        }>;
      }
    | null;

  try {
    await saveOfficeTransactionSearchLayout({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      fields:
        body?.fields?.map((field) => ({
          kind:
            field.kind === "system" || field.kind === "builtin" || field.kind === "custom"
              ? field.kind
              : "system",
          key: String(field.key ?? "")
        })) ?? []
    });

    const snapshot = await getOfficeTransactionSearchLayoutSnapshot({
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
