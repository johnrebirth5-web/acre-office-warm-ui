import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveOffice1099RecordsPut } from "./route";

function create1099RecordsRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/1099-tracker/records`, {
    method: "PUT",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_actor",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1"
    },
    currentOffice: {
      id: "office_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleSaveOffice1099RecordsPut returns 400 validation_error when membershipId is blank", async () => {
  const response = await handleSaveOffice1099RecordsPut(
    create1099RecordsRequest(
      JSON.stringify({
        membershipId: "   ",
        records: []
      })
    ),
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "1099 tracker payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      membershipId: "membershipId is required."
    }
  });
});

test("handleSaveOffice1099RecordsPut forwards normalized payment record payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleSaveOffice1099RecordsPut(
    create1099RecordsRequest(
      JSON.stringify({
        membershipId: "membership_target",
        taxYear: "2025",
        records: [
          {
            id: " record_1 ",
            paymentDate: " 2025-01-31 ",
            paymentAmount: " 1500.00 ",
            memo: " January payout "
          },
          {
            paymentDate: "2025-02-28",
            paymentAmount: "2000.00"
          }
        ]
      })
    ),
    createSessionContext(),
    {
      saveAgent1099PaymentRecords: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          membershipId: "membership_target",
          taxYear: "2025"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_target",
    taxYear: "2025",
    actorMembershipId: "membership_actor",
    records: [
      {
        id: "record_1",
        paymentDate: "2025-01-31",
        paymentAmount: "1500.00",
        memo: "January payout"
      },
      {
        paymentDate: "2025-02-28",
        paymentAmount: "2000.00",
        memo: ""
      }
    ]
  });
  assert.deepEqual(await readJson(response), {
    editor: {
      membershipId: "membership_target",
      taxYear: "2025"
    }
  });
});
