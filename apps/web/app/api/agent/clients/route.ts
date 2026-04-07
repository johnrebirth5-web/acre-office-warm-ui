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

function readOptionalStringField(
  body: Record<string, unknown>,
  key: LeadFieldKey,
  fieldErrors: LeadFieldErrorMap,
) {
  const value = body[key];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    appendFieldError(
      fieldErrors,
      key,
      "Use plain text for this field so Acre can review it safely.",
    );
    return "";
  }

  return value.trim();
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

function buildDuplicateFieldErrors(input: {
  fullName: string;
  email: string;
  phone: string;
  duplicateMatches: Array<{ matchReasons?: string[] }>;
}) {
  const matchReasons = new Set(
    input.duplicateMatches.flatMap((match) => match.matchReasons ?? []),
  );
  const fieldErrors: LeadFieldErrorMap = {};

  if (input.fullName && matchReasons.has("Same name")) {
    fieldErrors.fullName =
      "A visible record with the same name already exists. Review it before creating another dossier.";
  }

  if (input.email && matchReasons.has("Same email")) {
    fieldErrors.email =
      "This email already appears on a visible Front Office record.";
  }

  if (input.phone && matchReasons.has("Same phone")) {
    fieldErrors.phone =
      "This phone number already appears on a visible Front Office record.";
  }

  return fieldErrors;
}

function inferFieldErrorsFromCreateFailure(message: string) {
  const lowered = message.toLowerCase();
  const fieldErrors: LeadFieldErrorMap = {};

  if (lowered.includes("full name") || lowered.includes("name")) {
    fieldErrors.fullName =
      "Acre could not save the lead name. Review the name and retry.";
  }

  if (lowered.includes("email")) {
    fieldErrors.email =
      "Acre could not save the email value. Review the format and retry.";
  }

  if (lowered.includes("phone")) {
    fieldErrors.phone =
      "Acre could not save the phone value. Review the digits and retry.";
  }

  if (lowered.includes("source")) {
    fieldErrors.source =
      "Acre could not save the source label. Shorten or simplify it, then retry.";
  }

  if (lowered.includes("budget")) {
    fieldErrors.budgetMax =
      "Acre could not save the budget value. Confirm the amount and retry.";
  }

  if (
    lowered.includes("preferred areas") ||
    lowered.includes("preferred area")
  ) {
    fieldErrors.preferredAreas =
      "Acre could not save the preferred areas. Use short place names separated by commas.";
  }

  if (
    lowered.includes("follow-up") ||
    lowered.includes("follow up") ||
    lowered.includes("date")
  ) {
    fieldErrors.nextFollowUpAt =
      "Acre could not save the next follow-up date. Confirm the calendar value and retry.";
  }

  if (lowered.includes("note")) {
    fieldErrors.notes =
      "Acre could not save the note text. Trim it down and retry.";
  }

  return fieldErrors;
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

  const fieldErrors: LeadFieldErrorMap = {};
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

  const fullName = readOptionalStringField(body, "fullName", fieldErrors);
  const email = readOptionalStringField(body, "email", fieldErrors);
  const phone = readOptionalStringField(body, "phone", fieldErrors);
  const source = readOptionalStringField(body, "source", fieldErrors);
  const stage = readOptionalStringField(body, "stage", fieldErrors);
  const intent = readOptionalStringField(body, "intent", fieldErrors);
  const budgetMax = readOptionalStringField(body, "budgetMax", fieldErrors);
  const preferredAreas = readOptionalStringField(
    body,
    "preferredAreas",
    fieldErrors,
  );
  const nextFollowUpAt = readOptionalStringField(
    body,
    "nextFollowUpAt",
    fieldErrors,
  );
  const notes = readOptionalStringField(body, "notes", fieldErrors);
  const skipDuplicateCheck = readBoolean(body, "skipDuplicateCheck");
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
    try {
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
            fieldErrors: buildDuplicateFieldErrors({
              fullName,
              email,
              phone,
              duplicateMatches,
            }),
            duplicateMatches,
          },
          { status: 409 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "Acre could not verify duplicate risk right now, so it stopped before creating anything. Your live form is unchanged.",
          errorCode: "duplicate_check_failed",
        },
        { status: 500 },
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
    const inferredFieldErrors = inferFieldErrorsFromCreateFailure(message);

    if (Object.keys(inferredFieldErrors).length > 0) {
      return NextResponse.json(
        {
          error:
            "Lead not created because one or more live form values could not be saved. Review the field details and try again.",
          errorCode: "validation_error",
          fieldErrors: inferredFieldErrors,
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
