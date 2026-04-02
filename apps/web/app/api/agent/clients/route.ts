import { canCreateOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { createContact, findFrontOfficeLeadDuplicateMatches } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function readBoolean(body: Record<string, unknown>, key: string) {
  return body[key] === true;
}

function parsePreferredAreas(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    !canCreateOfficeContacts(context.currentMembership)
  ) {
    return NextResponse.json(
      { error: "Front Office client create access required." },
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

  const fullName = readOptionalString(body, "fullName");
  const email = readOptionalString(body, "email");
  const phone = readOptionalString(body, "phone");
  const source = readOptionalString(body, "source");
  const stage = readOptionalString(body, "stage");
  const intent = readOptionalString(body, "intent");
  const budgetMax = readOptionalString(body, "budgetMax");
  const preferredAreas = readOptionalString(body, "preferredAreas");
  const nextFollowUpAt = readOptionalString(body, "nextFollowUpAt");
  const notes = readOptionalString(body, "notes");
  const skipDuplicateCheck = readBoolean(body, "skipDuplicateCheck");

  if (!fullName) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 },
    );
  }

  if (!skipDuplicateCheck) {
    const duplicateMatches = await findFrontOfficeLeadDuplicateMatches({
      organizationId: context.currentOrganization.id,
      ownerMembershipId: context.currentMembership.id,
      fullName,
      email,
      phone,
      timeZone: context.currentUser.timezone,
    });

    if (duplicateMatches.length) {
      return NextResponse.json(
        {
          error:
            "Potential duplicate clients already exist in your Front Office queue. Review them first or confirm that you want to create a new lead anyway.",
          duplicateMatches,
        },
        { status: 409 },
      );
    }
  }

  try {
    const contact = await createContact({
      organizationId: context.currentOrganization.id,
      ownerMembershipId: context.currentMembership.id,
      actorMembershipId: context.currentMembership.id,
      actorOfficeId: context.currentOffice?.id ?? null,
      fullName,
      email,
      phone,
      source: source || "Manual entry",
      stage: stage || "Warm Lead",
      intent: intent || "Buyer",
      budgetMax,
      preferredAreas: parsePreferredAreas(preferredAreas),
      nextFollowUpAt,
      notes,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the Front Office lead.",
      },
      { status: 400 },
    );
  }
}
