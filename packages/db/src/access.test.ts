import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeDataScope } from "./access.ts";
import { canViewCrossMemberFinancials, excludeSystemAnchors } from "./access.ts";

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

test("transaction visibility helpers exclude project signing system anchors", () => {
  assert.deepEqual(excludeSystemAnchors(), {
    isSystemArchiveAnchor: false,
    status: {
      not: "system_anchor",
    },
  });
});
