import assert from "node:assert/strict";
import test from "node:test";
import { ResourceType } from "@prisma/client";
import { NextRequest } from "next/server";
import { handleCreateOfficeResourcePost } from "./route";

function createResourceRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/resources`, {
    method: "POST",
    body,
    headers: {
      origin,
      "content-type": "application/json",
    },
  });
}

function createOfficeAdminContext() {
  return {
    currentMembership: {
      id: "membership_1",
      role: "office_admin",
      permissions: [],
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

test("handleCreateOfficeResourcePost returns 400 validation_error for unsupported resource types", async () => {
  const response = await handleCreateOfficeResourcePost(
    createResourceRequest(
      JSON.stringify({
        type: ResourceType.document,
      }),
    ),
    createOfficeAdminContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "A supported resource type is required.",
    errorCode: "validation_error",
    fieldErrors: {
      type: `Invalid input: expected \"${ResourceType.training_video}\"`,
    },
  });
});

test("handleCreateOfficeResourcePost forwards normalized training video payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeResourcePost(
    createResourceRequest(
      JSON.stringify({
        title: "Listing walkthrough",
        summary: "Intro video",
        url: "https://example.com/video",
        tags: ["training", "video"],
        type: ResourceType.training_video,
      }),
    ),
    createOfficeAdminContext(),
    {
      createOfficeResource: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "resource_1";
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    title: "Listing walkthrough",
    summary: "Intro video",
    url: "https://example.com/video",
    tags: ["training", "video"],
    type: ResourceType.training_video,
    visibilityScope: "organization_wide",
  });
  assert.deepEqual(await readJson(response), {
    resourceId: "resource_1",
  });
});

