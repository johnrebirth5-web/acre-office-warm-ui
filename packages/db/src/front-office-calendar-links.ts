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
  if (!input.listingTitle?.trim()) {
    return "";
  }

  const area = [input.listingNeighborhood?.trim(), input.listingCity?.trim()]
    .filter(Boolean)
    .join(", ");

  return area ? `${input.listingTitle.trim()} · ${area}` : input.listingTitle.trim();
}

function buildCalendarDescription(input: AppointmentExternalLinkInput) {
  const clientOrContact = input.clientName?.trim() || input.contactLabel?.trim() || "";
  const lines = [
    "Manual export from Acre Front Office.",
    "Acre remains the source of truth for appointment status and writeback. No provider sync is implied by this draft.",
    input.appointmentTypeLabel?.trim()
      ? `Appointment type: ${input.appointmentTypeLabel.trim()}`
      : "",
    input.appointmentStatusLabel?.trim()
      ? `Acre status: ${input.appointmentStatusLabel.trim()}`
      : "",
    clientOrContact ? `Client / contact: ${clientOrContact}` : "",
    input.clientEmail?.trim() ? `Client email: ${input.clientEmail.trim()}` : "",
    buildListingLabel(input) ? `Listing: ${buildListingLabel(input)}` : "",
    input.location?.trim() ? `Location: ${input.location.trim()}` : "",
    input.meetingUrl?.trim() ? `Meeting link: ${input.meetingUrl.trim()}` : "",
    input.externalStatusLabel?.trim()
      ? `External coordination: ${input.externalStatusLabel.trim()}`
      : "",
    input.externalNextActionAtLabel?.trim()
      ? `Next external touch: ${input.externalNextActionAtLabel.trim()}`
      : "",
    input.externalNote?.trim()
      ? `Writeback note: ${input.externalNote.trim()}`
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
  const to = input.clientEmail?.trim();

  if (!to) {
    return null;
  }

  const appointmentTimeLabel = formatDateTimeLabel(input.startsAt, {
    timeZone: input.timeZone ?? null,
  });
  const firstName = getFirstName(input.clientName);
  const listingLabel = buildListingLabel(input);
  const isRescheduleRequest =
    input.externalStatusLabel?.trim() === "Reschedule requested";
  const isConfirmed = input.externalStatusLabel?.trim() === "Confirmed";
  const subject = isRescheduleRequest
    ? `Reschedule request: ${input.title}`
    : isConfirmed
      ? `Confirmed: ${input.title} on ${appointmentTimeLabel}`
      : `Please confirm: ${input.title} on ${appointmentTimeLabel}`;
  const lines = [
    `Hi ${firstName},`,
    "",
    isRescheduleRequest
      ? `It looks like we may need to move our ${input.title}.`
      : isConfirmed
        ? `Sharing the details for our confirmed ${input.title}.`
        : `I am sending the details for our ${input.title}. Please reply to confirm this time still works for you.`,
    `Date & time: ${appointmentTimeLabel}`,
    input.location?.trim() ? `Location: ${input.location.trim()}` : "",
    input.meetingUrl?.trim() ? `Meeting link: ${input.meetingUrl.trim()}` : "",
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
  const location = input.location?.trim() || input.meetingUrl?.trim() || "";
  const details = buildCalendarDescription(input);
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${formatCalendarTimestamp(input.startsAt)}/${formatCalendarTimestamp(endsAt)}`,
    details,
    location,
  });
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
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
  const description = buildCalendarDescription(input);
  const location = input.location?.trim() || input.meetingUrl?.trim() || "";
  const fileName = `${sanitizeFileStem(input.title)}-${input.startsAt.toISOString().slice(0, 10)}.ics`;
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
    `SUMMARY:${escapeIcsValue(input.title)}`,
    description ? `DESCRIPTION:${escapeIcsValue(description)}` : "",
    location ? `LOCATION:${escapeIcsValue(location)}` : "",
    input.meetingUrl?.trim() ? `URL:${escapeIcsValue(input.meetingUrl.trim())}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter(Boolean);

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}
