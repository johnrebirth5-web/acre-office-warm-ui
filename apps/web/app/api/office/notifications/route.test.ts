import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleMarkOfficeNotificationsPost } from "./route";

function createNotificationsRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/notifications`, {
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

test("handleMarkOfficeNotificationsPost returns 400 validation_error for unsupported actions", async () => {
  const response = await handleMarkOfficeNotificationsPost(
    createNotificationsRequest(
      JSON.stringify({
        action: "archive_all",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A valid notification action is required.",
    errorCode: "validation_error",
    fieldErrors: {
      action: "Invalid input: expected \"mark_all_read\"",
    },
  });
});

test("handleMarkOfficeNotificationsPost routes explicit ids through markOfficeNotificationsReadByIds", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleMarkOfficeNotificationsPost(
    createNotificationsRequest(
      JSON.stringify({
        action: "mark_all_read",
        notificationIds: ["notification_1", "notification_2"],
      }),
    ),
    createSessionContext(),
    {
      markOfficeNotificationsReadByIds: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return 2;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    notificationIds: ["notification_1", "notification_2"],
  });
  assert.deepEqual(await readJson(response), {
    updatedCount: 2,
  });
});

