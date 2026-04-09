import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { NotificationType, Prisma, NotificationSeverity } from "@prisma/client"
import { prisma } from "./client.ts"
import { openOfficeNotification } from "./notifications.ts"

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

  async function createMembership(prefix: string) {
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
        role: "office_admin",
        status: "active",
        title: "Office Admin",
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
