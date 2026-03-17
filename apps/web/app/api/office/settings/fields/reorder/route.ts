import { canManageOfficeFields } from "@acre/auth";
import { reorderOfficeFields } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        module?: string;
        fieldOrder?: Array<{
          kind?: string;
          fieldKey?: string;
        }>;
      }
    | null;

  try {
    const snapshot = await reorderOfficeFields({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body?.module === "contact" || body?.module === "offer" ? body.module : "transaction",
      fieldOrder:
        body?.fieldOrder?.map((entry) => ({
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
