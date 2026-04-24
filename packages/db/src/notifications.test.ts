import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import {
  NotificationEntityType,
  NotificationType,
  Prisma,
  NotificationSeverity,
  TaskStatus,
  TransactionStatus,
  type UserRole,
} from "@prisma/client"
import { prisma } from "./client.ts"
import { getOfficeDashboardBusinessSnapshot } from "./dashboard.ts"
import {
  getTransactionOverdueSinceDate,
  isTransactionOverdue,
  openOfficeNotification,
  reconcileOfficeNotificationReminders,
} from "./notifications.ts"

after(async () => {
  await prisma.$disconnect()
})

async function createNotificationsTestContext() {
  const suffix = randomUUID().slice(0, 8)
  const organization = await prisma.organization.create({
    data: {
      name: `Notifications Test ${suffix}`,
      slug: `notifications-test-${suffix}`,
    },
  })

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Notifications Office ${suffix}`,
      slug: `notifications-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  })

  const trackedUserIds: string[] = []

  async function createMembership(prefix: string, role: UserRole = "office_admin") {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true,
      },
    })
    trackedUserIds.push(user.id)

    const membership = await prisma.membership.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        userId: user.id,
        role,
        status: "active",
        title: role,
        permissions: Prisma.JsonNull,
      },
    })

    return membership
  }

  const primaryMembership = await createMembership("notifications-primary")
  const secondaryMembership = await createMembership("notifications-secondary")

  return {
    organization,
    office,
    primaryMembership,
    secondaryMembership,
    createMembership,
    async createClient(input?: {
      nextFollowUpAt?: Date | null
      fullName?: string
    }) {
      return prisma.client.create({
        data: {
          organizationId: organization.id,
          ownerMembershipId: primaryMembership.id,
          fullName: input?.fullName ?? `Reminder Client ${suffix}`,
          source: "Manual entry",
          stage: "Warm Lead",
          intent: "Buyer",
          preferredAreas: [],
          nextFollowUpAt: input?.nextFollowUpAt ?? null,
        },
      })
    },
    async createTransaction(input: {
      ownerMembershipId?: string | null
      status?: "opportunity" | "active" | "pending" | "closed" | "cancelled"
      moveInDate?: Date | null
      closingDate?: Date | null
      title?: string
    }) {
      return prisma.transaction.create({
        data: {
          organizationId: organization.id,
          officeId: office.id,
          ownerMembershipId:
            input.ownerMembershipId === undefined
              ? primaryMembership.id
              : input.ownerMembershipId,
          type: "rental_leasing",
          status: input.status ?? "pending",
          representing: "tenant",
          title: input.title ?? `Overdue Transaction ${suffix}`,
          address: "123 Overdue Ave",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          moveInDate: input.moveInDate ?? null,
          closingDate: input.closingDate ?? null,
        },
      })
    },
    async createNotification(input: {
      membershipId?: string | null
      officeId?: string | null
      actionUrl?: string | null
      readAt?: Date | null
    }) {
      return prisma.notification.create({
        data: {
          organizationId: organization.id,
          officeId: input.officeId === undefined ? office.id : input.officeId,
          membershipId:
            input.membershipId === undefined
              ? primaryMembership.id
              : input.membershipId,
          type: NotificationType.follow_up_overdue,
          category: "follow_up",
          severity: NotificationSeverity.warning,
          title: "Follow up due",
          body: "Reopen the client conversation.",
          actionUrl:
            input.actionUrl === undefined
              ? "/office/contacts/test-contact"
              : input.actionUrl,
          readAt: input.readAt === undefined ? null : input.readAt,
        },
      })
    },
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      })

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      })
    },
  }
}

function addDays(value: Date, days: number) {
  const nextValue = new Date(value)
  nextValue.setDate(nextValue.getDate() + days)
  return nextValue
}

function addMonths(value: Date, months: number) {
  const nextValue = new Date(value)
  nextValue.setMonth(nextValue.getMonth() + months)
  return nextValue
}

test("transaction overdue date helpers clamp natural month boundaries", () => {
  const januaryEnd = new Date(2026, 0, 31, 10, 30)
  const overdueSince = getTransactionOverdueSinceDate(januaryEnd)

  assert.equal(overdueSince.getFullYear(), 2026)
  assert.equal(overdueSince.getMonth(), 3)
  assert.equal(overdueSince.getDate(), 30)
  assert.equal(overdueSince.getHours(), 10)
  assert.equal(overdueSince.getMinutes(), 30)

  assert.equal(
    isTransactionOverdue(
      {
        status: TransactionStatus.pending,
        moveInDate: januaryEnd,
        closingDate: null,
      },
      new Date(2026, 3, 30, 10, 30),
    ),
    true,
  )
  assert.equal(
    isTransactionOverdue(
      {
        status: TransactionStatus.pending,
        moveInDate: januaryEnd,
        closingDate: null,
      },
      new Date(2026, 3, 30, 10, 29),
    ),
    false,
  )
  assert.equal(
    isTransactionOverdue(
      {
        status: TransactionStatus.closed,
        moveInDate: januaryEnd,
        closingDate: null,
      },
      new Date(2026, 3, 30, 10, 30),
    ),
    false,
  )
})

