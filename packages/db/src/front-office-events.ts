import {
  EventRecurrenceRule,
  EventType,
  EventVisibility,
  MembershipStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  NotificationType,
  Prisma,
  RsvpStatus,
  UserRole,
} from "@prisma/client";
import { formatDateTimeLabel } from "./date-time";
import {
  getFrontOfficeAppointmentsSnapshot,
  type FrontOfficeAppointmentTone,
} from "./front-office-appointments";
import { upsertNotificationForMemberships } from "./notifications";
import { prisma } from "./client";

export const frontOfficeEventCalendarViews = ["month", "week", "day"] as const;

export type FrontOfficeEventCalendarView =
  (typeof frontOfficeEventCalendarViews)[number];

export type FrontOfficeSharedEventRecord = {
  id: string;
  title: string;
  description: string;
  eventTypeValue: EventType;
  eventTypeLabel: string;
  eventTypeTone: FrontOfficeAppointmentTone;
  visibilityValue: EventVisibility;
  visibilityLabel: string;
  startsAtValue: string;
  startsAtLabel: string;
  endsAtValue: string | null;
  endsAtLabel: string;
  areaLabel: string;
  locationLabel: string;
  locationDisclosure: string;
  isOnline: boolean;
  meetingHref: string | null;
  meetingPassword: string | null;
  meetingDisclosure: string;
  isMandatory: boolean;
  mandatoryLabel: string;
  attendeeLabel: string;
  canRsvp: boolean;
  userRsvpStatus: RsvpStatus | null;
  userRsvpLabel: string;
  isRecurring: boolean;
  recurrenceRuleValue: EventRecurrenceRule | null;
  recurrenceRuleLabel: string;
  seriesId: string | null;
  openHref: string;
  isPast: boolean;
  isWithinMeetingWindow: boolean;
};

export type FrontOfficeSharedEventsSnapshot = {
  view: FrontOfficeEventCalendarView;
  focusDate: string;
  rangeLabel: string;
  canManage: boolean;
  summary: {
    visibleCount: number;
    upcomingCount: number;
    mandatoryCount: number;
  };
  window: {
    startsAtValue: string;
    endsAtValue: string;
  };
  events: FrontOfficeSharedEventRecord[];
  upcoming: FrontOfficeSharedEventRecord[];
  mandatory: FrontOfficeSharedEventRecord[];
  selectedEvent: FrontOfficeSharedEventRecord | null;
};

export type FrontOfficeEventHubAppointmentItem = {
  id: string;
  title: string;
  typeLabel: string;
  typeTone: FrontOfficeAppointmentTone;
  statusLabel: string;
  statusTone: FrontOfficeAppointmentTone;
  startsAtValue: string;
  startsAtLabel: string;
  endsAtValue: string | null;
  endsAtLabel: string;
  locationLabel: string;
  clientLabel: string;
  listingLabel: string;
  href: string;
};

export type FrontOfficeEventHubSnapshot = {
  view: FrontOfficeEventCalendarView;
  focusDate: string;
  rangeLabel: string;
  canManageEvents: boolean;
  summary: {
    appointmentCount: number;
    sharedEventCount: number;
    mandatoryEventCount: number;
    todayCommitmentCount: number;
  };
  appointments: FrontOfficeEventHubAppointmentItem[];
  sharedEvents: FrontOfficeSharedEventsSnapshot;
  appointmentSummary: {
    upcomingCount: number;
    awaitingReplyCount: number;
    confirmationPendingCount: number;
    touchDueCount: number;
  };
};

export type CreateFrontOfficeSharedEventInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  actorRole: UserRole;
  timeZone?: string | null;
  title: string;
  description?: string | null;
  eventType?: string | null;
  visibility?: string | null;
  startsAt: string;
  endsAt?: string | null;
  isOnline?: boolean | null;
  location?: string | null;
  area?: string | null;
  meetingUrl?: string | null;
  meetingPassword?: string | null;
  isMandatory?: boolean | null;
  recurrenceRule?: string | null;
};

export type UpdateFrontOfficeSharedEventInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  actorRole: UserRole;
  timeZone?: string | null;
  eventId: string;
  title?: string | null;
  description?: string | null;
  eventType?: string | null;
  visibility?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isOnline?: boolean | null;
  location?: string | null;
  area?: string | null;
  meetingUrl?: string | null;
  meetingPassword?: string | null;
  isMandatory?: boolean | null;
  recurrenceRule?: string | null;
};

export type RespondToFrontOfficeSharedEventInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  eventId: string;
  status: string;
  timeZone?: string | null;
};

export type CreateFrontOfficeSharedEventResult = {
  createdCount: number;
  eventId: string;
  seriesId: string | null;
};

type FrontOfficeEventRecord = {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  startsAt: Date;
  endsAt: Date | null;
  isOnline: boolean;
  location: string | null;
  area: string | null;
  meetingUrl: string | null;
  meetingPassword: string | null;
  isMandatory: boolean;
  seriesId: string | null;
  recurrenceRule: EventRecurrenceRule | null;
  officeId: string | null;
  rsvps: Array<{
    membershipId: string;
    status: RsvpStatus;
  }>;
  _count: {
    rsvps: number;
  };
};

