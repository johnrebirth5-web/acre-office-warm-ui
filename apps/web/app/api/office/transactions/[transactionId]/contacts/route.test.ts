import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleLinkOfficeTransactionContactPost } from "./route";

function createOfficeTransactionContactRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/transactions/transaction_1/contacts`,
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
      permissions: ["contacts.link"],
      role: "office_manager",
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleLinkOfficeTransactionContactPost returns 400 validation_error when contactId is missing", async () => {
  const response = await handleLinkOfficeTransactionContactPost(
    createOfficeTransactionContactRequest(
      JSON.stringify({
        contactId: "   ",
      }),
    ),
    "transaction_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Transaction contact payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      contactId: "Contact is required.",
    },
  });
});

test("handleLinkOfficeTransactionContactPost forwards normalized contact linking input", async () => {
  let capturedArgs:
    | {
        organizationId: string;
        contactId: string;
        transactionId: string;
        options: Record<string, unknown>;
      }
    | null = null;

  const response = await handleLinkOfficeTransactionContactPost(
    createOfficeTransactionContactRequest(
      JSON.stringify({
        contactId: "contact_2",
        isPrimary: true,
      }),
    ),
    "transaction_1",
    createSessionContext(),
    {
      linkContactToTransaction: async (
        organizationId,
        contactId,
        transactionId,
        options,
      ) => {
        capturedArgs = {
          organizationId,
          contactId,
          transactionId,
          options: options as Record<string, unknown>,
        };
        return true;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedArgs, {
    organizationId: "org_1",
    contactId: "contact_2",
    transactionId: "transaction_1",
    options: {
      isPrimary: true,
      actorMembershipId: "membership_1",
    },
  });
  assert.deepEqual(await readJson(response), { ok: true });
});
