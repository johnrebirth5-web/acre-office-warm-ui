import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeUserPost } from "./route";

function createOfficeUsersRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/settings/users`, {
    method: "POST",
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

test("handleCreateOfficeUserPost returns 400 validation_error for unsupported role payloads", async () => {
  const response = await handleCreateOfficeUserPost(
    createOfficeUsersRequest(
      JSON.stringify({
        email: "agent@example.com",
        role: "super_admin",
      }),
    ),
    createSessionContext({ canManageOfficeSettings: true }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "User invitation payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      role: "A supported Back Office role is required.",
    },
  });
});

test("handleCreateOfficeUserPost preserves the admin-tier 403 guard", async () => {
  const response = await handleCreateOfficeUserPost(
    createOfficeUsersRequest(
      JSON.stringify({
        email: "owner@example.com",
        role: "office_admin",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), {
    error: "Only Owner / Office Admin can assign admin-tier roles.",
  });
});

test("handleCreateOfficeUserPost passes normalized payload and invitation URL through on success", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeUserPost(
    createOfficeUsersRequest(
      JSON.stringify({
        email: "agent@example.com",
        firstName: "Acre",
        lastName: "Agent",
        role: "agent",
        defaultOfficeId: "__all__",
        officeId: "office_2",
        accessibleOfficeIds: ["office_2", "office_3"],
      }),
    ),
    createSessionContext({ canManageOfficeSettings: true }),
    {
      createInvitedUser: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          membershipId: "membership_2",
          userId: "user_2",
          invitationId: "invite_2",
          invitationPath: "/invite/token_123",
          expiresAt: new Date("2026-04-20T00:00:00.000Z"),
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    viewerOfficeId: "office_1",
    email: "agent@example.com",
    firstName: "Acre",
    lastName: "Agent",
    role: "agent",
    defaultOfficeId: "office_2",
    accessibleOfficeIds: ["office_2", "office_3"],
    officeId: "office_2",
    title: null,
    splitTemplateId: undefined,
    customAgentPercent: undefined,
    commissionEffectiveFrom: undefined,
    teamId: undefined,
    reportsToTeamMembershipId: undefined,
  });
  assert.deepEqual(await readJson(response), {
    membershipId: "membership_2",
    userId: "user_2",
    invitationId: "invite_2",
    invitationUrl: "https://acresystem.us/invite/token_123",
    expiresAt: "2026-04-20T00:00:00.000Z",
    email: "agent@example.com",
  });
});
