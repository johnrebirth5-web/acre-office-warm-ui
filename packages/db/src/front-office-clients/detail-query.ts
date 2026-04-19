import { AppointmentStatus, AppointmentType, Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "../client";
import type { GetFrontOfficeClientDetailInput } from "./types";

export async function getFrontOfficeClientDetailRecord(
  input: GetFrontOfficeClientDetailInput,
  now: Date,
) {
  const thirtyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30,
  );
  const thirtyDaysFromNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  );

  return prisma.client.findFirst({
    where: {
      id: input.clientId,
      organizationId: input.organizationId,
      ownerMembershipId: input.viewerMembershipId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      intent: true,
      budgetMin: true,
      budgetMax: true,
      preferredAreas: true,
      notes: true,
      lastContactAt: true,
      nextFollowUpAt: true,
      leaseEndDate: true,
      leaseReminderAt: true,
      ownerMembership: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      followUpTasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          createdAt: true,
          updatedAt: true,
          assigneeMembership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      frontOfficeSendRecords: {
        orderBy: [{ sentAt: "desc" }],
        take: 8,
        select: {
          id: true,
          channel: true,
          materialType: true,
          clientStageLabel: true,
          appointmentId: true,
          appointmentTitle: true,
          appointmentStartsAt: true,
          sentAt: true,
          firstOpenedAt: true,
          lastOpenedAt: true,
          openCount: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      appointments: {
        where: {
          startsAt: {
            gte: thirtyDaysAgo,
            lte: thirtyDaysFromNow,
          },
        },
        orderBy: [{ startsAt: "asc" }],
        take: 8,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          meetingUrl: true,
          contactLabel: true,
          metadata: true,
          listing: {
            select: {
              title: true,
              neighborhood: true,
              city: true,
            },
          },
        },
      },
      stageHistory: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          note: true,
          createdAt: true,
          membership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      handoffDrafts: {
        orderBy: [{ updatedAt: "desc" }],
        take: 4,
        select: {
          id: true,
          stageLabel: true,
          summary: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          committedAt: true,
          committedTransactionId: true,
        },
      },
      transactionContacts: {
        where: {
          organizationId: input.organizationId,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          role: true,
          transaction: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

export async function getFrontOfficeClientEngagementSnapshot(
  input: GetFrontOfficeClientDetailInput,
  clientId: string,
) {
  const [sendCount, openedSendCount, sendAggregate] = await Promise.all([
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId,
      },
    }),
    prisma.frontOfficeSendRecord.count({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId,
        openCount: {
          gt: 0,
        },
      },
    }),
    prisma.frontOfficeSendRecord.aggregate({
      where: {
        organizationId: input.organizationId,
        senderMembershipId: input.viewerMembershipId,
        clientId,
      },
      _sum: {
        openCount: true,
      },
      _max: {
        lastOpenedAt: true,
      },
    }),
  ]);

  return {
    sendCount,
    openedSendCount,
    sendAggregate,
  };
}

export function getFrontOfficeTaskSummary(
  tasks: Array<{
    status: TaskStatus;
    dueAt: Date | null;
  }>,
  now: Date,
) {
  const isOpenTask = (status: TaskStatus) =>
    status !== TaskStatus.completed && status !== TaskStatus.canceled;

  const openTaskCount = tasks.filter((task) => isOpenTask(task.status)).length;
  const completedTaskCount = tasks.filter(
    (task) => task.status === TaskStatus.completed,
  ).length;
  const overdueTaskCount = tasks.filter(
    (task) =>
      isOpenTask(task.status) &&
      Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
  ).length;
  const hasOverdueTask = tasks.some(
    (task) =>
      isOpenTask(task.status) &&
      Boolean(task.dueAt && task.dueAt.getTime() < now.getTime()),
  );

  return {
    openTaskCount,
    completedTaskCount,
    overdueTaskCount,
    hasOverdueTask,
  };
}

export function getUpcomingScheduledAppointment(
  appointments: Array<{
    metadata: Prisma.JsonValue;
    title: string;
    type: AppointmentType;
    status: AppointmentStatus;
    startsAt: Date;
  }>,
  now: Date,
) {
  return (
    appointments.find(
      (appointment) =>
        appointment.status === AppointmentStatus.scheduled &&
        appointment.startsAt.getTime() >= now.getTime(),
    ) ?? null
  );
}
