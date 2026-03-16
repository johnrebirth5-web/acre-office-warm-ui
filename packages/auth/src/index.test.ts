import assert from "node:assert/strict";
import test from "node:test";
import {
  can,
  canAccessAccountActivity,
  canCommentOfficeActivity,
  canCommentOfficeOffers,
  canCreateOfficeContacts,
  canCreateOfficeTransactions,
  canEditOfficeContacts,
  canEditOfficeTransactions,
  canLinkOfficeContacts,
  canManageOfficeSettings,
  canManageOfficeTransactionFinance,
  canManageOfficeUsers,
  canSecondaryReviewOfficeTasks,
  canViewOfficeContacts,
  canViewOfficeTransactions
} from "./index.ts";

test("office manager keeps operational write access but not admin-only settings management", () => {
  assert.equal(canViewOfficeTransactions("office_manager"), true);
  assert.equal(canCreateOfficeTransactions("office_manager"), true);
  assert.equal(canEditOfficeTransactions("office_manager"), true);
  assert.equal(canManageOfficeTransactionFinance("office_manager"), true);
  assert.equal(canViewOfficeContacts("office_manager"), true);
  assert.equal(canCreateOfficeContacts("office_manager"), true);
  assert.equal(canEditOfficeContacts("office_manager"), true);
  assert.equal(canLinkOfficeContacts("office_manager"), true);
  assert.equal(canCommentOfficeActivity("office_manager"), true);
  assert.equal(canCommentOfficeOffers("office_manager"), true);
  assert.equal(canManageOfficeUsers("office_manager"), false);
  assert.equal(canManageOfficeSettings("office_manager"), false);
});

test("office admin retains admin-only powers and secondary review access", () => {
  assert.equal(canManageOfficeUsers("office_admin"), true);
  assert.equal(canManageOfficeSettings("office_admin"), true);
  assert.equal(canSecondaryReviewOfficeTasks("office_admin"), true);
  assert.equal(canCommentOfficeActivity("office_admin"), true);
  assert.equal(canCommentOfficeOffers("office_admin"), true);
});

test("agent role does not inherit office write permissions", () => {
  assert.equal(canViewOfficeTransactions("agent"), false);
  assert.equal(canCreateOfficeTransactions("agent"), false);
  assert.equal(canEditOfficeTransactions("agent"), false);
  assert.equal(canManageOfficeTransactionFinance("agent"), false);
  assert.equal(canViewOfficeContacts("agent"), false);
  assert.equal(canCreateOfficeContacts("agent"), false);
  assert.equal(canEditOfficeContacts("agent"), false);
  assert.equal(canLinkOfficeContacts("agent"), false);
  assert.equal(canCommentOfficeActivity("agent"), false);
  assert.equal(canCommentOfficeOffers("agent"), false);
});

test("office user keeps internal read access without admin-only powers", () => {
  assert.equal(can("office_user", "dashboard:view"), true);
  assert.equal(canAccessAccountActivity("office_user"), true);
  assert.equal(canViewOfficeTransactions("office_user"), true);
  assert.equal(canViewOfficeContacts("office_user"), true);
  assert.equal(canManageOfficeUsers("office_user"), false);
  assert.equal(canManageOfficeSettings("office_user"), false);
  assert.equal(canCreateOfficeTransactions("office_user"), false);
  assert.equal(canCreateOfficeContacts("office_user"), false);
});
