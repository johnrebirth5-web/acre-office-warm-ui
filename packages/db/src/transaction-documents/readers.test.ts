import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import {
  Prisma,
  SignatureRequestStatus,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType,
  type UserRole,
} from "@prisma/client";

import { prisma } from "../client.ts";
import {
  getPublicSignatureDocumentStorageRecord,
  hashSignatureToken,
} from "./readers.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createSignatureDocumentTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Signature Document Test ${suffix}`,
      slug: `signature-document-test-${suffix}`,
    },
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Signature Document Office ${suffix}`,
      slug: `signature-document-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true,
      },
    });
    trackedUserIds.push(user.id);

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
    });

    return membership;
  }

  const requester = await createMembership("office_admin", "signature-requester");

  return {
    organization,
    office,
    requester,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds,
          },
        },
      });
    },
  };
}

test("expired public signature document access returns null", async () => {
  const context = await createSignatureDocumentTestContext();

  try {
    const transaction = await prisma.transaction.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        ownerMembershipId: context.requester.id,
        type: TransactionType.sales,
        status: TransactionStatus.active,
        representing: TransactionRepresenting.seller,
        title: "Signature Expiry Test",
        address: "123 Test Street",
        city: "New York",
        state: "NY",
        zipCode: "10001",
      },
    });

    const document = await prisma.transactionDocument.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        transactionId: transaction.id,
        uploadedByMembershipId: context.requester.id,
        title: "Listing Agreement",
        fileName: "listing-agreement.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
        storageKey: `test/signature-documents/${randomUUID()}.pdf`,
        documentType: "listing_agreement",
      },
    });

    const token = `public-document-${randomUUID()}`;
    await prisma.signatureRequest.create({
      data: {
        organizationId: context.organization.id,
        officeId: context.office.id,
        transactionId: transaction.id,
        documentId: document.id,
        requestedByMembershipId: context.requester.id,
        recipientName: "Expired Recipient",
        recipientEmail: "expired-recipient@example.com",
        recipientRole: "Seller",
        publicTokenHash: hashSignatureToken(token),
        status: SignatureRequestStatus.sent,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const record = await getPublicSignatureDocumentStorageRecord(token);
    assert.equal(record, null);
  } finally {
    await context.cleanup();
  }
});