type FrontOfficeReminderEventRecord = {
  id: string;
  title: string;
  visibility: EventVisibility;
  startsAt: Date;
  endsAt: Date | null;
  isOnline: boolean;
  location: string | null;
  area: string | null;
  meetingUrl: string | null;
  meetingPassword: string | null;
  isMandatory: boolean;
  officeId: string | null;
  rsvps: Array<{
    membershipId: string;
    status: RsvpStatus;
  }>;
};

type EventReminderStage = "24h" | "2h" | "10m";

type EventWindow = {
  startsAt: Date;
  endsAt: Date;
  rangeLabel: string;
};

const frontOfficeEventManageRoles = new Set<UserRole>([
  "owner",
  "office_admin",
]);

const detailedEventRsvpStatuses = new Set<RsvpStatus>(["going", "maybe"]);
const implicitAllOfficeRoles = new Set<UserRole>([
  "owner",
  "office_admin",
  "office_manager",
]);

function isFrontOfficeEventCalendarView(
  value: string | null | undefined,
): value is FrontOfficeEventCalendarView {
  return frontOfficeEventCalendarViews.includes(
    value as FrontOfficeEventCalendarView,
  );
}

export function resolveFrontOfficeEventCalendarView(
  value: string | null | undefined,
) {
  return isFrontOfficeEventCalendarView(value) ? value : "month";
}

function isFrontOfficeEventManageRole(role: UserRole) {
  return frontOfficeEventManageRoles.has(role);
}

function resolveEventType(value: string | null | undefined) {
  switch (value?.trim()) {
    case "training":
      return EventType.training;
    case "admin":
      return EventType.admin;
    default:
      return EventType.activity;
  }
}

function resolveEventVisibility(value: string | null | undefined) {
  switch (value?.trim()) {
    case "office_only":
      return EventVisibility.office_only;
    case "invite_only":
      return EventVisibility.invite_only;
    default:
      return EventVisibility.all_agents;
  }
}

function resolveEventRecurrenceRule(value: string | null | undefined) {
  switch (value?.trim()) {
    case "weekly_thursday":
      return EventRecurrenceRule.weekly_thursday;
    case "monthly_first_friday":
      return EventRecurrenceRule.monthly_first_friday;
    default:
      return null;
  }
}

function resolveRsvpStatus(value: string | null | undefined) {
  switch (value?.trim()) {
    case "maybe":
      return RsvpStatus.maybe;
    case "declined":
      return RsvpStatus.declined;
    default:
      return value?.trim() === "going" ? RsvpStatus.going : null;
  }
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeOptionalHttpUrlInput(
  value: string | null | undefined,
  fieldLabel: string,
) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
    ? normalized
    : /^[^\s/]+\.[^\s]+(?:\/.*)?$/i.test(normalized)
      ? `https://${normalized}`
      : normalized;

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return parsed.toString();
  } catch {
    throw new Error(`${fieldLabel} must be a valid http(s) URL.`);
  }
}

