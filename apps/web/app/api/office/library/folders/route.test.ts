import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateLibraryFolderPost } from "./route";

function createFolderRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/library/folders`, {
    method: "POST",
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

test("handleCreateLibraryFolderPost returns 400 validation_error when folder name is blank", async () => {
  const response = await handleCreateLibraryFolderPost(
    createFolderRequest(
      JSON.stringify({
        name: "   "
      })
    ),
    createOfficeAdminContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Folder payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      name: "Folder name is required."
    }
  });
});

test("handleCreateLibraryFolderPost forwards normalized folder payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateLibraryFolderPost(
    createFolderRequest(
      JSON.stringify({
        name: "Guides",
        description: "Office-only playbooks",
        parentFolderId: "folder_parent",
        scope: "office_only"
      })
    ),
    createOfficeAdminContext(),
    {
      createLibraryFolder: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "folder_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    currentOfficeId: "office_1",
    actorMembershipId: "membership_1",
    name: "Guides",
    description: "Office-only playbooks",
    parentFolderId: "folder_parent",
    scope: "office_only"
  });
  assert.deepEqual(await readJson(response), {
    folder: {
      id: "folder_1"
    }
  });
});
