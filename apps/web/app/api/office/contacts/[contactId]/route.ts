import { canEditOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { getContactById, getOfficeContactFieldSchema, prepareContactFieldSubmission, updateContact } from "@acre/db";
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
  const contact = await getContactById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    contactId,
    officeId: context.currentOffice?.id ?? null
  });

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
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  const existingContact = await getContactById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    contactId,
    officeId: context.currentOffice?.id ?? null
  });

  if (!existingContact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  try {
    const schema = await getOfficeContactFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = prepareContactFieldSubmission({
      schema,
      payload: body,
      existingContact
    });
    const contact = await updateContact(contactId, {
      organizationId: context.currentOrganization.id,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id,
      fullName: submission.fullName,
      email: submission.email,
      phone: submission.phone,
      contactType: submission.contactType,
      source: submission.source,
      stage: submission.stage,
      intent: submission.intent,
      budgetMin: submission.budgetMin,
      budgetMax: submission.budgetMax,
      preferredAreas: parsePreferredAreas(submission.preferredAreas),
      notes: submission.notes,
      lastContactAt: submission.lastContactAt,
      nextFollowUpAt: submission.nextFollowUpAt,
      leaseEndDate: submission.leaseEndDate,
      leaseReminderAt: submission.leaseReminderAt,
      additionalFields: submission.additionalFields
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save contact."
      },
      { status: 400 }
    );
  }
}
