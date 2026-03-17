import { canCreateOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { createContact, getOfficeContactFieldSchema, listContacts, officeContactsPageDefaults, officeContactsPageLimits, prepareContactFieldSubmission } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function parsePreferredAreas(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
  if (!value || !value.trim()) {
    return fallback;
  }

  const numeric = Number.parseInt(value, 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return null;
  }

  return max ? Math.min(numeric, max) : numeric;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact access required." }, { status: 403 });
  }

  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const stage = request.nextUrl.searchParams.get("stage") ?? undefined;
  const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), officeContactsPageDefaults.page);
  const pageSize = parsePositiveInteger(
    request.nextUrl.searchParams.get("pageSize"),
    officeContactsPageDefaults.pageSize,
    officeContactsPageLimits.maxPageSize
  );

  if (page === null || pageSize === null) {
    return NextResponse.json({ error: "page and pageSize must be positive integers." }, { status: 400 });
  }

  const result = await listContacts({
    organizationId: context.currentOrganization.id,
    search,
    stage,
    page,
    pageSize
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateOfficeContacts(context.currentMembership)) {
    return NextResponse.json({ error: "Contact create access required." }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  try {
    const schema = await getOfficeContactFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    });
    const submission = prepareContactFieldSubmission({
      schema,
      payload: body
    });
    const contact = await createContact({
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
      additionalFields: submission.additionalFields
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create contact."
      },
      { status: 400 }
    );
  }
}
