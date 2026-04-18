import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeSignatureRequestPost } from "./route";

function createOfficeSignatureRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/signatures`,
    {
      method: "POST",
      body,
      headers: {
        origin,
        "content-type": "application/json",
      },
    },
  );
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["signatures:manage"],
      role: "office_admin",
    },
    currentOrganization: {
      id: "org_1",
    },
    currentOffice: {
      id: "office_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateOfficeSignatureRequestPost returns 400 validation_error for unsupported context types", async () => {
  const response = await handleCreateOfficeSignatureRequestPost(
    createOfficeSignatureRequest(
      JSON.stringify({
        documentId: "document_1",
        contextType: "pipeline",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Signature request payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      contextType: "A supported signature context type is required.",
    },
  });
});

test("handleCreateOfficeSignatureRequestPost preserves legacy signer requirement", async () => {
  const response = await handleCreateOfficeSignatureRequestPost(
    createOfficeSignatureRequest(
      JSON.stringify({
        documentId: "document_1",
        recipients: [
          {
            role: "cc",
            name: "FYI only",
            email: "cc@example.com",
            recipientRole: "CC",
          },
        ],
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "At least one signer or approver recipient is required.",
  });
});

test("handleCreateOfficeSignatureRequestPost forwards normalized multi-recipient payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeSignatureRequestPost(
    createOfficeSignatureRequest(
      JSON.stringify({
        signatureRequestId: "sig_1",
        documentId: "document_1",
        offerId: "offer_1",
        contextType: "transaction",
        recipientName: "Legacy signer",
        recipientEmail: "legacy@example.com",
        recipientRole: "Buyer",
        recipients: [
          {
            id: "recipient_1",
            role: "signer",
            name: "Primary signer",
            email: "signer@example.com",
            recipientRole: "Buyer",
            routingStep: 1,
            sortOrder: 0,
          },
          {
            role: "approver",
            name: "Office reviewer",
            email: "review@example.com",
            recipientRole: "Manager",
            routingStep: 2,
            sortOrder: 1,
          },
        ],
        ccRecipients: [
          {
            name: "FYI copy",
            email: "cc@example.com",
            recipientRole: "CC",
            sortOrder: 2,
          },
        ],
        emailSubject: " Please sign ",
        emailBody: " Review and sign ",
        senderDisplayName: " Acre Office ",
        senderReplyTo: " reply@example.com ",
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      createSignatureRequest: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "sig_1",
          statusKey: "draft",
        } as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    transactionId: "transaction_1",
    actorMembershipId: "membership_1",
    signatureRequestId: "sig_1",
    formId: null,
    documentId: "document_1",
    offerId: "offer_1",
    templateId: null,
    subjectMembershipId: null,
    contextType: "transaction",
    contextId: null,
    contextLabel: null,
    recipientName: "Legacy signer",
    recipientEmail: "legacy@example.com",
    recipientRole: "Buyer",
    recipients: [
      {
        id: "recipient_1",
        role: "signer",
        name: "Primary signer",
        email: "signer@example.com",
        recipientRole: "Buyer",
        routingStep: 1,
        sortOrder: 0,
      },
      {
        id: null,
        role: "approver",
        name: "Office reviewer",
        email: "review@example.com",
        recipientRole: "Manager",
        routingStep: 2,
        sortOrder: 1,
      },
    ],
    ccRecipients: [
      {
        id: null,
        name: "FYI copy",
        email: "cc@example.com",
        recipientRole: "CC",
        sortOrder: 2,
      },
    ],
    emailSubject: "Please sign",
    emailBody: "Review and sign",
    expiresAt: null,
    senderDisplayName: "Acre Office",
    senderReplyTo: "reply@example.com",
    signingOrder: null,
  });
  assert.deepEqual(await readJson(response), {
    signatureRequest: {
      id: "sig_1",
      statusKey: "draft",
    },
  });
});
