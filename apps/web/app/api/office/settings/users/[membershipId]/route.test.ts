import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeUserPatch } from "./route";

function createOfficeUserPatchRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/settings/users/membership_2`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createSessionContext(options: { canManageOfficeSettings?: boolean } = {}) {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: options.canManageOfficeSettings
        ? ["settings.manage"]
        : [],
      role: options.canManageOfficeSettings ? "office_admin" : "team_lead",
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

test("handleUpdateOfficeUserPatch returns 400 validation_error for unsupported status payloads", async () => {
  const response = await handleUpdateOfficeUserPatch(
    createOfficeUserPatchRequest(
      JSON.stringify({
        status: "paused",
      }),
    ),
    "membership_2",
    createSessionContext({ canManageOfficeSettings: true }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "User access payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      status: "A supported user status is required.",
    },
  });
});

test("handleUpdateOfficeUserPatch returns 400 validation_error for blank name fields", async () => {
  const response = await handleUpdateOfficeUserPatch(
    createOfficeUserPatchRequest(
      JSON.stringify({
        firstName: "  ",
      }),
    ),
    "membership_2",
    createSessionContext({ canManageOfficeSettings: true }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "User access payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      firstName: "First name is required.",
    },
  });
});

test("handleUpdateOfficeUserPatch preserves the admin-tier 403 guard", async () => {
  const response = await handleUpdateOfficeUserPatch(
    createOfficeUserPatchRequest(
      JSON.stringify({
        role: "owner",
      }),
    ),
    "membership_2",
    createSessionContext(),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Only Owner / Office Admin can assign admin-tier roles.",
  });
});

test("handleUpdateOfficeUserPatch passes normalized office access fields through on success", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeUserPatch(
    createOfficeUserPatchRequest(
      JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        role: "agent",
        status: "active",
        defaultOfficeId: "__all__",
        accessibleOfficeIds: ["office_2"],
        officeId: null,
      }),
    ),
    "membership_2",
    createSessionContext({ canManageOfficeSettings: true }),
    {
      updateOfficeAdminUser: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "membership_2" } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
    viewerOfficeId: "office_1",
    firstName: "Ada",
    lastName: "Lovelace",
    role: "agent",
    status: "active",
    defaultOfficeId: undefined,
    accessibleOfficeIds: ["office_2"],
    officeId: null,
  });
  assert.deepEqual(await readJson(response), {
    membership: {
      id: "membership_2",
    },
  });
});
