import {
  ClientFollowUpReminderMode,
  ClientFollowUpStatus,
} from "@prisma/client";
import { can } from "@acre/auth";
import { updateFrontOfficeClientExecution } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

type RouteDependencies = {
  updateFrontOfficeClientExecution?: typeof updateFrontOfficeClientExecution;
};

type PatchFieldKey =
  | "fullName"
  | "budgetMax"
  | "preferredAreas"
  | "followUpStatus"
  | "followUpReminderMode"
  | "nextFollowUpAt"
  | "notes"
  | "wechatDisplayName";

type PatchFieldErrorMap = Partial<Record<PatchFieldKey, string>>;

const validFollowUpStatuses = new Set<ClientFollowUpStatus>([
  ClientFollowUpStatus.new_lead,
  ClientFollowUpStatus.active_follow_up,
  ClientFollowUpStatus.waiting_reply,
  ClientFollowUpStatus.appointment_booked,
  ClientFollowUpStatus.paused,
]);

const validFollowUpReminderModes = new Set<ClientFollowUpReminderMode>([
  ClientFollowUpReminderMode.auto,
  ClientFollowUpReminderMode.manual,
]);

function appendFieldError(
  fieldErrors: PatchFieldErrorMap,
  field: PatchFieldKey,
  message: string,
) {
  if (!fieldErrors[field]) {
    fieldErrors[field] = message;
  }
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

function parsePreferredAreas(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (typeof value !== "string") {
    return null;
  }

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

function isValidIsoDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "clients:manage")) {
    return NextResponse.json(
      { error: "Client management access required." },
      { status: 403 },
    );
  }

  const { clientId } = await params;
  return handleFrontOfficeClientPatch(request, context, clientId);
}

export async function handleFrontOfficeClientPatch(
  request: Pick<NextRequest, "json">,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  clientId: string,
  dependencies: RouteDependencies = {},
) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || Array.isArray(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const fieldErrors: PatchFieldErrorMap = {};
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : undefined;
  const budgetMaxRaw =
    typeof body.budgetMax === "string" ? body.budgetMax.trim() : undefined;
  const preferredAreas =
    body.preferredAreas !== undefined ? parsePreferredAreas(body.preferredAreas) : undefined;
  const followUpStatus =
    typeof body.followUpStatus === "string"
      ? (body.followUpStatus.trim() as ClientFollowUpStatus)
      : undefined;
  const followUpReminderMode =
    typeof body.followUpReminderMode === "string"
      ? (body.followUpReminderMode.trim() as ClientFollowUpReminderMode)
      : undefined;
  const nextFollowUpAt =
    body.nextFollowUpAt === null
      ? null
      : typeof body.nextFollowUpAt === "string"
        ? body.nextFollowUpAt.trim()
        : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const wechatDisplayName =
    typeof body.wechatDisplayName === "string"
      ? body.wechatDisplayName.trim()
      : undefined;
  const markFollowedUpNow = body.markFollowedUpNow === true;
  const normalizedBudgetMax =
    budgetMaxRaw === undefined
      ? undefined
      : budgetMaxRaw
        ? normalizeBudgetMaxInput(budgetMaxRaw)
        : "";

  if (fullName !== undefined && !fullName) {
    appendFieldError(fieldErrors, "fullName", "Full name cannot be empty.");
  }

  if (normalizedBudgetMax === null) {
    appendFieldError(
      fieldErrors,
      "budgetMax",
      "Budget should be a positive number like 5500 or 5.5k.",
    );
  }

  if (preferredAreas === null) {
    appendFieldError(
      fieldErrors,
      "preferredAreas",
      "Preferred areas should be a short string or a string array.",
    );
  }

  if (followUpStatus && !validFollowUpStatuses.has(followUpStatus)) {
    appendFieldError(
      fieldErrors,
      "followUpStatus",
      "Unsupported follow-up status.",
    );
  }

  if (
    followUpReminderMode &&
    !validFollowUpReminderModes.has(followUpReminderMode)
  ) {
    appendFieldError(
      fieldErrors,
      "followUpReminderMode",
      "Unsupported reminder mode.",
    );
  }

  if (
    typeof nextFollowUpAt === "string" &&
    nextFollowUpAt &&
    !isValidIsoDateOnly(nextFollowUpAt)
  ) {
    appendFieldError(
      fieldErrors,
      "nextFollowUpAt",
      "Next reminder must use YYYY-MM-DD format.",
    );
  }

  if (notes !== undefined && notes.length > 4000) {
    appendFieldError(
      fieldErrors,
      "notes",
      "Note should stay under 4000 characters.",
    );
  }

  if (wechatDisplayName !== undefined && wechatDisplayName.length > 120) {
    appendFieldError(
      fieldErrors,
      "wechatDisplayName",
      "WeChat name should stay under 120 characters.",
    );
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        error: "Fix the highlighted values and try again.",
        errorCode: "validation_error",
        fieldErrors,
      },
      { status: 400 },
    );
  }

  const updateClientExecution =
    dependencies.updateFrontOfficeClientExecution ??
    updateFrontOfficeClientExecution;
  const contact = await updateClientExecution({
    organizationId: context.currentOrganization.id,
    clientId,
    actorMembershipId: context.currentMembership.id,
    actorOfficeId: context.currentOffice?.id ?? null,
    ...(fullName !== undefined ? { fullName } : {}),
    ...(normalizedBudgetMax !== undefined && normalizedBudgetMax !== null
      ? { budgetMax: normalizedBudgetMax }
      : {}),
    ...(preferredAreas !== undefined && preferredAreas !== null
      ? { preferredAreas }
      : {}),
    ...(followUpStatus !== undefined ? { followUpStatus } : {}),
    ...(followUpReminderMode !== undefined ? { followUpReminderMode } : {}),
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(wechatDisplayName !== undefined ? { wechatDisplayName } : {}),
    ...(markFollowedUpNow ? { markFollowedUpNow } : {}),
  });

  if (!contact) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ contact });
}
