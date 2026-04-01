import {
  AppointmentStatus,
  AppointmentType,
  FrontOfficeHandoffStatus,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { buildFrontOfficeHandoffCreateHref } from "./front-office-contracts";

export type FrontOfficeAppointmentTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type FrontOfficeAppointmentOption = {
  value: string;
  label: string;
};

export type FrontOfficeAppointmentRecord = {
  id: string;
  title: string;
  typeLabel: string;
  typeTone: FrontOfficeAppointmentTone;
  statusLabel: string;
  statusTone: FrontOfficeAppointmentTone;
  reminderLabel: string;
  reminderTone: FrontOfficeAppointmentTone;
  startsAtLabel: string;
  locationLabel: string;
  clientLabel: string;
  listingLabel: string;
  notesLabel: string;
};

export type FrontOfficeAppointmentHandoffItem = {
  id: string;
  clientName: string;
  stageLabel: string;
  summary: string;
  href: string;
};

export type FrontOfficeAppointmentsSnapshot = {
  summary: {
    upcomingCount: number;
    todayCount: number;
    showingCount: number;
    handoffReadyCount: number;
  };
  typeOptions: FrontOfficeAppointmentOption[];
  clientOptions: FrontOfficeAppointmentOption[];
  listingOptions: FrontOfficeAppointmentOption[];
  appointments: FrontOfficeAppointmentRecord[];
  handoffs: FrontOfficeAppointmentHandoffItem[];
};

export type GetFrontOfficeAppointmentsSnapshotInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
};

export type CreateFrontOfficeAppointmentInput = {
  organizationId: string;
  officeId?: string | null;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  title?: string | null;
  type?: string | null;
  clientId?: string | null;
  listingId?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  contactLabel?: string | null;
  notes?: string | null;
};

export type UpdateFrontOfficeAppointmentStatusInput = {
  organizationId: string;
  appointmentId: string;
  ownerMembershipId: string;
  actorMembershipId?: string | null;
  status?: string | null;
  officeId?: string | null;
};

const frontOfficeAppointmentTypeDefinitions = [
  { value: AppointmentType.showing, label: "Showing" },
  { value: AppointmentType.consultation, label: "Consultation" },
  { value: AppointmentType.client_meeting, label: "Client meeting" },
  { value: AppointmentType.internal_meeting, label: "Internal meeting" },
  { value: AppointmentType.open_house, label: "Open house" },
  { value: AppointmentType.other, label: "Other" },
] as const;

const frontOfficeAppointmentStatusDefinitions = [
  { value: AppointmentStatus.scheduled, label: "Scheduled" },
  { value: AppointmentStatus.completed, label: "Completed" },
  { value: AppointmentStatus.canceled, label: "Canceled" },
  { value: AppointmentStatus.no_show, label: "No-show" },
] as const;

const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];
const openFrontOfficeHandoffStatuses: FrontOfficeHandoffStatus[] = [
  FrontOfficeHandoffStatus.draft,
  FrontOfficeHandoffStatus.ready,
] as const;

const appointmentSelect = Prisma.validator<Prisma.AppointmentSelect>()({
  id: true,
  title: true,
  type: true,
  status: true,
  startsAt: true,
  endsAt: true,
  location: true,
  meetingUrl: true,
  contactLabel: true,
  notes: true,
  client: {
    select: {
      id: true,
      fullName: true,
    },
  },
  listing: {
    select: {
      id: true,
      title: true,
      neighborhood: true,
      city: true,
    },
  },
});

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function findAppointmentTypeDefinition(value: AppointmentType) {
  return frontOfficeAppointmentTypeDefinitions.find(
    (option) => option.value === value,
  );
}

function findAppointmentStatusDefinition(value: AppointmentStatus) {
  return frontOfficeAppointmentStatusDefinitions.find(
    (option) => option.value === value,
  );
}

