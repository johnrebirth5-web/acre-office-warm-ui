import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleSaveSignatureTemplatePost } from "./route";

function createRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/signatures/templates`, {
    method: "POST",
    body,
    headers: { origin, "content-type": "application/json" }
  });
}

function createContext() {
  return {
    currentMembership: { id: "membership_actor", role: "owner", permissions: [] },
    currentOrganization: { id: "org_1" },
    currentOffice: { id: "office_1" }
  } as never;
}

test("handleSaveSignatureTemplatePost returns 400 validation_error for invalid recipient role", async () => {
  const response = await handleSaveSignatureTemplatePost(
    createRequest(JSON.stringify({ name: "Offer", recipients: [{ role: "viewer", recipientRole: "Buyer" }], fields: [] })),
    createContext()
  );
  assert.equal(response.status, 400);
});

test("handleSaveSignatureTemplatePost forwards validated payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;
  const response = await handleSaveSignatureTemplatePost(
    createRequest(
      JSON.stringify({
        name: "Offer",
        category: "transaction",
        recipients: [{ role: "signer", recipientRole: "Buyer" }],
        fields: [{ fieldType: "signature", label: "Buyer sig", page: 1, x: 10, y: 10, width: 100, height: 20 }]
      })
    ),
    createContext(),
    {
      saveSignatureTemplate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return { id: "template_1" } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.equal(capturedInput?.["name"], "Offer");
});
