import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleUpdateCommissionSplitTemplatePatch } from "./route";

function createSplitTemplateRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/split-templates/template_1`, {
    method: "PATCH",
    body,
    headers: {
      origin,
      "content-type": "application/json"
    }
  });
}

function createAccountingContext() {
  return {
    currentMembership: {
      id: "membership_actor",
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

test("handleUpdateCommissionSplitTemplatePatch returns 400 validation_error for invalid isActive type", async () => {
  const response = await handleUpdateCommissionSplitTemplatePatch(
    createSplitTemplateRequest(
      JSON.stringify({
        name: "Updated split",
        agentPercent: "65",
        isActive: "yes"
      })
    ),
    createAccountingContext(),
    "template_1"
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission split template payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      isActive: "Invalid input: expected boolean, received string"
    }
  });
});

test("handleUpdateCommissionSplitTemplatePatch forwards validated update payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateCommissionSplitTemplatePatch(
    createSplitTemplateRequest(
      JSON.stringify({
        name: "Updated split",
        agentPercent: "65",
        isActive: true
      })
    ),
    createAccountingContext(),
    "template_1",
    {
      saveCommissionSplitTemplate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "template_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    splitTemplateId: "template_1",
    name: "Updated split",
    agentPercent: "65",
    isActive: true,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    splitTemplate: {
      id: "template_1"
    }
  });
});
