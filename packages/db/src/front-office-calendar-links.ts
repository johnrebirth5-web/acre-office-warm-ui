import { formatDateTimeLabel } from "./date-time";

const defaultAppointmentDurationMs = 60 * 60 * 1000;

export const frontOfficeAppointmentBridgeActions = {
  googleCalendar: "google_calendar",
  outlookCalendar: "outlook_calendar",
  icsDownload: "ics_download",
  emailBrief: "email_brief",
} as const;

export type FrontOfficeAppointmentBridgeAction =
  (typeof frontOfficeAppointmentBridgeActions)[keyof typeof frontOfficeAppointmentBridgeActions];

export type FrontOfficeAppointmentExternalLinks = {
  googleCalendarHref: string;
  outlookCalendarHref: string;
  icsHref: string;
  emailBriefHref: string | null;
};

export type FrontOfficeAppointmentExternalTargets = {
  googleCalendarHref: string;
  outlookCalendarHref: string;
  emailBriefHref: string | null;
};

export type FrontOfficeAppointmentCalendarExport = {
  fileName: string;
  content: string;
};

type AppointmentExternalLinkInput = {
  appointmentId: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  meetingUrl?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  contactLabel?: string | null;
  listingTitle?: string | null;
  listingNeighborhood?: string | null;
  listingCity?: string | null;
  appointmentTypeLabel?: string | null;
  appointmentStatusLabel?: string | null;
  externalStatusLabel?: string | null;
  externalNote?: string | null;
  externalNextActionAtLabel?: string | null;
  timeZone?: string | null;
};

const emailAddressPattern =
  /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

