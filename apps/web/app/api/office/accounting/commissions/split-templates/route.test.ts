import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { handleCreateCommissionSplitTemplatePost } from "./route";

function createSplitTemplateRequest(body: string, origin = "http://localhost:3105") {
  return new NextRequest(`${origin}/api/office/accounting/commissions/split-templates`, {
    method: "POST",
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

test("handleCreateCommissionSplitTemplatePost returns 400 validation_error when agentPercent is blank", async () => {
  const response = await handleCreateCommissionSplitTemplatePost(
    createSplitTemplateRequest(
      JSON.stringify({
        name: "Standard split",
        agentPercent: "   "
      })
    ),
    createAccountingContext()
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Commission split template payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      agentPercent: "agentPercent is required."
    }
  });
});

test("handleCreateCommissionSplitTemplatePost forwards validated split template payloads", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleCreateCommissionSplitTemplatePost(
    createSplitTemplateRequest(
      JSON.stringify({
        name: "Standard split",
        agentPercent: "70",
        isActive: false
      })
    ),
    createAccountingContext(),
    {
      saveCommissionSplitTemplate: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          id: "template_1"
        } as never;
      }
    }
  );

  assert.equal(response.status, 201);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    officeId: "office_1",
    name: "Standard split",
    agentPercent: "70",
    isActive: false,
    actorMembershipId: "membership_actor"
  });
  assert.deepEqual(await readJson(response), {
    splitTemplate: {
      id: "template_1"
    }
  });
});
