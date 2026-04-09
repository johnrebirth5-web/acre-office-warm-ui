import { can, canAccessOfficeMail, canSendOfficeMail } from "@acre/auth";
import {
  createOfficeMailThread,
  getFrontOfficeAppointmentsSnapshot,
  prisma,
} from "@acre/db";
import { MembershipStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import {
  buildAppointmentInternalMailThreadResponse,
  mapAppointmentInternalMailThreadErrorStatus,
} from "../../../../../../../../packages/db/src/mail.ts";

type RouteContext = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function isInternalMailContinuityRecipientRole(role: string) {
  return role === "owner" || role === "office_admin";
}

const officeRecipientRoles = new Set([
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_manager",
  "office_user",
]);

function buildMailThreadSubject(appointment: {
  title: string;
  startsAtLabel: string;
  externalStatusLabel: string;
}) {
  const title = appointment.title.trim() || "Appointment";
  const startsAtLabel = appointment.startsAtLabel.trim();
  const externalStatusLabel = appointment.externalStatusLabel.trim();

  if (externalStatusLabel === "Reschedule requested") {
    return `Reschedule request: ${title}`;
  }

  if (externalStatusLabel === "Confirmed") {
    return `Confirmed: ${title}${startsAtLabel ? ` on ${startsAtLabel}` : ""}`;
  }

  return `Please confirm: ${title}${startsAtLabel ? ` on ${startsAtLabel}` : ""}`;
}

function buildMailThreadBody(appointment: {
  title: string;
  startsAtLabel: string;
  endsAtLabel: string;
  clientLabel: string;
  clientEmailLabel: string;
  contactLabel: string;
  listingLabel: string;
  locationLabel: string;
  coordinationLabel: string;
  coordinationNextStep: string;
  externalStatusLabel: string;
  externalNote: string;
}) {
  const title = appointment.title.trim() || "Appointment";

  return [
    "Internal Acre continuity copy for the appointment email brief.",
    "Acre keeps the appointment and writeback as the source of truth. This thread stays inside Acre and does not imply provider sync.",
    "",
    `Appointment: ${title}`,
    appointment.startsAtLabel ? `Starts: ${appointment.startsAtLabel}` : "",
    appointment.endsAtLabel ? `Ends: ${appointment.endsAtLabel}` : "",
    appointment.clientLabel
      ? `Client / contact: ${appointment.clientLabel}`
      : "",
    appointment.clientEmailLabel
      ? `Email target: ${appointment.clientEmailLabel}`
      : "",
    appointment.contactLabel
      ? `External contact: ${appointment.contactLabel}`
      : "",
    appointment.listingLabel ? `Listing: ${appointment.listingLabel}` : "",
    appointment.locationLabel ? `Location: ${appointment.locationLabel}` : "",
    appointment.externalStatusLabel
      ? `External coordination: ${appointment.externalStatusLabel}`
      : "",
    appointment.externalNote
      ? `External note: ${appointment.externalNote}`
      : "",
    appointment.coordinationLabel
      ? `Acre coordination: ${appointment.coordinationLabel}`
      : "",
    appointment.coordinationNextStep
      ? `Next move: ${appointment.coordinationNextStep}`
      : "",
    "",
    "Review the brief inside Acre, then return to the appointment record and save the next checkpoint there.",
    "The external email still stays manual unless you open the outside draft separately.",
    "",
    "Best,",
    "Acre",
  ]
    .filter(Boolean)
    .join("\n");
}

async function listInternalMailContinuityRecipientIds(input: {
  organizationId: string;
  membershipId: string;
  officeId: string | null;
}) {
  const query = {
    organizationId: input.organizationId,
    status: MembershipStatus.active,
    user: {
      isActive: true,
    },
    id: {
      not: input.membershipId,
    },
  } as const;

  const officeScopedRecipients = await prisma.membership.findMany({
    where: {
      ...query,
      ...(input.officeId
        ? {
            officeId: input.officeId,
          }
        : {}),
    },
    select: {
      id: true,
      role: true,
    },
  });

  const preferredRecipientIds = officeScopedRecipients
    .filter((membership) =>
      isInternalMailContinuityRecipientRole(membership.role),
    )
    .filter((membership) => officeRecipientRoles.has(membership.role))
    .map((membership) => membership.id);

  if (preferredRecipientIds.length > 0) {
    return preferredRecipientIds;
  }

  const fallbackRecipients = await prisma.membership.findMany({
    where: query,
    select: {
      id: true,
      role: true,
    },
  });

  const fallbackRecipientIds = fallbackRecipients
    .filter((membership) => officeRecipientRoles.has(membership.role))
    .map((membership) => membership.id);

  if (fallbackRecipientIds.length > 0) {
    return fallbackRecipientIds;
  }

  throw new Error(
    "No internal mail recipients are available for this appointment brief.",
  );
}

function mapMailThreadErrorStatus(message: string) {
  return mapAppointmentInternalMailThreadErrorStatus(message);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json(
      { error: "Front Office dashboard access required." },
      { status: 403 },
    );
  }

  if (!canAccessOfficeMail(context.currentMembership)) {
    return NextResponse.json(
      { error: "Mail access required." },
      { status: 403 },
    );
  }

  if (!canSendOfficeMail(context.currentMembership)) {
    return NextResponse.json(
      { error: "Mail send access required." },
      { status: 403 },
    );
  }

  const { appointmentId } = await params;

  try {
    const snapshot = await getFrontOfficeAppointmentsSnapshot({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      timeZone: context.currentUser.timezone,
      targetAppointmentId: appointmentId,
    });
    const appointment = snapshot.selectedAppointment;

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found." },
        { status: 404 },
      );
    }

    if (!appointment.emailBriefHref) {
      return NextResponse.json(
        {
          error:
            "An email target is required before opening the appointment mail thread.",
          hint: buildMailThreadFallbackHint(),
        },
        { status: 409 },
      );
    }

    if (appointment.statusValue !== "scheduled") {
      return NextResponse.json(
        {
          error:
            "Only scheduled appointments can open the internal mail brief.",
          hint: buildMailThreadFallbackHint(),
        },
        { status: 409 },
      );
    }

    const recipientMembershipIds = await listInternalMailContinuityRecipientIds(
      {
        organizationId: context.currentOrganization.id,
        membershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
      },
    );

    const subject = buildMailThreadSubject(appointment);
    const body = buildMailThreadBody(appointment);

    const thread = await createOfficeMailThread({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      subject,
      body,
      recipientMembershipIds,
      actionUrl: `/agent/calendar?appointmentId=${appointment.id}`,
      actionLabel: "Open appointment",
    });

    return NextResponse.json(
      buildAppointmentInternalMailThreadResponse({
        threadId: thread.id,
        subject: thread.subject,
      }),
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not open the internal mail thread.";
    const mappedError = mapMailThreadErrorStatus(message);

    return NextResponse.json(
      {
        error: message,
        ...(mappedError.hint ? { hint: mappedError.hint } : {}),
      },
      { status: mappedError.status },
    );
  }
}