function parseRequiredDateTimeInput(value: string, fieldLabel: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldLabel} is required.`);
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return parsed;
}

function parseOptionalDateTimeInput(
  value: string | null | undefined,
  fieldLabel: string,
) {
  if (!value?.trim()) {
    return null;
  }

  return parseRequiredDateTimeInput(value, fieldLabel);
}

function formatEventTypeLabel(eventType: EventType) {
  switch (eventType) {
    case EventType.training:
      return "Training";
    case EventType.admin:
      return "Admin";
    default:
      return "Activity";
  }
}

function mapEventTypeTone(eventType: EventType): FrontOfficeAppointmentTone {
  switch (eventType) {
    case EventType.training:
      return "accent";
    case EventType.admin:
      return "warning";
    default:
      return "neutral";
  }
}

function formatEventVisibilityLabel(visibility: EventVisibility) {
  switch (visibility) {
    case EventVisibility.office_only:
      return "Office only";
    case EventVisibility.invite_only:
      return "Invite only";
    default:
      return "All agents";
  }
}

function formatEventRecurrenceLabel(
  recurrenceRule: EventRecurrenceRule | null | undefined,
) {
  if (recurrenceRule === EventRecurrenceRule.weekly_thursday) {
    return "Every Thursday";
  }

  if (recurrenceRule === EventRecurrenceRule.monthly_first_friday) {
    return "First Friday";
  }

  return "One-time";
}

function formatEventRsvpLabel(status: RsvpStatus | null) {
  switch (status) {
    case RsvpStatus.going:
      return "You’re going";
    case RsvpStatus.maybe:
      return "You’re tentative";
    case RsvpStatus.declined:
      return "You declined";
    default:
      return "No RSVP yet";
  }
}

function toIsoDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildDayLabel(value: Date, timeZone?: string | null) {
  return value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  });
}

function buildRangeLabel(input: {
  view: FrontOfficeEventCalendarView;
  startsAt: Date;
  endsAt: Date;
  timeZone?: string | null;
}) {
  if (input.view === "day") {
    return buildDayLabel(input.startsAt, input.timeZone);
  }

  if (input.view === "week") {
    const startLabel = input.startsAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: input.timeZone ?? undefined,
    });
    const endLabel = input.endsAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: input.timeZone ?? undefined,
    });

    return `${startLabel} - ${endLabel}`;
  }

  return input.startsAt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: input.timeZone ?? undefined,
  });
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function startOfWeek(value: Date) {
  const day = value.getDay();
  return startOfDay(new Date(value.getFullYear(), value.getMonth(), value.getDate() - day));
}

function endOfWeek(value: Date) {
  const start = startOfWeek(value);
  return endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
}

function startOfMonthGrid(value: Date) {
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  return startOfWeek(monthStart);
}

function endOfMonthGrid(value: Date) {
  const monthEnd = new Date(value.getFullYear(), value.getMonth() + 1, 0);
  return endOfWeek(monthEnd);
}

function resolveEventWindow(input: {
  focusDate: Date;
  view: FrontOfficeEventCalendarView;
  timeZone?: string | null;
}): EventWindow {
  if (input.view === "day") {
    const startsAt = startOfDay(input.focusDate);
    const endsAt = endOfDay(input.focusDate);

    return {
      startsAt,
      endsAt,
      rangeLabel: buildRangeLabel({
        view: input.view,
        startsAt,
        endsAt,
        timeZone: input.timeZone,
      }),
    };
  }

  if (input.view === "week") {
    const startsAt = startOfWeek(input.focusDate);
    const endsAt = endOfWeek(input.focusDate);

    return {
      startsAt,
      endsAt,
      rangeLabel: buildRangeLabel({
        view: input.view,
        startsAt,
        endsAt,
        timeZone: input.timeZone,
      }),
    };
  }

  const startsAt = startOfMonthGrid(input.focusDate);
  const endsAt = endOfMonthGrid(input.focusDate);

  return {
    startsAt,
    endsAt,
    rangeLabel: buildRangeLabel({
      view: input.view,
      startsAt: new Date(input.focusDate.getFullYear(), input.focusDate.getMonth(), 1),
      endsAt,
      timeZone: input.timeZone,
    }),
  };
}

function resolveFocusDate(value: string | null | undefined) {
  if (!value?.trim()) {
    return startOfDay(new Date());
  }

  const parsed = new Date(`${value.trim()}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return startOfDay(new Date());
  }

  return startOfDay(parsed);
}

function buildEventOpenHref(eventId: string, startsAt: Date) {
  return `/agent/calendar?calendarView=month&focusDate=${encodeURIComponent(
    toIsoDateValue(startsAt),
  )}&eventId=${encodeURIComponent(eventId)}`;
}

function resolveEventEndAt(event: Pick<FrontOfficeEventRecord, "endsAt" | "startsAt">) {
  if (event.endsAt) {
    return event.endsAt;
  }

  return new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
}

function hasDetailedEventAccess(input: {
  isMandatory: boolean;
  userRsvpStatus: RsvpStatus | null;
}) {
  return (
    input.isMandatory ||
    detailedEventRsvpStatuses.has(input.userRsvpStatus ?? RsvpStatus.declined)
  );
}