test("opening a personal office notification marks it read and returns the relative action url", async () => {
  const context = await createNotificationsTestContext()

  try {
    const notification = await context.createNotification({})

    const actionUrl = await openOfficeNotification({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
      notificationId: notification.id,
    })

    assert.equal(actionUrl, "/office/contacts/test-contact")

    const storedNotification = await prisma.notification.findUnique({
      where: {
        id: notification.id,
      },
      select: {
        readAt: true,
      },
    })

    assert.ok(storedNotification?.readAt)
  } finally {
    await context.cleanup()
  }
})

test("opening a shared office notification does not mutate its read state for everyone", async () => {
  const context = await createNotificationsTestContext()

  try {
    const notification = await context.createNotification({
      membershipId: null,
      actionUrl: "/office/transactions/test-transaction",
    })

    const actionUrl = await openOfficeNotification({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
      notificationId: notification.id,
    })

    assert.equal(actionUrl, "/office/transactions/test-transaction")

    const storedNotification = await prisma.notification.findUnique({
      where: {
        id: notification.id,
      },
      select: {
        readAt: true,
      },
    })

    assert.equal(storedNotification?.readAt, null)
  } finally {
    await context.cleanup()
  }
})

test("opening a notification ignores unsafe external action urls and uses the fallback route", async () => {
  const context = await createNotificationsTestContext()

  try {
    const notification = await context.createNotification({
      actionUrl: "https://evil.example.com/phish",
    })

    const actionUrl = await openOfficeNotification({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
      notificationId: notification.id,
      fallbackUrl: "/office/notifications?view=archived",
    })

    assert.equal(actionUrl, "/office/notifications?view=archived")
  } finally {
    await context.cleanup()
  }
})

