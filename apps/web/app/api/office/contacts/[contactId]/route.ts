import { canEditOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { getContactById, updateContact } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

function parsePreferredAreas(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact access required." }, { status: 403 });
  }

  const { contactId } = await params;
  const contact = await getContactById(context.currentOrganization.id, contactId);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ contact });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact edit access required." }, { status: 403 });
  }

  const { contactId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const fullName = String(body.fullName ?? "").trim();

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  const contact = await updateContact(contactId, {
    organizationId: context.currentOrganization.id,
    ownerMembershipId: context.currentMembership.id,
    actorMembershipId: context.currentMembership.id,
    actorOfficeId: context.currentOffice?.id,
    fullName,
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    contactType: String(body.contactType ?? ""),
    source: String(body.source ?? ""),
    stage: String(body.stage ?? ""),
    intent: String(body.intent ?? ""),
    budgetMin: String(body.budgetMin ?? ""),
    budgetMax: String(body.budgetMax ?? ""),
    preferredAreas: parsePreferredAreas(body.preferredAreas),
    notes: String(body.notes ?? ""),
    lastContactAt: String(body.lastContactAt ?? ""),
    nextFollowUpAt: String(body.nextFollowUpAt ?? "")
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  return NextResponse.json({ contact });
}