function mapSharedEventRecord(input: {
  event: FrontOfficeEventRecord;
  now: Date;
  timeZone?: string | null;
}): FrontOfficeSharedEventRecord {
  const { event, now } = input;
  const userRsvpStatus = event.rsvps[0]?.status ?? null;
  const detailedAccess = hasDetailedEventAccess({
    isMandatory: event.isMandatory,
    userRsvpStatus,
  });
  const preciseLocation = normalizeText(event.location);
  const areaLabel = normalizeText(event.area) ?? "Area pending";
  const eventEndsAt = resolveEventEndAt(event);
  const isPast = eventEndsAt.getTime() < now.getTime();
  const isWithinMeetingWindow =
    now.getTime() >= event.startsAt.getTime() - 10 * 60 * 1000 &&
    !isPast;
  const canRevealMeeting =
    Boolean(event.meetingUrl?.trim()) &&
    detailedAccess &&
    isWithinMeetingWindow;
  const locationLabel =
    preciseLocation && detailedAccess ? preciseLocation : areaLabel;
  let locationDisclosure = "";

  if (preciseLocation && !detailedAccess) {
    locationDisclosure = event.isMandatory
      ? "Mandatory events reveal the full location closer to start."
      : "RSVP going or maybe to reveal the exact location.";
  }

  let meetingDisclosure = "";

  if (isPast) {
    meetingDisclosure = "This event has ended.";
  } else if (event.isOnline && !detailedAccess) {
    meetingDisclosure = "RSVP going or maybe to unlock the meeting room.";
  } else if (event.isOnline && !isWithinMeetingWindow) {
    meetingDisclosure = "Meeting room unlocks 10 minutes before start.";
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventTypeValue: event.eventType,
    eventTypeLabel: formatEventTypeLabel(event.eventType),
    eventTypeTone: mapEventTypeTone(event.eventType),
    visibilityValue: event.visibility,
    visibilityLabel: formatEventVisibilityLabel(event.visibility),
    startsAtValue: event.startsAt.toISOString(),
    startsAtLabel: formatDateTimeLabel(event.startsAt, {
      timeZone: input.timeZone,
    }),
    endsAtValue: event.endsAt?.toISOString() ?? null,
    endsAtLabel: formatDateTimeLabel(event.endsAt, {
      timeZone: input.timeZone,
      emptyLabel: "Open-ended",
    }),
    areaLabel,
    locationLabel,
    locationDisclosure,
    isOnline: event.isOnline,
    meetingHref: canRevealMeeting ? normalizeText(event.meetingUrl) : null,
    meetingPassword:
      canRevealMeeting && normalizeText(event.meetingPassword)
        ? normalizeText(event.meetingPassword)
        : null,
    meetingDisclosure,
    isMandatory: event.isMandatory,
    mandatoryLabel: event.isMandatory ? "Mandatory" : "Optional",
    attendeeLabel:
      event._count.rsvps === 1 ? "1 RSVP" : `${event._count.rsvps} RSVPs`,
    canRsvp: !event.isMandatory && !isPast,
    userRsvpStatus,
    userRsvpLabel: formatEventRsvpLabel(userRsvpStatus),
    isRecurring: Boolean(event.seriesId || event.recurrenceRule),
    recurrenceRuleValue: event.recurrenceRule,
    recurrenceRuleLabel: formatEventRecurrenceLabel(event.recurrenceRule),
    seriesId: event.seriesId,
    openHref: buildEventOpenHref(event.id, event.startsAt),
    isPast,
    isWithinMeetingWindow,
  };
}

