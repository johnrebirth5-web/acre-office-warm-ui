import { EventType, EventVisibility, RsvpStatus } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export type AdminOfficeEventRecord = {
  id: string;
  title: string;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  location: string;
  isOnline: boolean;
  signupRequired: boolean;
  signupClosesAt: string;
  capacity: number | null;
  rsvpCount: number;
  href: string;
};

function normalizeRequired(value: string | null | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDate(value: string | null | undefined, label: string) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed;
}

function parseEventType(value: string | null | undefined) {
  return Object.values(EventType).includes(value as EventType)
    ? (value as EventType)
    : EventType.activity;
}

function mapEvent(record: {
  id: string;
  title: string;
  eventType: EventType;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isOnline: boolean;
  signupRequired: boolean;
  signupClosesAt: Date | null;
  capacity: number | null;
  _count?: { rsvps: number };
}): AdminOfficeEventRecord {
  return {
    id: record.id,
    title: record.title,
    eventType: record.eventType,
    startsAt: formatDateTimeLabel(record.startsAt),
    endsAt: formatDateTimeLabel(record.endsAt),
    location: record.location ?? "",
    isOnline: record.isOnline,
    signupRequired: record.signupRequired,
    signupClosesAt: formatDateTimeLabel(record.signupClosesAt),
    capacity: record.capacity,
    rsvpCount: record._count?.rsvps ?? 0,
    href: `/office/admin-office/signups/${record.id}`,
  };
}

function getMonthWindow(focusDate?: string | null) {
  const focus = focusDate ? new Date(focusDate) : new Date();
  const year = Number.isNaN(focus.getTime()) ? new Date().getFullYear() : focus.getFullYear();
  const month = Number.isNaN(focus.getTime()) ? new Date().getMonth() : focus.getMonth();
  const startsAt = new Date(Date.UTC(year, month, 1));
  const endsAt = new Date(Date.UTC(year, month + 1, 1));
  return { startsAt, endsAt };
}

export async function listAdminOfficeEvents(input: {
  organizationId: string;
  focusDate?: string | null;
}) {
  const window = getMonthWindow(input.focusDate);
  const events = await prisma.event.findMany({
    where: {
      organizationId: input.organizationId,
      officeId: null,
      startsAt: {
        gte: window.startsAt,
        lt: window.endsAt,
      },
    },
    include: {
      _count: { select: { rsvps: true } },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  return {
    focusDate: input.focusDate ?? new Date().toISOString().slice(0, 10),
    events: events.map(mapEvent),
  };
}

export async function createAdminOfficeEvent(input: {
  organizationId: string;
  actorMembershipId: string;
  title: string;
  description?: string | null;
  eventType?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  isOnline?: boolean | null;
  meetingUrl?: string | null;
  signupRequired?: boolean | null;
  signupClosesAt?: string | null;
  capacity?: number | null;
}) {
  const startsAt = parseDate(input.startsAt, "Start date");
  if (!startsAt) {
    throw new Error("Start date is required.");
  }
  const endsAt = parseDate(input.endsAt, "End date");
  if (endsAt && endsAt <= startsAt) {
    throw new Error("End date must be after start date.");
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        organizationId: input.organizationId,
        officeId: null,
        createdByMemberId: input.actorMembershipId,
        title: normalizeRequired(input.title, "Title"),
        description: normalizeOptional(input.description) ?? "",
        eventType: parseEventType(input.eventType),
        visibility: EventVisibility.all_agents,
        startsAt,
        endsAt,
        location: normalizeOptional(input.location),
        isOnline: Boolean(input.isOnline),
        meetingUrl: normalizeOptional(input.meetingUrl),
        signupRequired: Boolean(input.signupRequired),
        signupClosesAt: parseDate(input.signupClosesAt, "Signup close date"),
        capacity: input.capacity ?? null,
      },
      include: { _count: { select: { rsvps: true } } },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "admin_office_event",
      entityId: created.id,
      action: activityLogActions.adminOfficeEventCreated,
      payload: {
        officeId: null,
        objectLabel: created.title,
        contextHref: `/office/admin-office/signups/${created.id}`,
      },
    });

    return created;
  });

  return mapEvent(event);
}

