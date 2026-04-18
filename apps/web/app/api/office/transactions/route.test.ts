import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeTransactionsPost } from "./route";
import {
  isPlainObject,
  parseAllowedString,
  parsePositiveInteger,
  readJsonObject,
} from "../../../../lib/validate";

test("parsePositiveInteger accepts blank input, clamps max, and rejects non-numeric values", () => {
  assert.equal(parsePositiveInteger(null, 1), 1);
  assert.equal(parsePositiveInteger("  ", 3), 3);
  assert.equal(parsePositiveInteger("12", 1), 12);
  assert.equal(parsePositiveInteger("12", 1, 10), 10);
  assert.equal(parsePositiveInteger("abc", 1), null);
  assert.equal(parsePositiveInteger("-1", 1), null);
});

test("parseAllowedString only accepts allowed values and falls back on blanks", () => {
  const allowed = ["All", "Pending", "Closed"] as const;

  assert.equal(parseAllowedString(null, allowed, "All"), "All");
  assert.equal(parseAllowedString("  ", allowed, "All"), "All");
  assert.equal(parseAllowedString("Pending", allowed, "All"), "Pending");
  assert.equal(parseAllowedString("Rejected", allowed, "All"), null);
});

test("readJsonObject only accepts plain objects", async () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);

  const objectBody = await readJsonObject({
    async json() {
      return { transactionType: "listing" };
    },
  });

  const arrayBody = await readJsonObject({
    async json() {
      return ["bad"];
    },
  });

  const rejectedBody = await readJsonObject({
    async json() {
      throw new Error("invalid json");
    },
  });

  assert.deepEqual(objectBody, { transactionType: "listing" });
  assert.equal(arrayBody, null);
  assert.equal(rejectedBody, null);
});

function createOfficeTransactionsPostRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/transactions`, {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["transactions:view", "transactions:create", "transactions:edit"],
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

async function readResponseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateOfficeTransactionsPost returns 400 validation_error for non-array fees", async () => {
  const response = await handleCreateOfficeTransactionsPost(
    createOfficeTransactionsPostRequest(
      JSON.stringify({
        transactionType: "Sale",
        fees: "invalid",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readResponseJson(response), {
    error: "Transaction create payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      fees: "Invalid input: expected array, received string",
    },
  });
});

test("handleCreateOfficeTransactionsPost forwards normalized create payloads", async () => {
  let capturedSchemaInput: Record<string, unknown> | null = null;
  let capturedOwnerAssignmentInput: Record<string, unknown> | null = null;
  let capturedPrepareInput: Record<string, unknown> | null = null;
  let capturedCreateInput: Record<string, unknown> | null = null;
  let capturedLinkInput: {
    organizationId: string;
    contactId: string;
    transactionId: string;
    options: Record<string, unknown>;
  } | null = null;

  const response = await handleCreateOfficeTransactionsPost(
    createOfficeTransactionsPostRequest(
      JSON.stringify({
        transactionType: "Sale",
        transactionStatus: "closed",
        representing: "Buyer",
        address: "123 Main St",
        transactionName: "Main Street Deal",
        ownerMembershipId: "membership_2",
        frontOfficeClientId: "contact_1",
        companyReferral: "Internal",
        companyReferralEmployeeName: "Jane Doe",
        grossCommission: "12000",
        financeNotes: "Needs review",
        fees: [
          {
            feeType: "Broker split",
            rate: "0.1",
            amount: "",
            selectedCalculationType: "rate",
            approvalStatus: "approved",
            notes: "standard plan",
          },
        ],
      }),
    ),
    createSessionContext(),
    {
      getOfficeTransactionIntakeSchema: async (input) => {
        capturedSchemaInput = input as Record<string, unknown>;
        return {
          builtInFields: [
            {
              fieldKey: "transaction_status",
              options: ["pending", "closed", "cancelled"],
              selectOptions: [
                { value: "pending", isEnabled: true },
                { value: "closed", isEnabled: true },
                { value: "cancelled", isEnabled: true },
              ],
              isVisible: true,
            },
          ],
        } as never;
      },
      getOfficeTransactionOwnerAssignment: async (input) => {
        capturedOwnerAssignmentInput = input as Record<string, unknown>;
        return {
          canSelectDifferentOwner: true,
          options: [{ id: "membership_2", label: "Agent Two" }],
        } as never;
      },
      prepareTransactionIntakeSubmission: (input) => {
        capturedPrepareInput = input as Record<string, unknown>;
        return {
          transactionType: "Sale",
          transactionStatus: "closed",
          representing: "Buyer",
          address: "123 Main St",
          city: "",
          state: "",
          zipCode: "",
          transactionName: "Main Street Deal",
          askingPrice: "",
          purchasedPrice: "",
          price: "",
          buyerAgreementDate: "",
          buyerExpirationDate: "",
          acceptanceDate: "",
          listingDate: "",
          listingExpirationDate: "",
          closingDate: "",
          moveInDate: "",
          additionalFields: {
            source: "test",
          },
        } as never;
      },
      createTransaction: async (input) => {
        capturedCreateInput = input as Record<string, unknown>;
        return {
          id: "transaction_1",
          status: "closed",
        } as never;
      },
      linkContactToTransaction: async (
        organizationId,
        contactId,
        transactionId,
        options,
      ) => {
        capturedLinkInput = {
          organizationId,
          contactId,
          transactionId,
          options: options as Record<string, unknown>,
        };
        return null as never;
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedSchemaInput, {
    organizationId: "org_1",
    officeId: "office_1",
  });
  assert.deepEqual(capturedOwnerAssignmentInput, {
    organizationId: "org_1",
    viewerMembershipId: "membership_1",
    officeId: "office_1",
  });
  assert.deepEqual(capturedPrepareInput, {
    schema: {
      builtInFields: [
        {
          fieldKey: "transaction_status",
          options: ["pending", "closed", "cancelled"],
          selectOptions: [
            { value: "pending", isEnabled: true },
            { value: "closed", isEnabled: true },
            { value: "cancelled", isEnabled: true },
          ],
          isVisible: true,
        },
      ],
    },
    payload: {
      transactionType: "Sale",
      transactionStatus: "closed",
      representing: "Buyer",
      address: "123 Main St",
      transactionName: "Main Street Deal",
      ownerMembershipId: "membership_2",
      frontOfficeClientId: "contact_1",
      companyReferral: "Internal",
      companyReferralEmployeeName: "Jane Doe",
      grossCommission: "12000",
      financeNotes: "Needs review",
      fees: [
        {
          feeType: "Broker split",
          rate: "0.1",
          amount: "",
          selectedCalculationType: "rate",
          approvalStatus: "approved",
          notes: "standard plan",
        },
      ],
    },
  });
  assert.deepEqual(capturedCreateInput, {
    organizationId: "org_1",
    officeId: "office_1",
    ownerMembershipId: "membership_2",
    actorMembershipId: "membership_1",
    transactionType: "Sale",
    transactionStatus: "closed",
    representing: "Buyer",
    address: "123 Main St",
    city: "",
    state: "",
    zipCode: "",
    transactionName: "Main Street Deal",
    askingPrice: "",
    purchasedPrice: "",
    price: "",
    buyerAgreementDate: "",
    buyerExpirationDate: "",
    acceptanceDate: "",
    listingDate: "",
    listingExpirationDate: "",
    closingDate: "",
    moveInDate: "",
    companyReferral: "Internal",
    companyReferralEmployeeName: "Jane Doe",
    grossCommission: "12000",
    financeNotes: "Needs review",
    fees: [
      {
        feeType: "Broker split",
        rate: "0.1",
        amount: "",
        selectedCalculationType: "rate",
        approvalStatus: "approved",
        notes: "standard plan",
      },
    ],
    additionalFields: {
      source: "test",
    },
  });
  assert.deepEqual(capturedLinkInput, {
    organizationId: "org_1",
    contactId: "contact_1",
    transactionId: "transaction_1",
    options: {
      actorMembershipId: "membership_1",
      isPrimary: true,
    },
  });
  assert.deepEqual(await readResponseJson(response), {
    transaction: {
      id: "transaction_1",
      status: "closed",
    },
  });
});
