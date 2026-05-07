import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleAccountEmailRequestPost } from "./route";

function createEmailRequest(body: unknown, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/account/email-request`, {
    method: "POST",
    body: JSON.stringify(body),
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
      role: "agent",
      permissions: [],
    },
    currentOffice: {
      id: "office_1",
    },
    currentOrganization: {
      id: "org_1",
    },
    currentUser: {
      email: "ada@acreny.us",
      firstName: "Ada",
      lastName: "Lovelace",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleAccountEmailRequestPost validates preferred email prefixes", async () => {
  const response = await handleAccountEmailRequestPost(
    createEmailRequest({
      preferredEmailPrefix: "bad prefix",
    }),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error:
      "Preferred email prefix can include lowercase letters, numbers, dots, underscores, and hyphens.",
  });
});

test("handleAccountEmailRequestPost creates an admin email request without changing user email", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleAccountEmailRequestPost(
    createEmailRequest({
      notes: "Please use this on new cards.",
      preferredEmailPrefix: "Ada.L",
    }),
    createSessionContext(),
    {
      createAdminEmailRequest: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "request_1",
          fullName: input.fullName,
          href: "/office/admin-office/email-requests/request_1",
          notes: input.notes ?? "",
          preferredEmailPrefix: input.preferredEmailPrefix,
          status: "pending",
          createdAt: "May 7, 2026, 11:00 AM",
          updatedAt: "May 7, 2026, 11:00 AM",
        };
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    actorMembershipId: "membership_1",
    fullName: "Ada Lovelace",
    preferredEmailPrefix: "ada.l",
    notes:
      "Current sign-in email: ada@acreny.us\nRequester note: Please use this on new cards.",
  });
  assert.deepEqual(await readJson(response), {
    emailRequest: {
      id: "request_1",
      fullName: "Ada Lovelace",
      href: "/office/admin-office/email-requests/request_1",
      notes:
        "Current sign-in email: ada@acreny.us\nRequester note: Please use this on new cards.",
      preferredEmailPrefix: "ada.l",
      status: "pending",
      createdAt: "May 7, 2026, 11:00 AM",
      updatedAt: "May 7, 2026, 11:00 AM",
    },
  });
});
