import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeActivityCommentPost } from "./route";

function createCommentRequest(
  body: string,
  origin = "http://localhost:3105"
) {
  return new NextRequest(`${origin}/api/office/activity/comments`, {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      role: "office_admin",
      permissions: []
    },
    currentOrganization: {
      id: "org_1",
      name: "Acre"
    },
    currentOffice: {
      id: "office_1",
      name: "Midtown"
    }
  } as never;
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("handleCreateOfficeActivityCommentPost returns 400 validation_error for blank comments", async () => {
  const response = await handleCreateOfficeActivityCommentPost(
    createCommentRequest(
      JSON.stringify({
        body: "   "
      })
    ),
    createSessionContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Comment body is required.",
    errorCode: "validation_error",
    fieldErrors: {
      body: "Comment body is required."
    }
  });
});

test("handleCreateOfficeActivityCommentPost forwards normalized comment payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeActivityCommentPost(
    createCommentRequest(
      JSON.stringify({
        body: "Follow up with escrow",
        scopeLabel: " Escrow desk "
      })
    ),
    createSessionContext(),
    {
      addOfficeActivityComment: async (input) => {
        capturedInput = input as Record<string, unknown>;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    membershipId: "membership_1",
    scopeLabel: "Escrow desk",
    body: "Follow up with escrow",
    contextHref: "/office/activity?view=activity&objectType=comment"
  });
  assert.deepEqual(await readJson(response), {
    ok: true
  });
});
