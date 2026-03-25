import assert from "node:assert/strict";
import test from "node:test";
import {
  can,
  canAccessAccountActivity,
  canAccessOfficeAdminAccountingWorkspace,
  canAccessOfficeAccounting,
  canCommentOfficeActivity,
  canCommentOfficeOffers,
  canCreateOfficeContacts,
  canCreateOfficeTransactions,
  canEditOfficeContacts,
  canEditOfficeTransactions,
  canLinkOfficeContacts,
  canManageOfficeSettings,
  canManageOfficeTransactionStatus,
  canManageOfficeTransactionFinance,
  canManageOfficeUsers,
  canSecondaryReviewOfficeTasks,
  canViewOfficeAgentBilling,
  canViewOfficeCommissionSelfServiceSummary,
  canViewOfficeContacts,
  canViewOfficeCommissions,
  canViewOfficeReports,
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
  assert.equal(canManageOfficeTransactionStatus("office_admin"), true);
  assert.equal(canSecondaryReviewOfficeTasks("office_admin"), true);
  assert.equal(canAccessOfficeAdminAccountingWorkspace("office_admin"), true);
  assert.equal(canCommentOfficeActivity("office_admin"), true);
  assert.equal(canCommentOfficeOffers("office_admin"), true);
});

test("owner keeps full office-admin level control", () => {
  assert.equal(canManageOfficeUsers("owner"), true);
  assert.equal(canManageOfficeSettings("owner"), true);
  assert.equal(canManageOfficeTransactionStatus("owner"), true);
  assert.equal(canManageOfficeTransactionFinance("owner"), true);
  assert.equal(canViewOfficeReports("owner"), true);
  assert.equal(canAccessOfficeAdminAccountingWorkspace("owner"), false);
});

test("accountant and human resources keep Tier 2 reporting access without transaction finance editing", () => {
  assert.equal(canManageOfficeUsers("accountant"), true);
  assert.equal(canViewOfficeReports("accountant"), true);
  assert.equal(canManageOfficeTransactionFinance("accountant"), false);
  assert.equal(canManageOfficeUsers("human_resources"), true);
  assert.equal(canViewOfficeReports("human_resources"), true);
  assert.equal(canManageOfficeTransactionFinance("human_resources"), false);
});

test("team lead keeps scoped pipeline access without admin-only settings", () => {
  assert.equal(canViewOfficeTransactions("team_lead"), true);
  assert.equal(canCreateOfficeTransactions("team_lead"), true);
  assert.equal(canEditOfficeTransactions("team_lead"), true);
  assert.equal(canManageOfficeTransactionStatus("team_lead"), false);
  assert.equal(canAccessOfficeAccounting("team_lead"), false);
  assert.equal(canViewOfficeAgentBilling("team_lead"), true);
  assert.equal(canViewOfficeContacts("team_lead"), true);
  assert.equal(canViewOfficeReports("team_lead"), true);
  assert.equal(canViewOfficeCommissions("team_lead"), true);
  assert.equal(canManageOfficeUsers("team_lead"), false);
  assert.equal(canManageOfficeSettings("team_lead"), false);
  assert.equal(canManageOfficeTransactionFinance("team_lead"), false);
});

test("agent role keeps scoped pipeline access without finance or admin-only powers", () => {
  assert.equal(canViewOfficeTransactions("agent"), true);
  assert.equal(canCreateOfficeTransactions("agent"), true);
  assert.equal(canEditOfficeTransactions("agent"), true);
  assert.equal(canManageOfficeTransactionStatus("agent"), false);
  assert.equal(canManageOfficeTransactionFinance("agent"), false);
  assert.equal(canAccessOfficeAccounting("agent"), false);
  assert.equal(canViewOfficeAgentBilling("agent"), true);
  assert.equal(canViewOfficeContacts("agent"), true);
  assert.equal(canViewOfficeCommissions("agent"), true);
  assert.equal(canCreateOfficeContacts("agent"), true);
  assert.equal(canEditOfficeContacts("agent"), true);
  assert.equal(canLinkOfficeContacts("agent"), true);
  assert.equal(canCommentOfficeActivity("agent"), false);
  assert.equal(canCommentOfficeOffers("agent"), false);
  assert.equal(canManageOfficeUsers("agent"), false);
  assert.equal(canManageOfficeSettings("agent"), false);
  assert.equal(canViewOfficeReports("agent"), true);
});

test("commission self-service dashboard summary follows dashboard access instead of sales-only roles", () => {
  assert.equal(canViewOfficeCommissionSelfServiceSummary("agent"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("team_lead"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("office_admin"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("owner"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("accountant"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("human_resources"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("office_manager"), true);
  assert.equal(canViewOfficeCommissionSelfServiceSummary("office_user"), true);
});

test("required commission visibility baselines survive narrowed permission snapshots", () => {
  assert.equal(can({ role: "agent", permissions: ["dashboard:view"] }, "commissions:view"), true);
  assert.equal(
    can(
      {
        role: "team_lead",
        permissions: ["dashboard:view", "transactions:view", "transactions:view:team"]
      },
      "commissions:view:team"
    ),
    true
  );
});

test("office user keeps internal read access without admin-only powers", () => {
  assert.equal(can("office_user", "dashboard:view"), true);
  assert.equal(canAccessAccountActivity("office_user"), true);
  assert.equal(canViewOfficeTransactions("office_user"), true);
  assert.equal(canViewOfficeContacts("office_user"), true);
  assert.equal(canAccessOfficeAdminAccountingWorkspace("office_user"), false);
  assert.equal(canManageOfficeTransactionStatus("office_user"), false);
  assert.equal(canManageOfficeUsers("office_user"), false);
  assert.equal(canManageOfficeSettings("office_user"), false);
  assert.equal(canCreateOfficeTransactions("office_user"), false);
  assert.equal(canCreateOfficeContacts("office_user"), false);
});
