import { canLinkOfficeContacts } from "@acre/auth";
import { getTransactionContactLink, setPrimaryTransactionContact, unlinkContactFromTransaction } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    contactLinkId: string;
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

  const { transactionId, contactLinkId } = await params;
  const relation = await getTransactionContactLink(context.currentOrganization.id, transactionId, contactLinkId);

  if (!relation) {
    return NextResponse.json({ error: "Linked contact not found." }, { status: 404 });
  }

  const updated = await setPrimaryTransactionContact(
    context.currentOrganization.id,
    transactionId,
    relation.clientId,
    context.currentMembership.id
  );

  if (!updated) {
    return NextResponse.json({ error: "Failed to set primary contact." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canLinkOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact linking access required." }, { status: 403 });
  }

  const { transactionId, contactLinkId } = await params;
  const relation = await getTransactionContactLink(context.currentOrganization.id, transactionId, contactLinkId);

  if (!relation) {
    return NextResponse.json({ error: "Linked contact not found." }, { status: 404 });
  }

  const removed = await unlinkContactFromTransaction(
    context.currentOrganization.id,
    relation.clientId,
    transactionId,
    context.currentMembership.id
  );

  if (!removed) {
    return NextResponse.json({ error: "Failed to unlink contact." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
