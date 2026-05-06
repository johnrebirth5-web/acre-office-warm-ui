import { AdminEmailRequestStatus } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export type AdminEmailRequestRecord = {
  id: string;
  fullName: string;
  preferredEmailPrefix: string;
  status: AdminEmailRequestStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
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

function parseStatus(value: string | null | undefined) {
  return Object.values(AdminEmailRequestStatus).includes(value as AdminEmailRequestStatus)
    ? (value as AdminEmailRequestStatus)
    : null;
}

function mapRequest(record: {
  id: string;
  fullName: string;
  preferredEmailPrefix: string;
  status: AdminEmailRequestStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminEmailRequestRecord {
  return {
    id: record.id,
    fullName: record.fullName,
    preferredEmailPrefix: record.preferredEmailPrefix,
    status: record.status,
    notes: record.notes ?? "",
    createdAt: formatDateTimeLabel(record.createdAt),
    updatedAt: formatDateTimeLabel(record.updatedAt),
    href: `/office/admin-office/email-requests/${record.id}`,
  };
}

export async function listAdminEmailRequests(input: {
  organizationId: string;
  officeId?: string | null;
  status?: string | null;
}) {
  const status = parseStatus(input.status);
  const requests = await prisma.adminEmailRequest.findMany({
    where: {
      organizationId: input.organizationId,
      OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : undefined,
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return {
    summary: {
      totalCount: requests.length,
      pendingCount: requests.filter((request) => request.status === "pending").length,
      approvedCount: requests.filter((request) => request.status === "approved").length,
      completedCount: requests.filter((request) => request.status === "completed").length,
    },
    requests: requests.map(mapRequest),
  };
}

export async function getAdminEmailRequest(input: {
  organizationId: string;
  officeId?: string | null;
  requestId: string;
}) {
  const request = await prisma.adminEmailRequest.findFirst({
    where: {
      id: input.requestId,
      organizationId: input.organizationId,
      OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : undefined,
    },
  });

  return request ? mapRequest(request) : null;
}

export async function createAdminEmailRequest(input: {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId?: string | null;
  fullName: string;
  preferredEmailPrefix: string;
  notes?: string | null;
}) {
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.adminEmailRequest.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        requestedByMembershipId: input.actorMembershipId ?? null,
        fullName: normalizeRequired(input.fullName, "Full name"),
        preferredEmailPrefix: normalizeRequired(input.preferredEmailPrefix, "Preferred email prefix").toLowerCase(),
        notes: normalizeOptional(input.notes),
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId ?? null,
      entityType: "admin_email_request",
      entityId: created.id,
      action: activityLogActions.adminEmailRequestCreated,
      payload: {
        officeId: created.officeId,
        objectLabel: `${created.fullName} · ${created.preferredEmailPrefix}`,
        contextHref: `/office/admin-office/email-requests/${created.id}`,
      },
    });

    return created;
  });

  return mapRequest(request);
}

export async function updateAdminEmailRequestStatus(input: {
  organizationId: string;
  actorMembershipId: string;
  requestId: string;
  status: string;
  notes?: string | null;
}) {
  const status = parseStatus(input.status);
  if (!status) {
    throw new Error("Email request status is invalid.");
  }

  const existing = await prisma.adminEmailRequest.findFirst({
    where: {
      id: input.requestId,
      organizationId: input.organizationId,
    },
  });

  if (!existing) {
    return null;
  }

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.adminEmailRequest.update({
      where: { id: existing.id },
      data: {
        status,
        notes: input.notes === undefined ? undefined : normalizeOptional(input.notes),
        approvedByMembershipId: status === "approved" ? input.actorMembershipId : undefined,
        completedByMembershipId: status === "completed" ? input.actorMembershipId : undefined,
        rejectedByMembershipId: status === "rejected" ? input.actorMembershipId : undefined,
      },
    });

    const action =
      status === "approved"
        ? activityLogActions.adminEmailRequestApproved
        : status === "completed"
          ? activityLogActions.adminEmailRequestCompleted
          : status === "rejected"
            ? activityLogActions.adminEmailRequestRejected
            : activityLogActions.adminEmailRequestCreated;

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "admin_email_request",
      entityId: updated.id,
      action,
      payload: {
        officeId: updated.officeId,
        objectLabel: `${updated.fullName} · ${updated.preferredEmailPrefix}`,
        contextHref: `/office/admin-office/email-requests/${updated.id}`,
      },
    });

    return updated;
  });

  return mapRequest(request);
}
