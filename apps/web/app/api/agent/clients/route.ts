import { canCreateOfficeContacts, canViewOfficeContacts } from "@acre/auth";
import { createContact, findFrontOfficeLeadDuplicateMatches } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

const validStages = new Set([
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Viewing Scheduled",
  "Viewing Completed",
  "Negotiation",
  "Application / Offer",
  "Won",
  "Lost",
  "Pending",
]);

const validIntents = new Set([
  "Buyer",
  "Rental",
  "Seller",
  "Landlord",
  "Investor",
  "Unknown",
]);

type LeadFieldKey =
  | "fullName"
  | "phone"
  | "email"
  | "source"
  | "stage"
  | "intent"
  | "budgetMax"
  | "preferredAreas"
  | "nextFollowUpAt"
  | "notes";

type LeadFieldErrorMap = Partial<Record<LeadFieldKey, string>>;

function readOptionalString(body: Record<string, unknown>, key: string) {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function readBoolean(body: Record<string, unknown>, key: string) {
  return body[key] === true;
}

function parsePreferredAreas(value: string) {
  const seen = new Set<string>();

  return value
    .split(/,|，|\/|;|；|\n|、/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }

      const normalized = item.toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .slice(0, 6);
}

function appendFieldError(
  fieldErrors: LeadFieldErrorMap,
  field: LeadFieldKey,
  message: string,
) {
  if (!fieldErrors[field]) {
    fieldErrors[field] = message;
  }
}

function isLikelyLeadName(value: string) {
  if (value.length < 2 || value.length > 120) {
    return false;
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(value)) {
    return false;
  }

  return !/^[^A-Za-z\u4e00-\u9fff]+$/.test(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function normalizeBudgetMaxInput(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "").toLowerCase();

  if (!cleaned) {
    return "";
  }

  let multiplier = 1;
  let numericText = cleaned;

  if (cleaned.endsWith("k")) {
    multiplier = 1_000;
    numericText = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("m")) {
    multiplier = 1_000_000;
    numericText = cleaned.slice(0, -1);
  }

  const numeric = Number.parseFloat(numericText);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const normalized = numeric * multiplier;

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/\.?0+$/, "");
}

function isValidIsoDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);

  if (!year || !month || !day) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validationErrorResponse(fieldErrors: LeadFieldErrorMap) {
  return NextResponse.json(
    {
      error:
        "Lead not created. Fix the highlighted field values in the live form, then try again.",
      errorCode: "validation_error",
      fieldErrors,
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      {
        error: "Sign in again before creating a Front Office lead.",
        errorCode: "authentication_required",
      },
      { status: 401 },
    );
  }

  if (
    !canViewOfficeContacts(context.currentMembership) ||
    !canCreateOfficeContacts(context.currentMembership)
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to create Front Office leads from this workspace.",
        errorCode: "front_office_create_forbidden",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || Array.isArray(body)) {
    return NextResponse.json(
      {
        error:
          "A valid lead form payload is required before Acre can create the dossier.",
        errorCode: "invalid_request_body",
      },
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
  const fieldErrors: LeadFieldErrorMap = {};
  const normalizedBudgetMax = budgetMax
    ? normalizeBudgetMaxInput(budgetMax)
    : "";
  const normalizedPreferredAreas = parsePreferredAreas(preferredAreas);

  if (!fullName) {
    appendFieldError(fieldErrors, "fullName", "Full name is required.");
  } else if (!isLikelyLeadName(fullName)) {
    appendFieldError(
      fieldErrors,
      "fullName",
      "Enter a real lead name, not just punctuation or fragments.",
    );
  }

  if (email && !isValidEmail(email)) {
    appendFieldError(
      fieldErrors,
      "email",
      "Email must look like name@example.com.",
    );
  }

  if (phone && !isValidPhone(phone)) {
    appendFieldError(
      fieldErrors,
      "phone",
      "Phone should contain at least 7 digits.",
    );
  }

  if (source.length > 80) {
    appendFieldError(
      fieldErrors,
      "source",
      "Source should stay under 80 characters.",
    );
  }

  if (stage && !validStages.has(stage)) {
    appendFieldError(
      fieldErrors,
      "stage",
      "Choose one of the supported Front Office stages.",
    );
  }

  if (intent && !validIntents.has(intent)) {
    appendFieldError(
      fieldErrors,
      "intent",
      "Choose one of the supported intent values.",
    );
  }

  if (budgetMax && normalizedBudgetMax === null) {
    appendFieldError(
      fieldErrors,
      "budgetMax",
      "Budget should be a positive number like 5500 or 5.5k.",
    );
  } else if (
    normalizedBudgetMax &&
    Number.parseFloat(normalizedBudgetMax) > 100_000_000
  ) {
    appendFieldError(
      fieldErrors,
      "budgetMax",
      "Budget looks too large for quick intake. Confirm the amount first.",
    );
  }

  if (preferredAreas.length > 240) {
    appendFieldError(
      fieldErrors,
      "preferredAreas",
      "Preferred areas should stay concise for quick intake.",
    );
  } else if (preferredAreas && normalizedPreferredAreas.length === 0) {
    appendFieldError(
      fieldErrors,
      "preferredAreas",
      "Preferred areas need short place names separated by commas or slashes.",
    );
  }

  if (nextFollowUpAt && !isValidIsoDateOnly(nextFollowUpAt)) {
    appendFieldError(
      fieldErrors,
      "nextFollowUpAt",
      "Next follow-up must be a real calendar date.",
    );
  }

  if (notes.length > 2000) {
    appendFieldError(
      fieldErrors,
      "notes",
      "Notes should stay under 2000 characters for quick capture.",
    );
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationErrorResponse(fieldErrors);
  }

  if (!skipDuplicateCheck) {
    const duplicateMatches = await findFrontOfficeLeadDuplicateMatches({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      fullName,
      email,
      phone,
      timeZone: context.currentUser.timezone,
    });

    if (duplicateMatches.length) {
      return NextResponse.json(
        {
          error:
            "Potential duplicate clients already exist inside your visible Front Office CRM scope. Review the closest record first, then create anyway only if this really needs a separate Front Office dossier.",
          errorCode: "duplicate_lead",
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
      budgetMax: normalizedBudgetMax || "",
      preferredAreas: normalizedPreferredAreas,
      nextFollowUpAt,
      notes,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create the Front Office lead.";

    if (
      /full name|email|phone|budget|date|follow-up|follow up|preferred areas/i.test(
        message,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Lead not created because one or more live form values could not be saved. Review the field details and try again.",
          errorCode: "validation_error",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Front Office could not create the lead right now. Your live form is unchanged, so you can review the values and retry.",
        errorCode: "create_failed",
      },
      { status: 500 },
    );
  }
}
