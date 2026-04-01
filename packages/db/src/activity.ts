import { TaskStatus, type NotificationType, type TransactionStatus } from "@prisma/client";
import { prisma } from "./client";

export type GetOfficeActivitySnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
};

export type OfficeActivityEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAtLabel: string;
  rsvpCount: number;
  visibility: string;
};

export type OfficeActivityNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAtLabel: string;
  isUnread: boolean;
  actionUrl: string;
};

export type OfficeActivityFollowUpItem = {
  id: string;
  title: string;
  description: string;
  dueLabel: string;
  href: string;
  kind: "Overdue task" | "Task due soon" | "Contact follow-up";
};

export type OfficeActivityOperationalItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: string;
  updatedAtLabel: string;
};

export type OfficeActivitySnapshot = {
  upcomingEvents: OfficeActivityEvent[];
  notifications: OfficeActivityNotification[];
  followUpItems: OfficeActivityFollowUpItem[];
  recentOperationalItems: OfficeActivityOperationalItem[];
};

const transactionStatusLabelMap: Record<TransactionStatus, string> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

const notificationTypeLabelMap: Record<NotificationType, string> = {
  system: "System",
  listing: "Listing",
  follow_up: "Follow-up",
  event: "Event",
  appointment_due_soon: "Appointment due soon",
  task_review_requested: "Awaiting my review",
  task_second_review_requested: "Awaiting second review",
  task_rejected: "Rejected task",
  offer_created: "Offer created",
  offer_received: "Offer received",
  offer_expiring_soon: "Offer expiring soon",
  signature_pending: "Signature pending",
  signature_completed: "Signature completed",
  incoming_update_pending_review: "Incoming update pending review",
  follow_up_assigned: "Follow-up assigned",
  follow_up_overdue: "Follow-up overdue",
  onboarding_assigned: "Onboarding assigned",
  onboarding_due_soon: "Onboarding due soon",
  payout_statement_ready: "Payout statement ready",
  payout_statement_revision_requested: "Payout statement revision requested",
  payout_statement_confirmed: "Payout statement confirmed"
};

function formatDateTimeLabel(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export async function getOfficeActivitySnapshot(input: GetOfficeActivitySnapshotInput): Promise<OfficeActivitySnapshot> {
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);

  const [upcomingEvents, recentNotifications, dueTasks, dueContacts, recentTransactions] = await Promise.all([
    prisma.event.findMany({
      where: {
        organizationId: input.organizationId,
        startsAt: {
          gte: now
        },
        ...(input.officeId
          ? {
              OR: [{ officeId: input.officeId }, { officeId: null }]
            }
          : {})
      },
      include: {
        _count: {
          select: {
            rsvps: true
          }
        }
      },
      orderBy: [{ startsAt: "asc" }],
      take: 5
    }),
    prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        OR: [{ membershipId: input.membershipId }, { membershipId: null }]
      },
      include: {
        membership: {
          select: {
            officeId: true
          }
        },
        event: {
          select: {
            officeId: true
          }
        },
        followUpTask: {
          select: {
            client: {
              select: {
                ownerMembership: {
                  select: {
                    officeId: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 12
    }),
    prisma.followUpTask.findMany({
      where: {
        organizationId: input.organizationId,
        status: {
          in: [TaskStatus.queued, TaskStatus.in_progress]
        },
        dueAt: {
          lte: soon
        },
        client: {
          ...(input.officeId
            ? {
                ownerMembership: {
                  is: {
                    officeId: input.officeId
                  }
                }
              }
            : {})
        }
      },
      include: {
        client: true
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 8
    }),
    prisma.client.findMany({
      where: {
        organizationId: input.organizationId,
        nextFollowUpAt: {
          lte: soon
        },
        ...(input.officeId
          ? {
              ownerMembership: {
                is: {
                  officeId: input.officeId
                }
              }
            }
          : {})
      },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      take: 8
    }),
    prisma.transaction.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.officeId ? { officeId: input.officeId } : {})
      },
      include: {
        ownerMembership: {
          include: {
            user: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5
    })
  ]);

  const notifications = recentNotifications
    .filter((notification) => {
      if (!input.officeId) {
        return true;
      }

      if (notification.membership?.officeId && notification.membership.officeId !== input.officeId) {
        return false;
      }

      if (notification.event?.officeId && notification.event.officeId !== input.officeId) {
        return false;
      }

      const followUpOfficeId = notification.followUpTask?.client?.ownerMembership?.officeId;

      if (followUpOfficeId && followUpOfficeId !== input.officeId) {
        return false;
      }

      return true;
    })
    .slice(0, 6)
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      kind: notificationTypeLabelMap[notification.type],
      createdAtLabel: formatDateTimeLabel(notification.createdAt),
      isUnread: !notification.readAt,
      actionUrl: notification.actionUrl ?? ""
    }));

  const taskClientIds = new Set(dueTasks.map((task) => task.clientId).filter(Boolean));

  const followUpItems: OfficeActivityFollowUpItem[] = [
    ...dueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.client ? `${task.client.fullName} · ${task.client.email ?? task.client.phone ?? "Contact record"}` : "Unlinked task",
      dueLabel: formatDateTimeLabel(task.dueAt),
      href: task.clientId ? `/office/contacts/${task.clientId}` : "/office/contacts",
      kind: (task.dueAt && task.dueAt < now ? "Overdue task" : "Task due soon") as "Overdue task" | "Task due soon"
    })),
    ...dueContacts
      .filter((client) => !taskClientIds.has(client.id))
      .map((client) => ({
        id: client.id,
        title: client.fullName,
        description: client.intent ? `${client.intent} · ${client.stage}` : client.stage,
        dueLabel: formatDateTimeLabel(client.nextFollowUpAt),
        href: `/office/contacts/${client.id}`,
        kind: "Contact follow-up" as const
      }))
  ].slice(0, 8);

  return {
    upcomingEvents: upcomingEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location ?? event.meetingUrl ?? "Location TBD",
      startsAtLabel: formatDateTimeLabel(event.startsAt),
      rsvpCount: event._count.rsvps,
      visibility: event.visibility.replaceAll("_", " ")
    })),
    notifications,
    followUpItems,
    recentOperationalItems: recentTransactions.map((transaction) => ({
      id: transaction.id,
      title: transaction.title,
      description: `${transaction.ownerMembership ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}` : "Unassigned"} · ${transaction.address}, ${transaction.city}`,
      href: `/office/transactions/${transaction.id}`,
      status: transactionStatusLabelMap[transaction.status],
      updatedAtLabel: formatDateTimeLabel(transaction.updatedAt)
    }))
  };
}
