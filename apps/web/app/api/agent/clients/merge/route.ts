import {
  canEditOfficeContacts,
  canViewOfficeContacts,
} from "@acre/auth";
import { mergeFrontOfficeClients } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

function readRequiredString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    !canViewOfficeContacts(context.currentMembership) ||
    !canEditOfficeContacts(context.currentMembership)
  ) {
    return NextResponse.json(
      { error: "Front Office client edit access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const targetClientId = readRequiredString(body, "targetClientId");
  const sourceClientId = readRequiredString(body, "sourceClientId");

  if (!targetClientId || !sourceClientId) {
    return NextResponse.json(
      { error: "Both targetClientId and sourceClientId are required." },
      { status: 400 },
    );
  }

  try {
    const result = await mergeFrontOfficeClients({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id ?? null,
      targetClientId,
      sourceClientId,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not merge the duplicate Front Office records.",
      },
      { status: 400 },
    );
  }
}