function mapAppointmentTypeTone(
  type: AppointmentType,
): FrontOfficeAppointmentTone {
  switch (type) {
    case AppointmentType.showing:
      return "accent";
    case AppointmentType.consultation:
      return "success";
    case AppointmentType.client_meeting:
      return "warning";
    case AppointmentType.internal_meeting:
      return "neutral";
    case AppointmentType.open_house:
      return "accent";
    default:
      return "neutral";
  }
}

function mapAppointmentStatusTone(
  status: AppointmentStatus,
): FrontOfficeAppointmentTone {
  switch (status) {
    case AppointmentStatus.completed:
      return "success";
    case AppointmentStatus.no_show:
      return "warning";
    case AppointmentStatus.canceled:
      return "danger";
    default:
      return "accent";
  }
}

function buildAppointmentReminderState(input: {
  startsAt: Date;
  status: AppointmentStatus;
  now: Date;
}) {
  if (input.status !== AppointmentStatus.scheduled) {
    return {
      label: "Reminder cleared",
      tone: "neutral" as const,
    };
  }

  const twoHoursFromNow = new Date(input.now.getTime() + 2 * 60 * 60 * 1000);
  const startOfTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1,
  );
  const startOfDayAfterTomorrow = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 2,
  );

  if (input.startsAt.getTime() < input.now.getTime()) {
    return {
      label: "Start time passed",
      tone: "danger" as const,
    };
  }

  if (input.startsAt.getTime() <= twoHoursFromNow.getTime()) {
    return {
      label: "Starts within 2h",
      tone: "warning" as const,
    };
  }

  if (input.startsAt.getTime() < startOfTomorrow.getTime()) {
    return {
      label: "Today",
      tone: "accent" as const,
    };
  }

  if (input.startsAt.getTime() < startOfDayAfterTomorrow.getTime()) {
    return {
      label: "Tomorrow",
      tone: "success" as const,
    };
  }

  return {
    label: "Upcoming",
    tone: "neutral" as const,
  };
}

function isAppointmentType(
  value: string | null | undefined,
): value is AppointmentType {
  return frontOfficeAppointmentTypeDefinitions.some(
    (option) => option.value === value,
  );
}

function isAppointmentStatus(
  value: string | null | undefined,
): value is AppointmentStatus {
  return frontOfficeAppointmentStatusDefinitions.some(
    (option) => option.value === value,
  );
}

