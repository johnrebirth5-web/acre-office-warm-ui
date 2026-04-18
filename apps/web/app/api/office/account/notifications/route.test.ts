import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeAccountNotificationsPatch } from "./route";

function createAccountNotificationsRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/account/notifications`, {
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
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateOfficeAccountNotificationsPatch returns 400 validation_error for incomplete preference payloads", async () => {
  const response = await handleUpdateOfficeAccountNotificationsPatch(
    createAccountNotificationsRequest(
      JSON.stringify({
        inAppEnabled: true,
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Valid notification preferences are required.",
    errorCode: "validation_error",
    fieldErrors: {
      approvalAlertsEnabled: "Invalid input: expected boolean, received undefined",
      taskRemindersEnabled: "Invalid input: expected boolean, received undefined",
      offerAlertsEnabled: "Invalid input: expected boolean, received undefined",
      messageAlertsEnabled: "Invalid input: expected boolean, received undefined",
    },
  });
});

test("handleUpdateOfficeAccountNotificationsPatch forwards normalized preferences", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeAccountNotificationsPatch(
    createAccountNotificationsRequest(
      JSON.stringify({
        inAppEnabled: true,
        approvalAlertsEnabled: false,
        taskRemindersEnabled: true,
        offerAlertsEnabled: false,
        messageAlertsEnabled: true,
      }),
    ),
    createSessionContext(),
    {
      saveOfficeAccountNotificationPreferences: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          membershipId: "membership_1",
          inAppEnabled: true,
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    membershipId: "membership_1",
    inAppEnabled: true,
    approvalAlertsEnabled: false,
    taskRemindersEnabled: true,
    offerAlertsEnabled: false,
    messageAlertsEnabled: true,
  });
  assert.deepEqual(await readJson(response), {
    ok: true,
    saved: {
      membershipId: "membership_1",
      inAppEnabled: true,
    },
  });
});

