import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  handleResetOfficeUserPermissionsDelete,
  handleUpdateOfficeUserPermissionsPatch,
} from "./route";

function createPermissionsPatchRequest(
  body: string,
  origin = "http://localhost:3105",
) {
  return new NextRequest(
    `${origin}/api/office/settings/users/membership_2/permissions`,
    {
      method: "PATCH",
      body,
      headers: {
        origin,
        "content-type": "application/json",
      },
    },
  );
}

function createPermissionsDeleteRequest(
  search = "",
  origin = "http://localhost:3105",
) {
  const suffix = search ? `?${search}` : "";
  return new NextRequest(
    `${origin}/api/office/settings/users/membership_2/permissions${suffix}`,
    {
      method: "DELETE",
      headers: {
        origin,
      },
    },
  );
}

function createSessionContext() {
  return {
    currentMembership: {
      id: "membership_1",
      permissions: ["settings.manage"],
      role: "office_admin",
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

test("handleUpdateOfficeUserPermissionsPatch returns 400 validation_error for unsupported override effects", async () => {
  const response = await handleUpdateOfficeUserPermissionsPatch(
    createPermissionsPatchRequest(
      JSON.stringify({
        overrides: [
          {
            permissionKey: "settings:manage",
            effect: "inherit",
          },
        ],
      }),
    ),
    "membership_2",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Permission override payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      "overrides[0].effect": "Permission override effect must be allow or deny.",
    },
  });
});

test("handleUpdateOfficeUserPermissionsPatch requires officeId for company scope", async () => {
  const response = await handleUpdateOfficeUserPermissionsPatch(
    createPermissionsPatchRequest(
      JSON.stringify({
        scope: "company",
        overrides: [],
      }),
    ),
    "membership_2",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Permission override payload is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      officeId: "Company scope requires an officeId.",
    },
  });
});

test("handleUpdateOfficeUserPermissionsPatch passes normalized company overrides through on success", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleUpdateOfficeUserPermissionsPatch(
    createPermissionsPatchRequest(
      JSON.stringify({
        scope: "company",
        officeId: "office_2",
        overrides: [
          {
            permissionKey: "settings:manage",
            effect: "allow",
          },
          {
            permissionKey: "notifications:view",
            effect: "deny",
          },
        ],
      }),
    ),
    "membership_2",
    createSessionContext(),
    {
      saveMembershipOfficePermissionOverrides: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          scope: "company",
          officeId: "office_2",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
    viewerOfficeId: "office_1",
    officeId: "office_2",
    overrides: [
      {
        permissionKey: "settings:manage",
        effect: "allow",
      },
      {
        permissionKey: "notifications:view",
        effect: "deny",
      },
    ],
  });
  assert.deepEqual(await readJson(response), {
    permissions: {
      scope: "company",
      officeId: "office_2",
    },
  });
});

test("handleResetOfficeUserPermissionsDelete validates company scope query before calling the service", async () => {
  const response = await handleResetOfficeUserPermissionsDelete(
    createPermissionsDeleteRequest("scope=company"),
    "membership_2",
    createSessionContext(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    error: "Permission reset request is invalid.",
    errorCode: "validation_error",
    fieldErrors: {
      officeId: "Company scope requires an officeId.",
    },
  });
});

test("handleResetOfficeUserPermissionsDelete passes company scope reset through on success", async () => {
  let capturedInput: Record<string, unknown> | null = null;

  const response = await handleResetOfficeUserPermissionsDelete(
    createPermissionsDeleteRequest("scope=company&officeId=office_2"),
    "membership_2",
    createSessionContext(),
    {
      resetMembershipOfficePermissionOverrides: async (input) => {
        capturedInput = input as Record<string, unknown>;
        return {
          scope: "company",
          officeId: "office_2",
        } as never;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capturedInput, {
    organizationId: "org_1",
    actorMembershipId: "membership_1",
    membershipId: "membership_2",
    viewerOfficeId: "office_1",
    officeId: "office_2",
  });
  assert.deepEqual(await readJson(response), {
    permissions: {
      scope: "company",
      officeId: "office_2",
    },
  });
});
