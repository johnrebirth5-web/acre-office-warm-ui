import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeAccountProfilePatch } from "./route";

function createProfileRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/account/profile`, {
    method: "PATCH",
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
      id: "membership_1",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeAccountProfilePatch returns 400 validation_error for non-string locale", async () => {
  const response = await handleUpdateOfficeAccountProfilePatch(
    createProfileRequest(
      JSON.stringify({
        locale: 100
      })
    ),
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Profile payload is required.",
    errorCode: "validation_error",
    fieldErrors: {
      locale: "Invalid input: expected string, received number"
    }
  });
});

test("handleUpdateOfficeAccountProfilePatch forwards normalized profile payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeAccountProfilePatch(
    createProfileRequest(
      JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada",
        phone: "555-1111",
        internalExtension: "23",
        avatarUrl: "https://example.com/avatar.png",
        bio: "Operations lead",
        licenseNumber: "NY-1",
        licenseState: "NY",
        timezone: "America/New_York",
        locale: "en-US"
      })
    ),
    createSessionContext(),
    {
      saveOfficeAccountProfile: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "membership_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    membershipId: "membership_1",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada",
    phone: "555-1111",
    internalExtension: "23",
    avatarUrl: "https://example.com/avatar.png",
    bio: "Operations lead",
    licenseNumber: "NY-1",
    licenseState: "NY",
    timezone: "America/New_York",
    locale: "en-US"
  });
  assert.deepEqual(await readJson(response), {
    ok: true,
    saved: {
      id: "membership_1"
    }
  });
});
