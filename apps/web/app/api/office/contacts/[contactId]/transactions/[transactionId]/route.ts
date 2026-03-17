import { canLinkOfficeContacts } from "@acre/auth";
import { linkContactToTransaction } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    contactId: string;
    transactionId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canLinkOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact linking access required." }, { status: 403 });
  }

  const { contactId, transactionId } = await params;
  const linked = await linkContactToTransaction(context.currentOrganization.id, contactId, transactionId, {
    actorMembershipId: context.currentMembership.id
  });

  if (!linked) {
    return NextResponse.json({ error: "Contact or transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
