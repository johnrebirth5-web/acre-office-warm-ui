import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSignatureDrivePatch } from "./route";

function createSignatureDrivePatchRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/settings/signature-drive`, {
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

test("handleSignatureDrivePatch returns 400 validation_error for invalid folderMappings payloads", async () => {
  const response = await handleSignatureDrivePatch(
    createSignatureDrivePatchRequest(
      JSON.stringify({
        isEnabled: true,
        folderMappings: "bad-value",
      }),
    ),
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Signature Drive settings payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      folderMappings: "Invalid input: expected object, received string",
    },
  });
});

test("handleSignatureDrivePatch persists normalized folder mappings when validation succeeds", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleSignatureDrivePatch(
    createSignatureDrivePatchRequest(
      JSON.stringify({
        isEnabled: true,
        clientEmail: "service@example.com",
        privateKey: "private-key",
        rootFolderId: "root-folder",
        folderMappings: {
          transaction: "tx-folder",
        },
      }),
    ),
    createSessionContext(),
    {
      saveOrganizationSignatureDriveSettings: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "drive_1" } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    isEnabled: true,
    projectId: "",
    clientEmail: "service@example.com",
    clientId: "",
    privateKeyId: "",
    privateKey: "private-key",
    sharedDriveId: "",
    rootFolderId: "root-folder",
    folderMappings: {
      hr: "",
      finance: "",
      admin: "",
      transaction: "tx-folder",
      generic: "",
    },
  });
  assert.deepEqual(await readJson(response), {
    snapshot: {
      id: "drive_1",
    },
  });
});