function dedupeEventsBySeries(events: FrontOfficeSharedEventRecord[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = event.seriesId?.trim() || event.id;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildVisibleEventWhere(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  eventId?: string | null;
}): Prisma.EventWhereInput {
  return {
    organizationId: input.organizationId,
    ...(input.eventId?.trim()
      ? { id: input.eventId.trim() }
      : input.startsAt && input.endsAt
        ? {
            startsAt: {
              gte: input.startsAt,
              lte: input.endsAt,
            },
          }
        : {}),
    AND: [
      {
        OR: [
          {
            visibility: EventVisibility.all_agents,
          },
          ...(input.officeId
            ? [
                {
                  visibility: EventVisibility.office_only,
                  officeId: input.officeId,
                } satisfies Prisma.EventWhereInput,
              ]
            : []),
          {
            visibility: EventVisibility.invite_only,
            rsvps: {
              some: {
                membershipId: input.viewerMembershipId,
              },
            },
          },
        ],
      },
    ],
  };
}

function getSharedEventSelect(viewerMembershipId: string) {
  return {
    id: true,
    title: true,
    description: true,
    eventType: true,
    visibility: true,
    startsAt: true,
    endsAt: true,
    isOnline: true,
    location: true,
    area: true,
    meetingUrl: true,
    meetingPassword: true,
    isMandatory: true,
    seriesId: true,
    recurrenceRule: true,
    officeId: true,
    rsvps: {
      where: {
        OR: [
          {
            membershipId: viewerMembershipId,
          },
        ],
      },
      select: {
        membershipId: true,
        status: true,
      },
      orderBy: [
        {
          respondedAt: "desc",
        },
      ],
      take: 1,
    },
    _count: {
      select: {
        rsvps: true,
      },
    },
  } satisfies Prisma.EventSelect;
}

function getReminderEventSelect() {
  return {
    id: true,
    title: true,
    visibility: true,
    startsAt: true,
    endsAt: true,
    isOnline: true,
    location: true,
    area: true,
    meetingUrl: true,
    meetingPassword: true,
    isMandatory: true,
    officeId: true,
    rsvps: {
      select: {
        membershipId: true,
        status: true,
      },
    },
  } satisfies Prisma.EventSelect;
}

function resolveEventReminderStage(
  event: Pick<
    FrontOfficeEventRecord,
    "startsAt" | "endsAt" | "isOnline"
  >,
  now: Date,
): EventReminderStage | null {
  const eventEndsAt = resolveEventEndAt(event);

  if (eventEndsAt.getTime() < now.getTime()) {
    return null;
  }

  const timeUntilStart = event.startsAt.getTime() - now.getTime();

  if (timeUntilStart < 0) {
    return event.isOnline ? "10m" : "2h";
  }

  if (event.isOnline && timeUntilStart <= 10 * 60 * 1000) {
    return "10m";
  }

  if (!event.isOnline && timeUntilStart <= 2 * 60 * 60 * 1000) {
    return "2h";
  }

  if (timeUntilStart <= 24 * 60 * 60 * 1000) {
    return "24h";
  }

  return null;
}

function buildEventReminderContent(input: {
  event: Pick<
    FrontOfficeReminderEventRecord,
    "id" | "title" | "startsAt" | "isOnline" | "meetingUrl" | "meetingPassword" | "location" | "area"
  >;
  stage: EventReminderStage;
  timeZone?: string | null;
}) {
  const startsAtLabel = formatDateTimeLabel(input.event.startsAt, {
    timeZone: input.timeZone,
  });
  const area = normalizeText(input.event.area);
  const location = normalizeText(input.event.location);
  const meetingUrl = normalizeText(input.event.meetingUrl);
  const meetingPassword = normalizeText(input.event.meetingPassword);

  if (input.stage === "10m") {
    return {
      severity: NotificationSeverity.warning,
      title: `Starting soon · ${input.event.title}`,
      body: [
        `${input.event.title} starts at ${startsAtLabel}.`,
        meetingUrl ? `Join room: ${meetingUrl}` : "",
        meetingPassword ? `Passcode: ${meetingPassword}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (input.stage === "2h") {
    return {
      severity: NotificationSeverity.warning,
      title: `Today · ${input.event.title}`,
      body: [
        `${input.event.title} starts at ${startsAtLabel}.`,
        location ? `Location: ${location}.` : area ? `Area: ${area}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    severity: NotificationSeverity.info,
    title: `Upcoming · ${input.event.title}`,
    body: `${input.event.title} is coming up on ${startsAtLabel}.`,
  };
}

async function listVisibleMembershipIdsForEvent(input: {
  organizationId: string;
  officeId?: string | null;
  visibility: EventVisibility;
  eventId: string;
}) {
  if (input.visibility === EventVisibility.invite_only) {
    const rsvps = await prisma.eventRsvp.findMany({
      where: {
        eventId: input.eventId,
      },
      select: {
        membershipId: true,
      },
    });

    return [...new Set(rsvps.map((row) => row.membershipId))];
  }

  if (input.visibility === EventVisibility.office_only && input.officeId) {
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: input.organizationId,
        status: MembershipStatus.active,
        OR: [
          {
            role: {
              in: [...implicitAllOfficeRoles],
            },
          },
          {
            officeId: input.officeId,
          },
          {
            officeAccesses: {
              some: {
                officeId: input.officeId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return memberships.map((membership) => membership.id);
  }

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: MembershipStatus.active,
    },
    select: {
      id: true,
    },
  });

  return memberships.map((membership) => membership.id);
}

async function reconcileFrontOfficeEventNotifications(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
}) {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const visibleReminderEvents = await prisma.event.findMany({
    where: buildVisibleEventWhere({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      startsAt: now,
      endsAt: twentyFourHoursFromNow,
    }),
    select: getReminderEventSelect(),
  });

  for (const rawEvent of visibleReminderEvents) {
    const event = rawEvent as FrontOfficeReminderEventRecord;
    const stage = resolveEventReminderStage(event, now);

    if (!stage) {
      continue;
    }

    const visibleMembershipIds = await listVisibleMembershipIdsForEvent({
      organizationId: input.organizationId,
      officeId: event.officeId,
      visibility: event.visibility,
      eventId: event.id,
    });

    if (visibleMembershipIds.length === 0) {
      continue;
    }

    const detailedMembershipIds = event.isMandatory
      ? visibleMembershipIds
      : event.rsvps
          .filter((rsvp) => detailedEventRsvpStatuses.has(rsvp.status))
          .map((rsvp) => rsvp.membershipId);
    const recipientIds =
      stage === "24h"
        ? visibleMembershipIds
        : visibleMembershipIds.filter((membershipId) =>
            detailedMembershipIds.includes(membershipId),
          );

    if (recipientIds.length === 0) {
      continue;
    }

    const reminder = buildEventReminderContent({
      event,
      stage,
      timeZone: input.timeZone,
    });

    await upsertNotificationForMemberships(prisma, {
      organizationId: input.organizationId,
      officeId: event.officeId ?? null,
      membershipIds: recipientIds,
      type: NotificationType.event,
      category: NotificationCategory.event,
      severity: reminder.severity,
      entityType: NotificationEntityType.event,
      entityId: event.id,
      eventId: event.id,
      title: reminder.title,
      body: reminder.body,
      actionUrl: buildEventOpenHref(event.id, event.startsAt),
      metadata: {
        frontOfficeEventReminder: true,
        eventReminderStage: stage,
        eventId: event.id,
      },
      resetReadState: false,
    });
  }
}

function buildMonthDelta(date: Date, monthOffset: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + monthOffset,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function buildFirstFridayOfMonth(date: Date) {
  const firstOfMonth = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  const firstDay = firstOfMonth.getDay();
  const offsetToFriday = (5 - firstDay + 7) % 7;

  return new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth(),
    1 + offsetToFriday,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function buildRecurringStarts(input: {
  startsAt: Date;
  recurrenceRule: EventRecurrenceRule | null;
}) {
  if (!input.recurrenceRule) {
    return [input.startsAt];
  }

  const starts = [input.startsAt];
  const horizonEndsAt = buildMonthDelta(input.startsAt, 6);
  let cursor = input.startsAt;

  while (true) {
    const nextStart =
      input.recurrenceRule === EventRecurrenceRule.weekly_thursday
        ? new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
        : buildFirstFridayOfMonth(buildMonthDelta(cursor, 1));

    if (nextStart.getTime() > horizonEndsAt.getTime()) {
      break;
    }

    starts.push(nextStart);
    cursor = nextStart;
  }

  return starts;
}

async function getVisibleSharedEventRecord(input: {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  eventId: string;
  timeZone?: string | null;
}) {
  const rawEvent = await prisma.event.findFirst({
    where: buildVisibleEventWhere({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      eventId: input.eventId,
    }),
    select: getSharedEventSelect(input.viewerMembershipId),
  });

  if (!rawEvent) {
    return null;
  }

  return mapSharedEventRecord({
    event: rawEvent as FrontOfficeEventRecord,
    now: new Date(),
    timeZone: input.timeZone,
  });
}

export async function getFrontOfficeSharedEventsSnapshot(input: {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
  timeZone?: string | null;
  view?: FrontOfficeEventCalendarView | null;
  focusDate?: string | null;
  targetEventId?: string | null;
}): Promise<FrontOfficeSharedEventsSnapshot> {
  await reconcileFrontOfficeEventNotifications({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    timeZone: input.timeZone,
  });

  const now = new Date();
  const focusDate = resolveFocusDate(input.focusDate);
  const view = input.view ?? "month";
  const window = resolveEventWindow({
    focusDate,
    view,
    timeZone: input.timeZone,
  });
  const upcomingEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [windowEvents, upcomingEvents, selectedEvent] = await Promise.all([
    prisma.event.findMany({
      where: buildVisibleEventWhere({
        organizationId: input.organizationId,
        viewerMembershipId: input.viewerMembershipId,
        officeId: input.officeId ?? null,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      }),
      orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
      select: getSharedEventSelect(input.viewerMembershipId),
    }),
    prisma.event.findMany({
      where: buildVisibleEventWhere({
        organizationId: input.organizationId,
        viewerMembershipId: input.viewerMembershipId,
        officeId: input.officeId ?? null,
        startsAt: now,
        endsAt: upcomingEndsAt,
      }),
      orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
      take: 24,
      select: getSharedEventSelect(input.viewerMembershipId),
    }),
    input.targetEventId?.trim()
      ? getVisibleSharedEventRecord({
          organizationId: input.organizationId,
          viewerMembershipId: input.viewerMembershipId,
          officeId: input.officeId ?? null,
          eventId: input.targetEventId.trim(),
          timeZone: input.timeZone,
        })
      : Promise.resolve(null),
  ]);
  const mappedWindowEvents = windowEvents.map((event) =>
    mapSharedEventRecord({
      event: event as FrontOfficeEventRecord,
      now,
      timeZone: input.timeZone,
    }),
  );
  const mappedUpcomingEvents = dedupeEventsBySeries(
    upcomingEvents.map((event) =>
      mapSharedEventRecord({
        event: event as FrontOfficeEventRecord,
        now,
        timeZone: input.timeZone,
      }),
    ),
  );
  const mandatory = mappedUpcomingEvents.filter((event) => event.isMandatory);

  return {
    view,
    focusDate: toIsoDateValue(focusDate),
    rangeLabel: window.rangeLabel,
    canManage: isFrontOfficeEventManageRole(input.viewerRole),
    summary: {
      visibleCount: mappedWindowEvents.length,
      upcomingCount: mappedUpcomingEvents.length,
      mandatoryCount: mandatory.length,
    },
    window: {
      startsAtValue: window.startsAt.toISOString(),
      endsAtValue: window.endsAt.toISOString(),
    },
    events: mappedWindowEvents,
    upcoming: mappedUpcomingEvents,
    mandatory,
    selectedEvent:
      selectedEvent &&
      !mappedWindowEvents.some((event) => event.id === selectedEvent.id)
        ? selectedEvent
        : mappedWindowEvents.find((event) => event.id === selectedEvent?.id) ??
          selectedEvent,
  };
}

export async function getFrontOfficeEventHubSnapshot(input: {
  organizationId: string;
  viewerMembershipId: string;
  viewerRole: UserRole;
  officeId?: string | null;
  timeZone?: string | null;
  view?: FrontOfficeEventCalendarView | null;
  focusDate?: string | null;
  targetEventId?: string | null;
}) {
  const resolvedView = input.view ?? "month";
  const focusDate = resolveFocusDate(input.focusDate);
  const window = resolveEventWindow({
    focusDate,
    view: resolvedView,
    timeZone: input.timeZone,
  });
  const [appointmentsSnapshot, sharedEvents] = await Promise.all([
    getFrontOfficeAppointmentsSnapshot({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      officeId: input.officeId ?? null,
      timeZone: input.timeZone,
      windowStartAt: window.startsAt,
      windowEndAt: window.endsAt,
    }),
    getFrontOfficeSharedEventsSnapshot({
      organizationId: input.organizationId,
      viewerMembershipId: input.viewerMembershipId,
      viewerRole: input.viewerRole,
      officeId: input.officeId ?? null,
      timeZone: input.timeZone,
      view: resolvedView,
      focusDate: toIsoDateValue(focusDate),
      targetEventId: input.targetEventId ?? null,
    }),
  ]);
  const appointments = appointmentsSnapshot.appointments.map((appointment) => ({
    id: appointment.id,
    title: appointment.title,
    typeLabel: appointment.typeLabel,
    typeTone: appointment.typeTone,
    statusLabel: appointment.statusLabel,
    statusTone: appointment.statusTone,
    startsAtValue: appointment.startsAtValue,
    startsAtLabel: appointment.startsAtLabel,
    endsAtValue: null,
    endsAtLabel: appointment.endsAtLabel,
    locationLabel: appointment.locationLabel,
    clientLabel: appointment.clientLabel,
    listingLabel: appointment.listingLabel,
    href: appointment.clientId
      ? `/agent/calendar?clientId=${encodeURIComponent(
          appointment.clientId,
        )}&appointmentId=${encodeURIComponent(appointment.id)}`
      : `/agent/calendar?appointmentId=${encodeURIComponent(appointment.id)}`,
  }));
  const todayIso = toIsoDateValue(new Date());
  const todayCommitmentCount =
    appointments.filter(
      (appointment) => appointment.startsAtValue.slice(0, 10) === todayIso,
    ).length +
    sharedEvents.events.filter((event) => event.startsAtValue.slice(0, 10) === todayIso)
      .length;

  return {
    view: resolvedView,
    focusDate: toIsoDateValue(focusDate),
    rangeLabel: sharedEvents.rangeLabel,
    canManageEvents: sharedEvents.canManage,
    summary: {
      appointmentCount: appointments.length,
      sharedEventCount: sharedEvents.summary.visibleCount,
      mandatoryEventCount: sharedEvents.summary.mandatoryCount,
      todayCommitmentCount,
    },
    appointments,
    sharedEvents,
    appointmentSummary: {
      upcomingCount: appointmentsSnapshot.summary.upcomingCount,
      awaitingReplyCount: appointmentsSnapshot.summary.awaitingReplyCount,
      confirmationPendingCount: appointmentsSnapshot.summary.confirmationPendingCount,
      touchDueCount: appointmentsSnapshot.summary.touchDueCount,
    },
  } satisfies FrontOfficeEventHubSnapshot;
}

export async function createFrontOfficeSharedEvent(
  input: CreateFrontOfficeSharedEventInput,
): Promise<CreateFrontOfficeSharedEventResult> {
  if (!isFrontOfficeEventManageRole(input.actorRole)) {
    throw new Error("Only owners or office admins can manage shared events.");
  }

  const title = normalizeText(input.title);

  if (!title) {
    throw new Error("Event title is required.");
  }

  const description = normalizeText(input.description) ?? "";
  const eventType = resolveEventType(input.eventType);
  const visibility = resolveEventVisibility(input.visibility);
  const startsAt = parseRequiredDateTimeInput(input.startsAt, "Start time");
  const endsAt = parseOptionalDateTimeInput(input.endsAt, "End time");
  const isOnline = input.isOnline === true;
  const location = normalizeText(input.location);
  const area = normalizeText(input.area);
  const meetingUrl = normalizeOptionalHttpUrlInput(
    input.meetingUrl,
    "Meeting URL",
  );
  const meetingPassword = normalizeText(input.meetingPassword);
  const isMandatory = input.isMandatory === true;
  const recurrenceRule = resolveEventRecurrenceRule(input.recurrenceRule);

  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("End time must be after the start time.");
  }

  if (isMandatory && visibility === EventVisibility.invite_only) {
    throw new Error("Mandatory shared events cannot be invite-only.");
  }

  if (visibility === EventVisibility.office_only && !input.officeId) {
    throw new Error("Office-only events require an active office context.");
  }

  if (!isOnline && !location && !area) {
    throw new Error("Offline events need an area or location.");
  }

  const recurrenceStarts = buildRecurringStarts({
    startsAt,
    recurrenceRule,
  });
  const seriesId =
    recurrenceRule && recurrenceStarts.length > 1 ? crypto.randomUUID() : null;
  const created = await prisma.$transaction(async (tx) => {
    const createdRows = [];

    for (const occurrenceStartsAt of recurrenceStarts) {
      const duration =
        endsAt && endsAt.getTime() > startsAt.getTime()
          ? endsAt.getTime() - startsAt.getTime()
          : null;
      const occurrenceEndsAt =
        duration !== null ? new Date(occurrenceStartsAt.getTime() + duration) : null;

      createdRows.push(
        await tx.event.create({
          data: {
            organizationId: input.organizationId,
            officeId:
              visibility === EventVisibility.office_only
                ? input.officeId ?? null
                : null,
            createdByMemberId: input.actorMembershipId,
            title,
            description,
            eventType,
            visibility,
            startsAt: occurrenceStartsAt,
            endsAt: occurrenceEndsAt,
            isOnline,
            location,
            area,
            meetingUrl,
            meetingPassword,
            isMandatory,
            seriesId,
            recurrenceRule,
          },
          select: {
            id: true,
          },
        }),
      );
    }

    return createdRows;
  });

  return {
    createdCount: created.length,
    eventId: created[0]?.id ?? "",
    seriesId,
  };
}

export async function updateFrontOfficeSharedEvent(
  input: UpdateFrontOfficeSharedEventInput,
) {
  if (!isFrontOfficeEventManageRole(input.actorRole)) {
    throw new Error("Only owners or office admins can manage shared events.");
  }

  const existing = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      visibility: true,
      startsAt: true,
      endsAt: true,
      isOnline: true,
      location: true,
      area: true,
      meetingUrl: true,
      meetingPassword: true,
      isMandatory: true,
      recurrenceRule: true,
      title: true,
      description: true,
      eventType: true,
      officeId: true,
    },
  });

  if (!existing) {
    return null;
  }

  const title = normalizeText(input.title) ?? existing.title;
  const description = normalizeText(input.description) ?? existing.description;
  const eventType = input.eventType ? resolveEventType(input.eventType) : existing.eventType;
  const visibility = input.visibility
    ? resolveEventVisibility(input.visibility)
    : existing.visibility;
  const startsAt = input.startsAt
    ? parseRequiredDateTimeInput(input.startsAt, "Start time")
    : existing.startsAt;
  const endsAt =
    input.endsAt !== undefined
      ? parseOptionalDateTimeInput(input.endsAt, "End time")
      : existing.endsAt;
  const isOnline = input.isOnline ?? existing.isOnline;
  const location =
    input.location !== undefined ? normalizeText(input.location) : existing.location;
  const area = input.area !== undefined ? normalizeText(input.area) : existing.area;
  const meetingUrl =
    input.meetingUrl !== undefined
      ? normalizeOptionalHttpUrlInput(input.meetingUrl, "Meeting URL")
      : existing.meetingUrl;
  const meetingPassword =
    input.meetingPassword !== undefined
      ? normalizeText(input.meetingPassword)
      : existing.meetingPassword;
  const isMandatory = input.isMandatory ?? existing.isMandatory;
  const recurrenceRule =
    input.recurrenceRule !== undefined
      ? resolveEventRecurrenceRule(input.recurrenceRule)
      : existing.recurrenceRule;

  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("End time must be after the start time.");
  }

  if (isMandatory && visibility === EventVisibility.invite_only) {
    throw new Error("Mandatory shared events cannot be invite-only.");
  }

  if (visibility === EventVisibility.office_only && !input.officeId && !existing.officeId) {
    throw new Error("Office-only events require an active office context.");
  }

  return prisma.event.update({
    where: {
      id: input.eventId,
    },
    data: {
      officeId:
        visibility === EventVisibility.office_only
          ? input.officeId ?? existing.officeId ?? null
          : null,
      title,
      description,
      eventType,
      visibility,
      startsAt,
      endsAt,
      isOnline,
      location,
      area,
      meetingUrl,
      meetingPassword,
      isMandatory,
      recurrenceRule,
    },
    select: {
      id: true,
    },
  });
}

