import { canLinkOfficeContacts } from "@acre/auth";
import { linkContactToTransaction } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canLinkOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact linking access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as { contactId?: string; isPrimary?: boolean } | null;
  const contactId = body?.contactId?.trim();

  if (!contactId) {
    return NextResponse.json({ error: "Contact is required." }, { status: 400 });
  }

  const linked = await linkContactToTransaction(context.currentOrganization.id, contactId, transactionId, {
    isPrimary: Boolean(body?.isPrimary),
    actorMembershipId: context.currentMembership.id
  });

  if (!linked) {
    return NextResponse.json({ error: "Contact or transaction not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
