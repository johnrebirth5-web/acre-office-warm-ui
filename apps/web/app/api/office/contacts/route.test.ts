import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeContactPost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/contacts`, {
    method: "POST",
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

test("handleCreateOfficeContactPost returns 400 validation_error for non-object payload", async () => {
  const response = await handleCreateOfficeContactPost(
    createRequest(JSON.stringify(["bad"])),
    createContext()
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

test("handleCreateOfficeContactPost forwards prepared contact submission", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeContactPost(
    createRequest(
      JSON.stringify({
        fullName: "Alex Acre",
        preferredAreas: "Brooklyn, Manhattan"
      })
    ),
    createContext(),
    {
      getOfficeContactFieldSchema: async () => ({ fields: [] }) as never,
      prepareContactFieldSubmission: () =>
        ({
          fullName: "Alex Acre",
          email: "",
          phone: "",
          contactType: "buyer",
          source: "",
          stage: "",
          intent: "",
          budgetMin: "",
          budgetMax: "",
          preferredAreas: "Brooklyn, Manhattan",
          notes: "",
          lastContactAt: "",
          nextFollowUpAt: "",
          leaseEndDate: "",
          leaseReminderAt: "",
          additionalFields: {}
        }) as never,
      createContact: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "contact_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    ownerMembershipId: "membership_actor",
    actorMembershipId: "membership_actor",
    actorOfficeId: "office_1",
    fullName: "Alex Acre",
    email: "",
    phone: "",
    contactType: "buyer",
    source: "",
    stage: "",
    intent: "",
    budgetMin: "",
    budgetMax: "",
    preferredAreas: ["Brooklyn", "Manhattan"],
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
