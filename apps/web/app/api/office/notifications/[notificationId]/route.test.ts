import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeNotificationPatch } from "./route";

function createNotificationRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/notifications/notification_1`, {
    method: "PATCH",
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
      permissions: ["notifications:view"],
      role: "office_user",
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

test("handleUpdateOfficeNotificationPatch returns 400 validation_error for unsupported actions", async () => {
  const response = await handleUpdateOfficeNotificationPatch(
    createNotificationRequest(
      JSON.stringify({
        action: "dismiss",
      }),
    ),
    "notification_1",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid notification action is required.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "Invalid option: expected one of \"mark_read\"|\"mark_unread\"|\"archive\"|\"unarchive\"",
    },
  });
});

test("handleUpdateOfficeNotificationPatch routes archive actions through archiveOfficeNotification", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeNotificationPatch(
    createNotificationRequest(
      JSON.stringify({
        action: "archive",
      }),
    ),
    "notification_1",
    createSessionContext(),
    {
      archiveOfficeNotification: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return true;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    notificationId: "notification_1",
  });
  assert.deepEqual(await readJson(response), {
    ok: true,
  });
});

