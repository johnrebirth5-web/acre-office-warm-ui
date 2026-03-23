import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeDataScope } from "./access.ts";
import { canViewCrossMemberFinancials } from "./access.ts";

function buildScope(viewerPermissions: OfficeDataScope["viewerPermissions"]): OfficeDataScope {
  return {
    viewerMembershipId: "viewer-membership",
    viewerRole: "agent",
    viewerPermissions,
    officeId: "office-id",
    kind: "self",
    visibleMembershipIds: ["viewer-membership"],
    visibleTeamIds: [],
    visibleTeamMembershipIds: []
  };
}

test("accounting billing self-service access does not unlock cross-member financial visibility", () => {
  assert.equal(canViewCrossMemberFinancials(buildScope(["accounting:billing:view"])), false);
  assert.equal(canViewCrossMemberFinancials(buildScope(["accounting:view"])), true);
  assert.equal(canViewCrossMemberFinancials(buildScope(["transactions:finance"])), true);
});
