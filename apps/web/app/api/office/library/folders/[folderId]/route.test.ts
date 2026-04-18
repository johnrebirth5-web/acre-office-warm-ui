import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateLibraryFolderPatch } from "./route";

function createFolderRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/library/folders/folder_1`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createOfficeAdminContext() {
  return {
    currentMembership: {
      id: "membership_1",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1"
    },
    currentOffice: {
      id: "office_1"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleUpdateLibraryFolderPatch returns 400 validation_error for invalid isActive types", async () => {
  const response = await handleUpdateLibraryFolderPatch(
    createFolderRequest(
      JSON.stringify({
        isActive: "false"
      })
    ),
    "folder_1",
    createOfficeAdminContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Folder payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      isActive: "Invalid input: expected boolean, received string"
    }
  });
});

test("handleUpdateLibraryFolderPatch forwards normalized folder updates", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateLibraryFolderPatch(
    createFolderRequest(
      JSON.stringify({
        name: "Updated folder",
        description: null,
        isActive: false
      })
    ),
    "folder_1",
    createOfficeAdminContext(),
    {
      updateLibraryFolder: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "folder_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    currentOfficeId: "office_1",
    actorMembershipId: "membership_1",
    folderId: "folder_1",
    name: "Updated folder",
    description: null,
    isActive: false
  });
  assert.deepEqual(await readJson(response), {
    folder: {
      id: "folder_1"
    }
  });
});
