import {
  ClientFollowUpReminderMode,
  ClientFollowUpStatus,
  Prisma,
} from "@prisma/client";

export type FrontOfficeFollowUpTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export const frontOfficeClientFollowUpStatuses = [
  ClientFollowUpStatus.new_lead,
  ClientFollowUpStatus.active_follow_up,
  ClientFollowUpStatus.waiting_reply,
  ClientFollowUpStatus.appointment_booked,
  ClientFollowUpStatus.paused,
] as const;

export const frontOfficeClientFollowUpReminderModes = [
  ClientFollowUpReminderMode.auto,
  ClientFollowUpReminderMode.manual,
] as const;

const wechatDisplayNameFieldKey = "wechatDisplayName";

export function normalizeClientAdditionalFields(
  value:
    | Prisma.JsonValue
    | Record<string, string>
    | null
    | undefined,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Prisma.JsonValue>).map(
      ([key, currentValue]) => [key, String(currentValue ?? "").trim()],
    ),
  );
}

export function getWechatDisplayName(
  value:
    | Prisma.JsonValue
    | Record<string, string>
    | null
    | undefined,
) {
  return (
    normalizeClientAdditionalFields(value)[wechatDisplayNameFieldKey]?.trim() ||
    ""
  );
}

export function setWechatDisplayName(
  value:
    | Prisma.JsonValue
    | Record<string, string>
    | null
    | undefined,
  wechatDisplayName: string | null | undefined,
) {
  const nextFields = normalizeClientAdditionalFields(value);
  const normalizedWechatDisplayName = wechatDisplayName?.trim() || "";

  if (!normalizedWechatDisplayName) {
    delete nextFields[wechatDisplayNameFieldKey];
    return nextFields;
  }

  nextFields[wechatDisplayNameFieldKey] = normalizedWechatDisplayName;
  return nextFields;
}

export function getClientDisplayName(input: {
  fullName: string;
  additionalFields?: Prisma.JsonValue | Record<string, string> | null;
}) {
  const wechatDisplayName = getWechatDisplayName(input.additionalFields);

  return wechatDisplayName || input.fullName.trim();
}

export function inferClientFollowUpStatus(input: {
  stage?: string | null;
  lastContactAt?: Date | null;
}) {
  const normalizedStage = input.stage?.trim().toLowerCase() || "";

  if (
    normalizedStage.includes("viewing") ||
    normalizedStage.includes("showing") ||
    normalizedStage.includes("tour")
  ) {
    return ClientFollowUpStatus.appointment_booked;
  }

  if (normalizedStage.includes("pending")) {
    return ClientFollowUpStatus.waiting_reply;
  }

  if (
    normalizedStage.includes("won") ||
    normalizedStage.includes("lost")
  ) {
    return ClientFollowUpStatus.paused;
  }

  return input.lastContactAt
    ? ClientFollowUpStatus.active_follow_up
    : ClientFollowUpStatus.new_lead;
}

export function normalizeClientFollowUpStatus(
  value: string | null | undefined,
  fallback: ClientFollowUpStatus = ClientFollowUpStatus.new_lead,
) {
  switch (value) {
    case ClientFollowUpStatus.new_lead:
    case ClientFollowUpStatus.active_follow_up:
    case ClientFollowUpStatus.waiting_reply:
    case ClientFollowUpStatus.appointment_booked:
    case ClientFollowUpStatus.paused:
      return value;
    default:
      return fallback;
  }
}

export function normalizeClientFollowUpReminderMode(
  value: string | null | undefined,
  fallback: ClientFollowUpReminderMode = ClientFollowUpReminderMode.auto,
) {
  switch (value) {
    case ClientFollowUpReminderMode.auto:
    case ClientFollowUpReminderMode.manual:
      return value;
    default:
      return fallback;
  }
}

function toDateOnlyUtc(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addDateOnlyUtcDays(value: Date, days: number) {
  const nextValue = toDateOnlyUtc(value);
  nextValue.setUTCDate(nextValue.getUTCDate() + days);
  return nextValue;
}

export function resolveAutomaticNextFollowUpAt(input: {
  followUpStatus: ClientFollowUpStatus;
  now: Date;
  upcomingAppointmentStartsAt?: Date | null;
}) {
  switch (input.followUpStatus) {
    case ClientFollowUpStatus.new_lead:
      return addDateOnlyUtcDays(input.now, 1);
    case ClientFollowUpStatus.active_follow_up:
      return addDateOnlyUtcDays(input.now, 2);
    case ClientFollowUpStatus.waiting_reply:
      return addDateOnlyUtcDays(input.now, 3);
    case ClientFollowUpStatus.appointment_booked:
      return input.upcomingAppointmentStartsAt &&
        input.upcomingAppointmentStartsAt.getTime() > input.now.getTime()
        ? toDateOnlyUtc(input.upcomingAppointmentStartsAt)
        : addDateOnlyUtcDays(input.now, 1);
    case ClientFollowUpStatus.paused:
      return null;
  }
}

export function formatFrontOfficeFollowUpStatusLabel(
  value: ClientFollowUpStatus,
) {
  switch (value) {
    case ClientFollowUpStatus.new_lead:
      return "New lead";
    case ClientFollowUpStatus.active_follow_up:
      return "Active follow-up";
    case ClientFollowUpStatus.waiting_reply:
      return "Waiting reply";
    case ClientFollowUpStatus.appointment_booked:
      return "Appointment booked";
    case ClientFollowUpStatus.paused:
      return "Paused";
  }
}

export function mapFrontOfficeFollowUpStatusTone(
  value: ClientFollowUpStatus,
): FrontOfficeFollowUpTone {
  switch (value) {
    case ClientFollowUpStatus.new_lead:
      return "accent";
    case ClientFollowUpStatus.active_follow_up:
      return "warning";
    case ClientFollowUpStatus.waiting_reply:
      return "neutral";
    case ClientFollowUpStatus.appointment_booked:
      return "success";
    case ClientFollowUpStatus.paused:
      return "neutral";
  }
}

export function formatFrontOfficeReminderModeLabel(
  value: ClientFollowUpReminderMode,
) {
  return value === ClientFollowUpReminderMode.manual
    ? "Manual reminder"
    : "Auto reminder";
}

export function formatFrontOfficeDateLabel(
  value: Date | null | undefined,
  _timeZone?: string | null,
  emptyLabel = "Not set",
) {
  if (!value) {
    return emptyLabel;
  }

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatFrontOfficeLastFollowUpLabel(
  value: Date | null | undefined,
  timeZone?: string | null,
) {
  return value
    ? `Followed up ${formatFrontOfficeDateLabel(value, timeZone)}`
    : "Not followed up yet";
}

export function formatFrontOfficeNextReminderLabel(
  value: Date | null | undefined,
  timeZone?: string | null,
) {
  return value
    ? formatFrontOfficeDateLabel(value, timeZone)
    : "No reminder scheduled";
}

export function buildFrontOfficeNoteSummary(
  note: string | null | undefined,
  maxLength = 140,
) {
  const normalized = note?.trim() || "";

  if (!normalized) {
    return "No note yet.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
