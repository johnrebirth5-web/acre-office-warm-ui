import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateLibraryDocumentPatch } from "./route";

function createDocumentRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/library/documents/document_1`, {
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

test("handleUpdateLibraryDocumentPatch returns 400 validation_error for non-array tags", async () => {
  const response = await handleUpdateLibraryDocumentPatch(
    createDocumentRequest(
      JSON.stringify({
        tags: "forms"
      })
    ),
    "document_1",
    createOfficeAdminContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Document payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      tags: "Invalid input: expected array, received string"
    }
  });
});

test("handleUpdateLibraryDocumentPatch forwards normalized document payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateLibraryDocumentPatch(
    createDocumentRequest(
      JSON.stringify({
        title: "Updated title",
        folderId: null,
        summary: "Fresh summary",
        category: "Forms",
        tags: ["forms", "office"],
        visibility: "office_only"
      })
    ),
    "document_1",
    createOfficeAdminContext(),
    {
      updateLibraryDocument: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "document_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    currentOfficeId: "office_1",
    actorMembershipId: "membership_1",
    documentId: "document_1",
    title: "Updated title",
    folderId: null,
    summary: "Fresh summary",
    category: "Forms",
    tags: ["forms", "office"],
    visibility: "office_only"
  });
  assert.deepEqual(await readJson(response), {
    document: {
      id: "document_1"
    }
  });
});
