import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  getAgentPayoutStatementMatchDate,
  normalizeAgentPayoutStatementPeriodBasis,
  parseStakeholderBreakdownSharePercent,
  summarizeAgentPayoutStatementRows
} from "./agent-payout-statements.ts";

test("normalizeAgentPayoutStatementPeriodBasis falls back to calculated_at", () => {
  assert.equal(normalizeAgentPayoutStatementPeriodBasis(undefined), "calculated_at");
  assert.equal(normalizeAgentPayoutStatementPeriodBasis("unexpected"), "calculated_at");
  assert.equal(normalizeAgentPayoutStatementPeriodBasis("closing_date"), "closing_date");
});

test("getAgentPayoutStatementMatchDate switches between calculated and closing date", () => {
  const calculatedAt = new Date("2026-03-15T15:30:00.000Z");
  const closingDate = new Date("2026-03-12T00:00:00.000Z");

  assert.equal(getAgentPayoutStatementMatchDate({ calculatedAt, closingDate }, "calculated_at"), calculatedAt);
  assert.equal(getAgentPayoutStatementMatchDate({ calculatedAt, closingDate }, "closing_date"), closingDate);
});

test("summarizeAgentPayoutStatementRows totals payout snapshot amounts", () => {
  const summary = summarizeAgentPayoutStatementRows([
    {
      grossCommission: new Prisma.Decimal(3400),
      officeNet: new Prisma.Decimal(1700),
      agentNet: new Prisma.Decimal(1700),
      statementAmount: new Prisma.Decimal(1700)
    },
    {
      grossCommission: new Prisma.Decimal(2800),
      officeNet: new Prisma.Decimal(1400),
      agentNet: new Prisma.Decimal(1400),
      statementAmount: new Prisma.Decimal(1400)
    }
  ]);

  assert.equal(summary.lineItemCount, 2);
  assert.equal(summary.totalGrossCommission.toString(), "6200");
  assert.equal(summary.totalOfficeNet.toString(), "3100");
  assert.equal(summary.totalAgentNet.toString(), "3100");
  assert.equal(summary.totalStatementAmount.toString(), "3100");
});

test("parseStakeholderBreakdownSharePercent returns the finance share for the selected agent", () => {
  const share = parseStakeholderBreakdownSharePercent(
    [
      {
        key: "agent-1",
        membershipId: "membership-1",
        recipientLabel: "Linfen Ruan",
        recipientRole: "Agent",
        recipientRoleValue: "agent",
        recipientType: "agent",
        sharePercent: "70",
        baseAmount: "7000",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: "7000"
      },
      {
        key: "company",
        membershipId: "",
        recipientLabel: "Acre",
        recipientRole: "Brokerage",
        recipientRoleValue: "brokerage",
        recipientType: "brokerage",
        sharePercent: "30",
        baseAmount: "3000",
        postSplitAdjustment: "0",
        reimbursementAdjustment: "0",
        finalAmount: "3000"
      }
    ] satisfies Prisma.JsonArray,
    "membership-1"
  );

  assert.equal(share, "70%");
  assert.equal(parseStakeholderBreakdownSharePercent(undefined, "membership-1"), "");
  assert.equal(parseStakeholderBreakdownSharePercent([] satisfies Prisma.JsonArray, "missing-membership"), "");
});
