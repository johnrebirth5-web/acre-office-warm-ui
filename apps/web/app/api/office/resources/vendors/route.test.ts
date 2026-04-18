import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateOfficeVendorPost } from "./route";

function createVendorRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/resources/vendors`, {
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

test("handleCreateOfficeVendorPost returns 400 validation_error for non-array neighborhoods", async () => {
  const response = await handleCreateOfficeVendorPost(
    createVendorRequest(
      JSON.stringify({
        name: "Mover",
        neighborhoods: "Upper West Side",
      }),
    ),
    createOfficeAdminContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Vendor payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      neighborhoods: "Invalid input: expected array, received string",
    },
  });
});

test("handleCreateOfficeVendorPost forwards normalized vendor payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateOfficeVendorPost(
    createVendorRequest(
      JSON.stringify({
        category: "staging",
        name: "Staging Co",
        headline: "Fast turnarounds",
        phone: "555-0100",
        email: "hello@example.com",
        website: "https://example.com",
        neighborhoods: ["Chelsea", "Tribeca"],
        notes: "Preferred vendor",
        isFeatured: true,
      }),
    ),
    createOfficeAdminContext(),
    {
      createOfficeVendor: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "vendor_1";
      },
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    category: "staging",
    name: "Staging Co",
    headline: "Fast turnarounds",
    phone: "555-0100",
    email: "hello@example.com",
    website: "https://example.com",
    neighborhoods: ["Chelsea", "Tribeca"],
    notes: "Preferred vendor",
    isFeatured: true,
    visibilityScope: "organization_wide",
  });
  assert.deepEqual(await readJson(response), {
    vendorId: "vendor_1",
  });
});

