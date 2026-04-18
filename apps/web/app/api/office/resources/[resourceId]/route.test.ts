import assert from "node:assert/strict";
import test from "node:test";
import { ResourceType } from "@prisma/client";
import { NextRequest } from "next/server";
import { handleUpdateOfficeResourcePatch } from "./route";

function createResourceRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/resources/resource_1`, {
    method: "PATCH",
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

test("handleUpdateOfficeResourcePatch returns 400 validation_error for unsupported resource types", async () => {
  const response = await handleUpdateOfficeResourcePatch(
    createResourceRequest(
      JSON.stringify({
        type: ResourceType.document,
      }),
    ),
    "resource_1",
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

test("handleUpdateOfficeResourcePatch forwards normalized training video payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeResourcePatch(
    createResourceRequest(
      JSON.stringify({
        title: "Updated title",
        summary: "Updated summary",
        url: "https://example.com/updated-video",
        tags: ["training", "updated"],
        type: ResourceType.training_video,
      }),
    ),
    "resource_1",
    createOfficeAdminContext(),
    {
      updateOfficeResource: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "resource_1",
          previousStorageKey: null,
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    resourceId: "resource_1",
    title: "Updated title",
    summary: "Updated summary",
    url: "https://example.com/updated-video",
    tags: ["training", "updated"],
    type: ResourceType.training_video,
    visibilityScope: "organization_wide",
  });
  assert.deepEqual(await readJson(response), {
    resourceId: "resource_1",
  });
});

