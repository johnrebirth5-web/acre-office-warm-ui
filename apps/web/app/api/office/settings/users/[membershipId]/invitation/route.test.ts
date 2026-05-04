import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleOfficeUserInvitationPost } from "./route";

function createOfficeUserInvitationRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/settings/users/membership_2/invitation`,
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
      permissions: ["users.manage"],
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

test("handleOfficeUserInvitationPost returns 400 validation_error for unsupported invitation actions", async () => {
  const response = await handleOfficeUserInvitationPost(
    createOfficeUserInvitationRequest(
      JSON.stringify({
        action: "pause",
      }),
    ),
    "membership_2",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Invitation request payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "Invitation action must be issue or revoke.",
    },
  });
});

test("handleOfficeUserInvitationPost revokes an invitation when action is revoke", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleOfficeUserInvitationPost(
    createOfficeUserInvitationRequest(
      JSON.stringify({
        action: "revoke",
      }),
    ),
    "membership_2",
    createSessionContext(),
    {
      revokeInvitationForMembership: async (input) => {
        capturedInput = input as Record<string, unknown>;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
    viewerOfficeId: "office_1",
  });
  assert.deepEqual(await readJson(response), {
    membershipId: "membership_2",
    revoked: true,
  });
});

test("handleOfficeUserInvitationPost preserves invitation URL generation on success", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleOfficeUserInvitationPost(
    createOfficeUserInvitationRequest(
      JSON.stringify({
        action: "issue",
      }),
    ),
    "membership_2",
    createSessionContext(),
    {
      issueInvitationForMembership: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          invitationId: "invite_2",
          invitationPath: "/invite/token_456",
          expiresAt: new Date("2026-04-20T00:00:00.000Z"),
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
    viewerOfficeId: "office_1",
  });
  assert.deepEqual(await readJson(response), {
    membershipId: "membership_2",
    invitationId: "invite_2",
    invitationUrl: "https://acresystem.us/invite/token_456",
    expiresAt: "2026-04-20T00:00:00.000Z",
  });
});