function parseRequiredDate(value: string, fieldLabel: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return parsed;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDefaultAppointmentTitle(
  type: AppointmentType,
  clientName: string | null | undefined,
  listingTitle: string | null | undefined,
) {
  const typeLabel = findAppointmentTypeDefinition(type)?.label ?? "Appointment";
  const context = [clientName?.trim(), listingTitle?.trim()]
    .filter(Boolean)
    .join(" · ");

  return context ? `${typeLabel} · ${context}` : typeLabel;
}

function mapAppointmentRecord(
  appointment: Prisma.AppointmentGetPayload<{
    select: typeof appointmentSelect;
  }>,
  now: Date,
  timeZone?: string | null,
): FrontOfficeAppointmentRecord {
  const meetingOrLocation =
    appointment.location?.trim() ||
    appointment.meetingUrl?.trim() ||
    "Location pending";
  const listingLabel = appointment.listing
    ? `${appointment.listing.title} · ${appointment.listing.neighborhood}, ${appointment.listing.city}`
    : "No listing linked";
  const clientLabel =
    appointment.client?.fullName ??
    (appointment.contactLabel?.trim() || "No client linked");
  const notesLabel = appointment.notes?.trim() || "No internal note yet";
  const reminder = buildAppointmentReminderState({
    startsAt: appointment.startsAt,
    status: appointment.status,
    now,
  });

  return {
    id: appointment.id,
    title: appointment.title,
    typeLabel:
      findAppointmentTypeDefinition(appointment.type)?.label ?? "Appointment",
    typeTone: mapAppointmentTypeTone(appointment.type),
    statusLabel:
      findAppointmentStatusDefinition(appointment.status)?.label ?? "Scheduled",
    statusTone: mapAppointmentStatusTone(appointment.status),
    reminderLabel: reminder.label,
    reminderTone: reminder.tone,
    startsAtLabel: formatDateTimeLabel(appointment.startsAt, { timeZone }),
    locationLabel: meetingOrLocation,
    clientLabel,
    listingLabel,
    notesLabel,
  };
}

export async function getFrontOfficeAppointmentsSnapshot(
  input: GetFrontOfficeAppointmentsSnapshotInput,
): Promise<FrontOfficeAppointmentsSnapshot> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const sevenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7,
  );
  const fourteenDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 14,
  );
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const listingWhere: Prisma.ListingWhereInput = {
    organizationId: input.organizationId,
    status: {
      in: activeListingStatuses,
    },
    ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
  };

  const [
    appointments,
    upcomingCount,
    todayCount,
    showingCount,
    clients,
    listings,
    handoffReadyCount,
    handoffs,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        startsAt: {
          gte: sevenDaysAgo,
          lte: fourteenDaysFromNow,
        },
      },
      orderBy: [{ startsAt: "asc" }, { updatedAt: "desc" }],
      take: 24,
      select: appointmentSelect,
    }),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: now,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        startsAt: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: AppointmentStatus.scheduled,
        type: AppointmentType.showing,
        startsAt: {
          gte: now,
        },
      },
    }),
    prisma.client.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        fullName: true,
        stage: true,
      },
    }),
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
      },
    }),
    prisma.frontOfficeHandoffDraft.count({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [...openFrontOfficeHandoffStatuses],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
    }),
    prisma.frontOfficeHandoffDraft.findMany({
      where: {
        organizationId: input.organizationId,
        ownerMembershipId: input.viewerMembershipId,
        status: {
          in: [...openFrontOfficeHandoffStatuses],
        },
        committedTransactionId: null,
        AND: [
          officeScopeFilter ?? {},
          {
            client: {
              primaryTransactions: {
                none: {},
              },
              transactionContacts: {
                none: {},
              },
            },
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        stageLabel: true,
        summary: true,
        client: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);

  return {
    summary: {
      upcomingCount,
      todayCount,
      showingCount,
      handoffReadyCount,
    },
    typeOptions: frontOfficeAppointmentTypeDefinitions.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    clientOptions: clients.map((client) => ({
      value: client.id,
      label: `${client.fullName} · ${client.stage}`,
    })),
    listingOptions: listings.map((listing) => ({
      value: listing.id,
      label: `${listing.title} · ${listing.neighborhood}, ${listing.city}`,
    })),
    appointments: appointments.map((appointment) =>
      mapAppointmentRecord(appointment, now, input.timeZone),
    ),
    handoffs: handoffs.map((draft) => ({
      id: draft.id,
      clientName: draft.client.fullName,
      stageLabel: draft.stageLabel,
      summary:
        draft.summary?.trim() ||
        `${draft.client.fullName} is ready for formal transaction workflow.`,
      href: buildFrontOfficeHandoffCreateHref(draft.id),
    })),
  };
}

export async function createFrontOfficeAppointment(
  input: CreateFrontOfficeAppointmentInput,
): Promise<FrontOfficeAppointmentRecord> {
  const type = isAppointmentType(input.type)
    ? input.type
    : AppointmentType.showing;
  const startsAt = parseRequiredDate(input.startsAt, "Start time");
  const endsAt = parseOptionalDate(input.endsAt);
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);

  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new Error("End time cannot be earlier than start time.");
  }

  const [client, listing] = await Promise.all([
    input.clientId
      ? prisma.client.findFirst({
          where: {
            id: input.clientId,
            organizationId: input.organizationId,
            ownerMembershipId: input.ownerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
          },
        })
      : Promise.resolve(null),
    input.listingId
      ? prisma.listing.findFirst({
          where: {
            id: input.listingId,
            organizationId: input.organizationId,
            ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
          },
          select: {
            id: true,
            title: true,
            neighborhood: true,
            city: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (input.clientId && !client) {
    throw new Error(
      "Selected client is not available in your Front Office scope.",
    );
  }

  if (input.listingId && !listing) {
    throw new Error(
      "Selected listing is not available in the current office scope.",
    );
  }

  const title =
    input.title?.trim() ||
    buildDefaultAppointmentTitle(type, client?.fullName, listing?.title);
  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        ownerMembershipId: input.ownerMembershipId,
        clientId: client?.id ?? null,
        listingId: listing?.id ?? null,
        type,
        status: AppointmentStatus.scheduled,
        title,
        startsAt,
        endsAt,
        location: input.location?.trim() || null,
        meetingUrl: input.meetingUrl?.trim() || null,
        contactLabel: input.contactLabel?.trim() || null,
        notes: input.notes?.trim() || null,
        metadata: Prisma.JsonNull,
      },
      select: appointmentSelect,
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "appointment",
      entityId: created.id,
      action: activityLogActions.appointmentCreated,
      payload: {
        officeId: input.officeId ?? null,
        ...(created.client?.id ? { contactId: created.client.id } : {}),
        ...(created.client?.fullName
          ? { contactName: created.client.fullName }
          : {}),
        objectLabel: `${created.title}${created.client?.fullName ? ` · ${created.client.fullName}` : ""}`,
        details: [
          `Type: ${findAppointmentTypeDefinition(created.type)?.label ?? "Appointment"}`,
          `Status: ${findAppointmentStatusDefinition(created.status)?.label ?? "Scheduled"}`,
          `Starts: ${formatDateTimeLabel(created.startsAt, { timeZone: null })}`,
          ...(created.location?.trim()
            ? [`Location: ${created.location.trim()}`]
            : []),
          ...(created.meetingUrl?.trim()
            ? [`Meeting link: ${created.meetingUrl.trim()}`]
            : []),
          ...(created.listing ? [`Listing: ${created.listing.title}`] : []),
        ],
      },
    });

    return created;
  });

  return mapAppointmentRecord(appointment, new Date(), null);
}

export async function updateFrontOfficeAppointmentStatus(
  input: UpdateFrontOfficeAppointmentStatusInput,
): Promise<FrontOfficeAppointmentRecord | null> {
  if (!isAppointmentStatus(input.status)) {
    throw new Error("A valid appointment status is required.");
  }

  const nextStatus = input.status;

  const existing = await prisma.appointment.findFirst({
    where: {
      id: input.appointmentId,
      organizationId: input.organizationId,
      ownerMembershipId: input.ownerMembershipId,
    },
    select: appointmentSelect,
  });

  if (!existing) {
    return null;
  }

  if (existing.status === nextStatus) {
    return mapAppointmentRecord(existing, new Date(), null);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        status: nextStatus,
      },
      select: appointmentSelect,
    });

    if (saved.client?.id && nextStatus === AppointmentStatus.completed) {
      await tx.client.update({
        where: {
          id: saved.client.id,
        },
        data: {
          lastContactAt: now,
        },
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? input.ownerMembershipId,
      entityType: "appointment",
      entityId: saved.id,
      action: activityLogActions.appointmentUpdated,
      payload: {
        officeId: input.officeId ?? null,
        ...(saved.client?.id ? { contactId: saved.client.id } : {}),
        ...(saved.client?.fullName
          ? { contactName: saved.client.fullName }
          : {}),
        objectLabel: `${saved.title}${saved.client?.fullName ? ` · ${saved.client.fullName}` : ""}`,
        changes: [
          {
            label: "Status",
            previousValue:
              findAppointmentStatusDefinition(existing.status)?.label ??
              "Scheduled",
            nextValue:
              findAppointmentStatusDefinition(saved.status)?.label ??
              "Scheduled",
          },
        ],
        details: [
          `Starts: ${formatDateTimeLabel(saved.startsAt, { timeZone: null })}`,
          ...(saved.location?.trim()
            ? [`Location: ${saved.location.trim()}`]
            : []),
        ],
      },
    });

    return saved;
  });

  return mapAppointmentRecord(updated, new Date(), null);
}
