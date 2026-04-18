import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleEmailDeliveryPatch } from "./route";

function createEmailDeliveryPatchRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/settings/email-delivery`, {
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
    },
    currentOrganization: {
      id: "org_1",
    },
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleEmailDeliveryPatch returns 400 validation_error for invalid payload types", async () => {
  const response = await handleEmailDeliveryPatch(
    createEmailDeliveryPatchRequest(
      JSON.stringify({
        isEnabled: true,
        port: "587",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Email delivery settings payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      port: "Invalid input: expected number, received string",
    },
  });
});

test("handleEmailDeliveryPatch persists the parsed payload when validation succeeds", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleEmailDeliveryPatch(
    createEmailDeliveryPatchRequest(
      JSON.stringify({
        isEnabled: true,
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "mailer",
        password: "secret",
        fromEmail: "ops@example.com",
        fromName: "Acre Ops",
        replyTo: "reply@example.com",
      }),
    ),
    createSessionContext(),
    {
      saveOrganizationSmtpSettings: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "smtp_1" } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    isEnabled: true,
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "mailer",
    password: "secret",
    fromEmail: "ops@example.com",
    fromName: "Acre Ops",
    replyTo: "reply@example.com",
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      id: "smtp_1",
    },
  });
});