export async function respondToFrontOfficeSharedEventRsvp(
  input: RespondToFrontOfficeSharedEventInput,
) {
  const status = resolveRsvpStatus(input.status);

  if (!status) {
    throw new Error("RSVP status must be going, maybe, or declined.");
  }

  const event = await prisma.event.findFirst({
    where: buildVisibleEventWhere({
      organizationId: input.organizationId,
      viewerMembershipId: input.membershipId,
      officeId: input.officeId ?? null,
      eventId: input.eventId,
    }),
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      isMandatory: true,
    },
  });

  if (!event) {
    return null;
  }

  if (event.isMandatory) {
    throw new Error("Mandatory events do not accept RSVP changes.");
  }

  if (resolveEventEndAt(event).getTime() < Date.now()) {
    throw new Error("Past events cannot be updated.");
  }

  await prisma.eventRsvp.upsert({
    where: {
      eventId_membershipId: {
        eventId: event.id,
        membershipId: input.membershipId,
      },
    },
    update: {
      status,
      respondedAt: new Date(),
    },
    create: {
      eventId: event.id,
      membershipId: input.membershipId,
      status,
    },
  });

  return getVisibleSharedEventRecord({
    organizationId: input.organizationId,
    viewerMembershipId: input.membershipId,
    officeId: input.officeId ?? null,
    eventId: input.eventId,
    timeZone: input.timeZone,
  });
}