export async function updateAdminOfficeEvent(input: {
  organizationId: string;
  actorMembershipId: string;
  eventId: string;
  title?: string | null;
  description?: string | null;
  eventType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  signupRequired?: boolean | null;
  signupClosesAt?: string | null;
  capacity?: number | null;
}) {
  const nextStartsAt = input.startsAt === undefined ? undefined : parseDate(input.startsAt, "Start date");
  const nextEndsAt = input.endsAt === undefined ? undefined : parseDate(input.endsAt, "End date");
  const existing = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
    },
  });

  if (!existing) {
    return null;
  }

  const effectiveStartsAt = nextStartsAt ?? existing.startsAt;
  const effectiveEndsAt = nextEndsAt === undefined ? existing.endsAt : nextEndsAt;
  if (effectiveEndsAt && effectiveEndsAt <= effectiveStartsAt) {
    throw new Error("End date must be after start date.");
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: {
      title: input.title === undefined ? undefined : normalizeRequired(input.title, "Title"),
      description: input.description === undefined ? undefined : normalizeOptional(input.description) ?? "",
      eventType: input.eventType === undefined ? undefined : parseEventType(input.eventType),
      startsAt: input.startsAt === undefined || nextStartsAt === null ? undefined : nextStartsAt,
      endsAt: nextEndsAt === undefined ? undefined : nextEndsAt,
      location: input.location === undefined ? undefined : normalizeOptional(input.location),
      signupRequired: input.signupRequired ?? undefined,
      signupClosesAt: input.signupClosesAt === undefined ? undefined : parseDate(input.signupClosesAt, "Signup close date"),
      capacity: input.capacity === undefined ? undefined : input.capacity,
    },
    include: { _count: { select: { rsvps: true } } },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId,
    entityType: "admin_office_event",
    entityId: event.id,
    action: activityLogActions.adminOfficeEventUpdated,
    payload: {
      officeId: null,
      objectLabel: event.title,
      contextHref: `/office/admin-office/signups/${event.id}`,
    },
  });

  return mapEvent(event);
}

export async function signupForAdminOfficeEvent(input: {
  organizationId: string;
  eventId: string;
  membershipId: string;
}) {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
      signupRequired: true,
    },
    include: {
      _count: { select: { rsvps: true } },
    },
  });

  if (!event) {
    throw new Error("Signup event not found.");
  }

  if (event.signupClosesAt && event.signupClosesAt.getTime() <= Date.now()) {
    throw new Error("Signup is closed.");
  }

  const goingCount = await prisma.eventRsvp.count({
    where: {
      eventId: event.id,
      status: RsvpStatus.going,
    },
  });

  if (event.capacity && goingCount >= event.capacity) {
    throw new Error("Signup is full.");
  }

  await prisma.eventRsvp.upsert({
    where: {
      eventId_membershipId: {
        eventId: event.id,
        membershipId: input.membershipId,
      },
    },
    update: {
      status: RsvpStatus.going,
      respondedAt: new Date(),
    },
    create: {
      eventId: event.id,
      membershipId: input.membershipId,
      status: RsvpStatus.going,
    },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "admin_office_event",
    entityId: event.id,
    action: activityLogActions.adminOfficeEventSignupCreated,
    payload: { objectLabel: event.title },
  });
}

export async function cancelAdminOfficeEventSignup(input: {
  organizationId: string;
  eventId: string;
  membershipId: string;
}) {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
    },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  await prisma.eventRsvp.upsert({
    where: {
      eventId_membershipId: {
        eventId: event.id,
        membershipId: input.membershipId,
      },
    },
    update: {
      status: RsvpStatus.declined,
      respondedAt: new Date(),
    },
    create: {
      eventId: event.id,
      membershipId: input.membershipId,
      status: RsvpStatus.declined,
    },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "admin_office_event",
    entityId: event.id,
    action: activityLogActions.adminOfficeEventSignupCanceled,
    payload: { objectLabel: event.title },
  });
}

export async function getAdminOfficeEventSignupSnapshot(input: {
  organizationId: string;
  eventId: string;
}) {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organizationId: input.organizationId,
    },
    include: {
      rsvps: {
        include: {
          membership: {
            include: { user: true },
          },
        },
        orderBy: [{ respondedAt: "asc" }],
      },
      _count: { select: { rsvps: true } },
    },
  });

  if (!event) {
    return null;
  }

  return {
    event: mapEvent(event),
    signups: event.rsvps.map((rsvp) => ({
      id: rsvp.id,
      status: rsvp.status,
      respondedAt: formatDateTimeLabel(rsvp.respondedAt),
      name: `${rsvp.membership.user.firstName} ${rsvp.membership.user.lastName}`.trim() || rsvp.membership.user.email,
      email: rsvp.membership.user.email,
    })),
  };
}

export async function exportAdminOfficeEventSignupsCsv(input: {
  organizationId: string;
  actorMembershipId: string;
  eventId: string;
}) {
  const snapshot = await getAdminOfficeEventSignupSnapshot(input);
  if (!snapshot) {
    return null;
  }

  const rows = [
    ["Name", "Email", "Status", "Responded At"],
    ...snapshot.signups.map((signup) => [
      signup.name,
      signup.email,
      signup.status,
      signup.respondedAt,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
    .join("\n");

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: input.eventId },
      data: {
        signupExportedAt: new Date(),
        signupExportedByMembershipId: input.actorMembershipId,
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "admin_office_event",
      entityId: input.eventId,
      action: activityLogActions.adminOfficeEventSignupExported,
      payload: {
        objectLabel: snapshot.event.title,
        details: [`Rows exported: ${snapshot.signups.length}`],
      },
    });
  });

  return csv;
}