function normalizeBridgeText(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isLikelyEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractFirstEmailAddress(value: string | null | undefined) {
  const emailAddress = value?.match(emailAddressPattern)?.[1]?.trim() ?? "";
  return isLikelyEmailAddress(emailAddress) ? emailAddress : "";
}

function stripEmailAddressFromContactLabel(value: string | null | undefined) {
  return normalizeBridgeText(
    (value ?? "")
      .replace(emailAddressPattern, " ")
      .replace(/[<>()[\],;|]+/g, " ")
      .replace(/\s+·\s+/g, " ")
      .replace(/\s+-\s+/g, " "),
  );
}

export function extractFrontOfficeAppointmentEmailRecipient(input: {
  clientEmail?: string | null;
  contactLabel?: string | null;
}) {
  const clientEmail = normalizeBridgeText(input.clientEmail);

  if (clientEmail && isLikelyEmailAddress(clientEmail)) {
    return clientEmail;
  }

  return extractFirstEmailAddress(input.contactLabel) || null;
}

function resolveAppointmentEndAt(startsAt: Date, endsAt?: Date | null) {
  if (endsAt && endsAt.getTime() > startsAt.getTime()) {
    return endsAt;
  }

  return new Date(startsAt.getTime() + defaultAppointmentDurationMs);
}

function formatCalendarTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function sanitizeFileStem(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "appointment";
}

function buildListingLabel(input: AppointmentExternalLinkInput) {
  const listingTitle = normalizeBridgeText(input.listingTitle);

  if (!listingTitle) {
    return "";
  }

  const area = [
    normalizeBridgeText(input.listingNeighborhood),
    normalizeBridgeText(input.listingCity),
  ]
    .filter(Boolean)
    .join(", ");

  return area ? `${listingTitle} · ${area}` : listingTitle;
}

function buildCalendarDescription(input: AppointmentExternalLinkInput) {
  const emailRecipient = extractFrontOfficeAppointmentEmailRecipient({
    clientEmail: input.clientEmail,
    contactLabel: input.contactLabel,
  });
  const clientOrContact =
    normalizeBridgeText(input.clientName) ||
    normalizeBridgeText(input.contactLabel) ||
    "";
  const lines = [
    "Manual export from Acre Front Office.",
    "Acre remains the source of truth for appointment status and writeback. No provider sync is implied by this draft.",
    normalizeBridgeText(input.appointmentTypeLabel)
      ? `Appointment type: ${normalizeBridgeText(input.appointmentTypeLabel)}`
      : "",
    normalizeBridgeText(input.appointmentStatusLabel)
      ? `Acre status: ${normalizeBridgeText(input.appointmentStatusLabel)}`
      : "",
    clientOrContact ? `Client / contact: ${clientOrContact}` : "",
    emailRecipient ? `Email target: ${emailRecipient}` : "",
    buildListingLabel(input) ? `Listing: ${buildListingLabel(input)}` : "",
    normalizeBridgeText(input.location)
      ? `Location: ${normalizeBridgeText(input.location)}`
      : "",
    normalizeBridgeText(input.meetingUrl)
      ? `Meeting link: ${normalizeBridgeText(input.meetingUrl)}`
      : "",
    normalizeBridgeText(input.externalStatusLabel)
      ? `External coordination: ${normalizeBridgeText(input.externalStatusLabel)}`
      : "",
    normalizeBridgeText(input.externalNextActionAtLabel)
      ? `Next external touch: ${normalizeBridgeText(input.externalNextActionAtLabel)}`
      : "",
    normalizeBridgeText(input.externalNote)
      ? `Writeback note: ${normalizeBridgeText(input.externalNote)}`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function getFirstName(value: string | null | undefined) {
  const [firstName] = (value ?? "").trim().split(/\s+/);
  return firstName?.trim() || "there";
}

function buildMailtoHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${to}?${params.toString()}`;
}

function buildBridgeHref(
  appointmentId: string,
  action: FrontOfficeAppointmentBridgeAction,
) {
  const params = new URLSearchParams({
    action,
  });

  return `/api/agent/appointments/${appointmentId}/bridge?${params.toString()}`;
}

export function isFrontOfficeAppointmentBridgeAction(
  value: string | null | undefined,
): value is FrontOfficeAppointmentBridgeAction {
  return Object.values(frontOfficeAppointmentBridgeActions).includes(
    value as FrontOfficeAppointmentBridgeAction,
  );
}

export function formatFrontOfficeAppointmentBridgeActionLabel(
  action: FrontOfficeAppointmentBridgeAction,
) {
  switch (action) {
    case frontOfficeAppointmentBridgeActions.googleCalendar:
      return "Google Calendar";
    case frontOfficeAppointmentBridgeActions.outlookCalendar:
      return "Outlook";
    case frontOfficeAppointmentBridgeActions.icsDownload:
      return "ICS download";
    case frontOfficeAppointmentBridgeActions.emailBrief:
      return "Email brief";
    default:
      return "External bridge";
  }
}

function buildEmailBriefHref(input: AppointmentExternalLinkInput) {
  const to = extractFrontOfficeAppointmentEmailRecipient({
    clientEmail: input.clientEmail,
    contactLabel: input.contactLabel,
  });

  if (!to) {
    return null;
  }

  const appointmentTimeLabel = formatDateTimeLabel(input.startsAt, {
    timeZone: input.timeZone ?? null,
  });
  const appointmentEndLabel = formatDateTimeLabel(
    resolveAppointmentEndAt(input.startsAt, input.endsAt),
    {
      timeZone: input.timeZone ?? null,
    },
  );
  const firstName = getFirstName(
    normalizeBridgeText(input.clientName) ||
      stripEmailAddressFromContactLabel(input.contactLabel),
  );
  const listingLabel = buildListingLabel(input);
  const isRescheduleRequest =
    normalizeBridgeText(input.externalStatusLabel) === "Reschedule requested";
  const isConfirmed =
    normalizeBridgeText(input.externalStatusLabel) === "Confirmed";
  const appointmentTitle = normalizeBridgeText(input.title) || "Appointment";
  const location = normalizeBridgeText(input.location);
  const meetingUrl = normalizeBridgeText(input.meetingUrl);
  const subject = isRescheduleRequest
    ? `Reschedule request: ${appointmentTitle}`
    : isConfirmed
      ? `Confirmed: ${appointmentTitle} on ${appointmentTimeLabel}`
      : `Please confirm: ${appointmentTitle} on ${appointmentTimeLabel}`;
  const lines = [
    `Hi ${firstName},`,
    "",
    isRescheduleRequest
      ? `It looks like we may need to move our ${appointmentTitle}.`
      : isConfirmed
        ? `Sharing the details for our confirmed ${appointmentTitle}.`
        : `I am sending the details for our ${appointmentTitle}. Please reply to confirm this time still works for you.`,
    `Date & time: ${appointmentTimeLabel}`,
    `Expected end: ${appointmentEndLabel}`,
    location ? `Location: ${location}` : "",
    meetingUrl ? `Meeting link: ${meetingUrl}` : "",
    listingLabel ? `Listing context: ${listingLabel}` : "",
    "",
    isRescheduleRequest
      ? "If you need to move it, reply with a few times that work better and I will update the plan."
      : "If anything changes or you need to reschedule, reply here and I will adjust the plan.",
    "",
    "Best,",
    "Acre",
  ].filter(Boolean);

  return buildMailtoHref(to, subject, lines.join("\n"));
}

export function buildFrontOfficeAppointmentExternalTargets(
  input: AppointmentExternalLinkInput,
): FrontOfficeAppointmentExternalTargets {
  const endsAt = resolveAppointmentEndAt(input.startsAt, input.endsAt);
  const title = normalizeBridgeText(input.title) || "Appointment";
  const location =
    normalizeBridgeText(input.location) ||
    normalizeBridgeText(input.meetingUrl) ||
    "";
  const details = buildCalendarDescription(input);
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatCalendarTimestamp(input.startsAt)}/${formatCalendarTimestamp(endsAt)}`,
    details,
    location,
  });
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: input.startsAt.toISOString(),
    enddt: endsAt.toISOString(),
    body: details,
    location,
  });

  return {
    googleCalendarHref: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    outlookCalendarHref: `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
    emailBriefHref: buildEmailBriefHref(input),
  };
}

export function buildFrontOfficeAppointmentExternalLinks(
  input: AppointmentExternalLinkInput,
): FrontOfficeAppointmentExternalLinks {
  const targets = buildFrontOfficeAppointmentExternalTargets(input);

  return {
    googleCalendarHref: buildBridgeHref(
      input.appointmentId,
      frontOfficeAppointmentBridgeActions.googleCalendar,
    ),
    outlookCalendarHref: buildBridgeHref(
      input.appointmentId,
      frontOfficeAppointmentBridgeActions.outlookCalendar,
    ),
    icsHref: buildBridgeHref(
      input.appointmentId,
      frontOfficeAppointmentBridgeActions.icsDownload,
    ),
    emailBriefHref: targets.emailBriefHref
      ? buildBridgeHref(
          input.appointmentId,
          frontOfficeAppointmentBridgeActions.emailBrief,
        )
      : null,
  };
}

export function buildFrontOfficeAppointmentCalendarExport(
  input: AppointmentExternalLinkInput,
): FrontOfficeAppointmentCalendarExport {
  const endsAt = resolveAppointmentEndAt(input.startsAt, input.endsAt);
  const title = normalizeBridgeText(input.title) || "Appointment";
  const description = buildCalendarDescription(input);
  const location =
    normalizeBridgeText(input.location) ||
    normalizeBridgeText(input.meetingUrl) ||
    "";
  const fileName = `${sanitizeFileStem(title)}-${input.startsAt.toISOString().slice(0, 10)}.ics`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Acre//Front Office//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:acre-appointment-${escapeIcsValue(input.appointmentId)}@acresystem.us`,
    `DTSTAMP:${formatCalendarTimestamp(new Date())}`,
    `DTSTART:${formatCalendarTimestamp(input.startsAt)}`,
    `DTEND:${formatCalendarTimestamp(endsAt)}`,
    `SUMMARY:${escapeIcsValue(title)}`,
    description ? `DESCRIPTION:${escapeIcsValue(description)}` : "",
    location ? `LOCATION:${escapeIcsValue(location)}` : "",
    normalizeBridgeText(input.meetingUrl)
      ? `URL:${escapeIcsValue(normalizeBridgeText(input.meetingUrl))}`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean);

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}
