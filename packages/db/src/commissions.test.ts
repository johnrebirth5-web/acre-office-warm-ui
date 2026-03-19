import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { normalizeTransactionFinanceFeeForPersistence } from "./commissions.ts";

test("clearing a finance fee removes stored rate and amount instead of restoring defaults", () => {
  const normalized = normalizeTransactionFinanceFeeForPersistence({
    feeType: "rebate",
    grossCommission: new Prisma.Decimal(100000),
    existingRate: new Prisma.Decimal(20),
    existingAmount: new Prisma.Decimal(20000),
    existingCalculationType: "pre_split",
    existingApprovalStatus: "not_required",
    rate: null,
    amount: null,
    selectedCalculationType: null,
    requestedApprovalStatus: null,
    notes: null
  });

  assert.equal(normalized.rate, null);
  assert.equal(normalized.amount, null);
  assert.equal(normalized.selectedCalculationType, "pre_split");
  assert.equal(normalized.approvalRequired, false);
  assert.equal(normalized.approvalStatus, "not_required");
});

test("explicit finance fee rate still derives amount from gross commission", () => {
  const normalized = normalizeTransactionFinanceFeeForPersistence({
    feeType: "client_referral",
    grossCommission: new Prisma.Decimal(100000),
    existingRate: null,
    existingAmount: null,
    existingCalculationType: "pre_split",
    existingApprovalStatus: "not_required",
    rate: new Prisma.Decimal(2),
    amount: null,
    selectedCalculationType: "pre_split",
    requestedApprovalStatus: null,
    notes: null
  });

  assert.equal(normalized.rate?.toString(), "2");
  assert.equal(normalized.amount?.toString(), "2000");
  assert.equal(normalized.selectedCalculationType, "pre_split");
});