test("opening another member's personal notification returns no action and leaves it unread", async () => {
  const context = await createNotificationsTestContext()

  try {
    const notification = await context.createNotification({
      membershipId: context.secondaryMembership.id,
    })

    const actionUrl = await openOfficeNotification({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
      notificationId: notification.id,
    })

    assert.equal(actionUrl, "")

    const storedNotification = await prisma.notification.findUnique({
      where: {
        id: notification.id,
      },
      select: {
        readAt: true,
      },
    })

    assert.equal(storedNotification?.readAt, null)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders creates and clears client follow-up reminders", async () => {
  const context = await createNotificationsTestContext()

  try {
    const client = await context.createClient({
      nextFollowUpAt: addDays(new Date(), -1),
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const reminder = await prisma.notification.findFirst({
      where: {
        organizationId: context.organization.id,
        membershipId: context.primaryMembership.id,
        entityType: NotificationEntityType.client,
        entityId: client.id,
      },
      select: {
        type: true,
        actionUrl: true,
      },
    })

    assert.equal(reminder?.type, NotificationType.follow_up_overdue)
    assert.equal(reminder?.actionUrl, `/agent/clients/${client.id}`)

    await prisma.client.update({
      where: {
        id: client.id,
      },
      data: {
        nextFollowUpAt: addDays(new Date(), 10),
      },
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const clearedReminder = await prisma.notification.findFirst({
      where: {
        organizationId: context.organization.id,
        membershipId: context.primaryMembership.id,
        entityType: NotificationEntityType.client,
        entityId: client.id,
      },
      select: {
        id: true,
      },
    })

    assert.equal(clearedReminder, null)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders skips client reminders when a legacy follow-up task is still open", async () => {
  const context = await createNotificationsTestContext()

  try {
    const client = await context.createClient({
      nextFollowUpAt: addDays(new Date(), -1),
      fullName: "Task-backed client",
    })

    await prisma.followUpTask.create({
      data: {
        organizationId: context.organization.id,
        clientId: client.id,
        assigneeMemberId: context.primaryMembership.id,
        title: "Legacy follow-up task",
        status: TaskStatus.queued,
        metadata: Prisma.JsonNull,
      },
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const clientReminder = await prisma.notification.findFirst({
      where: {
        organizationId: context.organization.id,
        membershipId: context.primaryMembership.id,
        entityType: NotificationEntityType.client,
        entityId: client.id,
      },
      select: {
        id: true,
      },
    })

    assert.equal(clientReminder, null)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders creates transaction overdue reminders for owner and admin recipients", async () => {
  const context = await createNotificationsTestContext()

  try {
    const transactionOwner = await context.createMembership("transaction-owner", "agent")
    const accountant = await context.createMembership("transaction-accountant", "accountant")
    const transaction = await context.createTransaction({
      ownerMembershipId: transactionOwner.id,
      moveInDate: addMonths(new Date(), -4),
      title: "Three month old move-in",
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const reminders = await prisma.notification.findMany({
      where: {
        organizationId: context.organization.id,
        type: NotificationType.transaction_overdue,
        entityType: NotificationEntityType.transaction,
        entityId: transaction.id,
      },
      select: {
        membershipId: true,
        category: true,
        severity: true,
        actionUrl: true,
      },
      orderBy: [{ membershipId: "asc" }],
    })

    assert.deepEqual(
      reminders.map((reminder) => reminder.membershipId).sort(),
      [
        accountant.id,
        context.primaryMembership.id,
        context.secondaryMembership.id,
        transactionOwner.id,
      ].sort(),
    )
    assert.equal(reminders[0]?.category, "transaction")
    assert.equal(reminders[0]?.severity, "critical")
    assert.equal(reminders[0]?.actionUrl, `/office/transactions/${transaction.id}`)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders prefers move-in date over an older closing date", async () => {
  const context = await createNotificationsTestContext()

  try {
    const transaction = await context.createTransaction({
      closingDate: addMonths(new Date(), -5),
      moveInDate: addMonths(new Date(), -1),
      title: "Recent move-in wins",
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const reminder = await prisma.notification.findFirst({
      where: {
        organizationId: context.organization.id,
        type: NotificationType.transaction_overdue,
        entityType: NotificationEntityType.transaction,
        entityId: transaction.id,
      },
      select: {
        id: true,
      },
    })

    assert.equal(reminder, null)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders uses closing date when move-in date is missing", async () => {
  const context = await createNotificationsTestContext()

  try {
    const transaction = await context.createTransaction({
      closingDate: addMonths(new Date(), -4),
      title: "Closing only overdue",
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const reminder = await prisma.notification.findFirst({
      where: {
        organizationId: context.organization.id,
        type: NotificationType.transaction_overdue,
        entityType: NotificationEntityType.transaction,
        entityId: transaction.id,
        membershipId: context.primaryMembership.id,
      },
      select: {
        id: true,
      },
    })

    assert.ok(reminder)
  } finally {
    await context.cleanup()
  }
})

test("reconcileOfficeNotificationReminders clears transaction overdue reminders once the transaction is closed or cancelled", async () => {
  const context = await createNotificationsTestContext()

  try {
    const closedLater = await context.createTransaction({
      moveInDate: addMonths(new Date(), -4),
      title: "Close after reminder",
    })
    const alreadyCancelled = await context.createTransaction({
      moveInDate: addMonths(new Date(), -4),
      status: "cancelled",
      title: "Cancelled transaction",
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    await prisma.transaction.update({
      where: {
        id: closedLater.id,
      },
      data: {
        status: "closed",
      },
    })

    await reconcileOfficeNotificationReminders({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.primaryMembership.id,
    })

    const staleReminders = await prisma.notification.findMany({
      where: {
        organizationId: context.organization.id,
        type: NotificationType.transaction_overdue,
        entityType: NotificationEntityType.transaction,
        entityId: {
          in: [closedLater.id, alreadyCancelled.id],
        },
      },
      select: {
        id: true,
      },
    })

    assert.deepEqual(staleReminders, [])
  } finally {
    await context.cleanup()
  }
})

test("dashboard snapshot returns the transaction overdue queue", async () => {
  const context = await createNotificationsTestContext()

  try {
    const overdueTransaction = await context.createTransaction({
      closingDate: addMonths(new Date(), -4),
      title: "Dashboard overdue",
    })
    await context.createTransaction({
      closingDate: addMonths(new Date(), -1),
      title: "Dashboard current",
    })

    const snapshot = await getOfficeDashboardBusinessSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      viewerMembershipId: context.primaryMembership.id,
    })

    assert.equal(snapshot.transactionOverdueQueue.count, 1)
    assert.equal(snapshot.transactionOverdueQueue.transactions[0]?.id, overdueTransaction.id)
    assert.equal(snapshot.transactionOverdueQueue.transactions[0]?.openHref, `/office/transactions/${overdueTransaction.id}`)
  } finally {
    await context.cleanup()
  }
})
