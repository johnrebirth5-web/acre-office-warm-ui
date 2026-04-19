import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeContactPatch } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/contacts/contact_1`, {
    method: "PATCH",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "office_admin", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeContactPatch returns 400 validation_error for non-object payload", async () => {
  const response = await handleUpdateOfficeContactPatch(
    createRequest(JSON.stringify(["bad"])),
    createContext(),
    "contact_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Contact payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      body: "Invalid input: expected object, received array"
    }
  });
});

test("handleUpdateOfficeContactPatch forwards prepared update submission", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const existingContact = { id: "contact_1" };

  const response = await handleUpdateOfficeContactPatch(
    createRequest(
      JSON.stringify({
        fullName: "Alex Acre Updated",
        preferredAreas: "Queens"
      })
    ),
    createContext(),
    "contact_1",
    {
      getContactById: async () => existingContact as never,
      getOfficeContactFieldSchema: async () => ({ fields: [] }) as never,
      prepareContactFieldSubmission: () =>
        ({
          fullName: "Alex Acre Updated",
          email: "",
          phone: "",
          contactType: "buyer",
          source: "",
          stage: "",
          intent: "",
          budgetMin: "",
          budgetMax: "",
          preferredAreas: "Queens",
          notes: "",
          lastContactAt: "",
          nextFollowUpAt: "",
          leaseEndDate: "",
          leaseReminderAt: "",
          additionalFields: {}
        }) as never,
      updateContact: async (_contactId, input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "contact_1" } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    ownerMembershipId: "membership_actor",
    actorMembershipId: "membership_actor",
    actorOfficeId: "office_1",
    fullName: "Alex Acre Updated",
    email: "",
    phone: "",
    contactType: "buyer",
    source: "",
    stage: "",
    intent: "",
    budgetMin: "",
    budgetMax: "",
    preferredAreas: ["Queens"],
    notes: "",
    lastContactAt: "",
    nextFollowUpAt: "",
    leaseEndDate: "",
    leaseReminderAt: "",
    additionalFields: {}
  });
  assert.deepEqual(await readJson(response), {
    contact: {
      id: "contact_1"
    }
  });
});
