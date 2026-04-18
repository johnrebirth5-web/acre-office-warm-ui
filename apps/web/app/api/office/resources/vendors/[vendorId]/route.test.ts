import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateOfficeVendorPatch } from "./route";

function createVendorRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(`${origin}/api/office/resources/vendors/vendor_1`, {
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

test("handleUpdateOfficeVendorPatch returns 400 validation_error for non-array neighborhoods", async () => {
  const response = await handleUpdateOfficeVendorPatch(
    createVendorRequest(
      JSON.stringify({
        name: "Updated Vendor",
        neighborhoods: "Upper West Side",
      }),
    ),
    "vendor_1",
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

test("handleUpdateOfficeVendorPatch forwards normalized vendor payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeVendorPatch(
    createVendorRequest(
      JSON.stringify({
        category: "photography",
        name: "Photo Co",
        headline: "Bright interiors",
        phone: "555-0101",
        email: "photo@example.com",
        website: "https://example.com/photo",
        neighborhoods: ["Soho"],
        notes: "Updated vendor",
        isFeatured: false,
      }),
    ),
    "vendor_1",
    createOfficeAdminContext(),
    {
      updateOfficeVendor: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return "vendor_1";
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    vendorId: "vendor_1",
    category: "photography",
    name: "Photo Co",
    headline: "Bright interiors",
    phone: "555-0101",
    email: "photo@example.com",
    website: "https://example.com/photo",
    neighborhoods: ["Soho"],
    notes: "Updated vendor",
    isFeatured: false,
    visibilityScope: "organization_wide",
  });
  assert.deepEqual(await readJson(response), {
    vendorId: "vendor_1",
  });
});

