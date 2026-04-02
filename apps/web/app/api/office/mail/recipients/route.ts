import { canAccessOfficeMail } from "@acre/auth";
import { listOfficeMailRecipientOptions } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json({ error: "Mail access required." }, { status: 403 });
  }

  try {
    const recipients = await listOfficeMailRecipientOptions({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id
    });

    return NextResponse.json({ recipients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load mail recipients." },
      { status: 400 }
    );
  }
}
