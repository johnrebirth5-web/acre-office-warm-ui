import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminGpt } from "./access";

test("canAccessAdminGpt allows owner and office_admin with ai access", () => {
  assert.equal(canAccessAdminGpt("owner"), true);
  assert.equal(canAccessAdminGpt("office_admin"), true);
});

test("canAccessAdminGpt rejects non-admin roles", () => {
  assert.equal(canAccessAdminGpt("agent"), false);
  assert.equal(canAccessAdminGpt("office_manager"), false);
});

test("canAccessAdminGpt requires explicit ai access when custom permissions are supplied", () => {
  assert.equal(
    canAccessAdminGpt({
      permissions: ["settings:view"],
      role: "office_admin",
    }),
    false,
  );
  assert.equal(
    canAccessAdminGpt({
      permissions: ["settings:view", "ai:use"],
      role: "office_admin",
    }),
    true,
  );
});
