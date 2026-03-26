import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Prisma, type CommissionCalculationStatus, type UserRole } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  buildAgentPayoutStatementInvoiceOptions,
  createAgentPayoutStatement,
  deriveAgentPayoutStatementPeriodRange,
  getAgentPayoutStatementMatchDate,
  getOfficeAgentPayoutStatementDetail,
  getOfficeAgentPayoutStatementsWorkspaceSnapshot,
  normalizeAgentPayoutStatementInvoiceNumber,
  normalizeAgentPayoutStatementPeriodBasis,
  summarizeAgentPayoutStatementRows
} from "./agent-payout-statements.ts";
import { createTransaction } from "./transactions.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createStatementTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `Statement Test ${suffix}`,
      slug: `statement-test-${suffix}`
    }
  });

  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `Statement Office ${suffix}`,
      slug: `statement-office-${suffix}`,
      market: "New York",
      isPrimary: true
    }
  });

  const trackedUserIds: string[] = [];

  async function createMembership(role: UserRole, prefix: string) {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${randomUUID().slice(0, 8)}@example.com`,
        firstName: prefix,
        lastName: "User",
        timezone: "America/New_York",
        locale: "en-US",
        isActive: true
      }
    });
    trackedUserIds.push(user.id);

    const membership = await prisma.membership.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        userId: user.id,
        role,
        status: "active",
        title: role,
        permissions: Prisma.JsonNull
      }
    });

    return membership;
  }

  const adminMembership = await createMembership("office_admin", "statement-admin");
  const agentMembership = await createMembership("agent", "statement-agent");
  const otherAgentMembership = await createMembership("agent", "statement-other-agent");

  async function createCommissionRow(input: {
    ownerMembershipId?: string;
    invoiceNumber: string;
    transactionName: string;
    address: string;
    status: CommissionCalculationStatus;
    calculatedAt: string;
    statementAmount: string;
    grossCommission?: string;
    fees?: string;
    feeBreakdown?: Prisma.InputJsonValue;
    stakeholderBreakdown?: Prisma.InputJsonValue;
    versionSourceType?: "calculated" | "overridden";
  }) {
    const transaction = await createTransaction({
      organizationId: organization.id,
      officeId: office.id,
      ownerMembershipId: input.ownerMembershipId ?? agentMembership.id,
      actorMembershipId: adminMembership.id,
      transactionType: "sales",
      transactionStatus: "closed",
      representing: "buyer",
      address: input.address,
      city: "New York",
      state: "NY",
      zipCode: "10001",
      transactionName: input.transactionName,
      askingPrice: "1000000",
      purchasedPrice: "980000",
      grossCommission: input.grossCommission ?? "2000",
      closingDate: "2026-03-10",
      additionalFields: {
        invoiceNumber: input.invoiceNumber,
        buildingName: `${input.transactionName} Building`,
        unitNumber: "4B"
      }
    });

    const transactionFinanceCalculationVersion =
      input.stakeholderBreakdown
        ? await prisma.transactionFinanceCalculationVersion.create({
            data: {
              organizationId: organization.id,
              officeId: office.id,
              transactionId: transaction.id,
              versionNumber: 1,
              sourceType: input.versionSourceType ?? "calculated",
              isCurrent: true,
              grossCommission: new Prisma.Decimal(input.grossCommission ?? "2000"),
              preSplitTotal: new Prisma.Decimal(100),
              postSplitTotal: new Prisma.Decimal(input.fees ?? "150"),
              netCommissionBase: new Prisma.Decimal(input.grossCommission ?? "2000").minus(new Prisma.Decimal(100)),
              reimbursementAmount: new Prisma.Decimal(0),
              finalAgentNet: new Prisma.Decimal(input.statementAmount),
              finalOfficeNet: new Prisma.Decimal(0),
              feeBreakdown: input.feeBreakdown ?? ([] satisfies Prisma.InputJsonValue),
              stakeholderBreakdown: input.stakeholderBreakdown,
              blockingIssues: [] satisfies Prisma.InputJsonValue,
              notes: "Statement test version",
              createdByMembershipId: adminMembership.id
            }
          })
        : null;

    return prisma.commissionCalculation.create({
      data: {
        organizationId: organization.id,
        officeId: office.id,
        transactionId: transaction.id,
        transactionFinanceCalculationVersionId: transactionFinanceCalculationVersion?.id ?? null,
        membershipId: input.ownerMembershipId ?? agentMembership.id,
        recipientType: "agent",
        grossCommission: new Prisma.Decimal(input.grossCommission ?? "2000"),
        referralFee: new Prisma.Decimal(100),
        fees: new Prisma.Decimal(input.fees ?? "150"),
        officeNet: new Prisma.Decimal(500),
        agentNet: new Prisma.Decimal(input.statementAmount),
        statementAmount: new Prisma.Decimal(input.statementAmount),
        status: input.status,
        calculatedAt: new Date(input.calculatedAt),
        calculatedByMembershipId: adminMembership.id
      }
    });
  }

  return {
    organization,
    office,
    adminMembership,
    agentMembership,
    otherAgentMembership,
    createCommissionRow,
    async cleanup() {
      await prisma.organization.delete({
        where: {
          id: organization.id
        }
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: trackedUserIds
          }
        }
      });
    }
  };
}

test("normalizeAgentPayoutStatementPeriodBasis supports invoice_number and keeps historical fallbacks", () => {
  assert.equal(normalizeAgentPayoutStatementPeriodBasis(undefined), "calculated_at");
  assert.equal(normalizeAgentPayoutStatementPeriodBasis("unexpected"), "calculated_at");
  assert.equal(normalizeAgentPayoutStatementPeriodBasis("closing_date"), "closing_date");
  assert.equal(normalizeAgentPayoutStatementPeriodBasis("invoice_number"), "invoice_number");
});

test("getAgentPayoutStatementMatchDate uses calculatedAt for invoice_number basis", () => {
  const calculatedAt = new Date("2026-03-15T15:30:00.000Z");
  const closingDate = new Date("2026-03-12T00:00:00.000Z");

  assert.equal(getAgentPayoutStatementMatchDate({ calculatedAt, closingDate }, "calculated_at"), calculatedAt);
  assert.equal(getAgentPayoutStatementMatchDate({ calculatedAt, closingDate }, "closing_date"), closingDate);
  assert.equal(getAgentPayoutStatementMatchDate({ calculatedAt, closingDate }, "invoice_number"), calculatedAt);
});

test("normalizeAgentPayoutStatementInvoiceNumber trims whitespace", () => {
  assert.equal(normalizeAgentPayoutStatementInvoiceNumber(" INV-200 "), "INV-200");
  assert.equal(normalizeAgentPayoutStatementInvoiceNumber("   "), "");
  assert.equal(normalizeAgentPayoutStatementInvoiceNumber(undefined), "");
});

test("buildAgentPayoutStatementInvoiceOptions groups by trimmed invoice number and excludes blanks", () => {
  const options = buildAgentPayoutStatementInvoiceOptions([
    {
      invoiceNumber: " INV-100 ",
      calculatedAt: new Date("2026-03-18T00:00:00.000Z"),
      statementAmount: new Prisma.Decimal(1200),
      status: "statement_ready"
    },
    {
      invoiceNumber: "INV-100",
      calculatedAt: new Date("2026-03-16T00:00:00.000Z"),
      statementAmount: new Prisma.Decimal(800),
      status: "reviewed"
    },
    {
      invoiceNumber: "",
      calculatedAt: new Date("2026-03-19T00:00:00.000Z"),
      statementAmount: new Prisma.Decimal(400),
      status: "payable"
    },
    {
      invoiceNumber: "INV-200",
      calculatedAt: new Date("2026-03-20T00:00:00.000Z"),
      statementAmount: new Prisma.Decimal(900),
      status: "payable"
    }
  ]);

  assert.equal(options.length, 2);
  assert.equal(options[0]?.invoiceNumber, "INV-200");
  assert.equal(options[1]?.invoiceNumber, "INV-100");
  assert.equal(options[0]?.isGenerateEligible, false);
  assert.equal(options[1]?.isGenerateEligible, true);
  assert.equal(options[1]?.rowCount, 2);
  assert.equal(options[1]?.totalStatementAmountValue, "2000");
});

test("deriveAgentPayoutStatementPeriodRange returns the earliest and latest calculatedAt", () => {
  const period = deriveAgentPayoutStatementPeriodRange([
    { calculatedAt: new Date("2026-03-22T00:00:00.000Z") },
    { calculatedAt: new Date("2026-03-20T00:00:00.000Z") },
    { calculatedAt: new Date("2026-03-21T00:00:00.000Z") }
  ]);

  assert.ok(period);
  assert.equal(period?.periodStart.toISOString(), "2026-03-20T00:00:00.000Z");
  assert.equal(period?.periodEnd.toISOString(), "2026-03-22T00:00:00.000Z");
  assert.equal(deriveAgentPayoutStatementPeriodRange([]), null);
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

test("workspace snapshot exposes only agent-scoped invoice candidates and trimmed candidate rows", async () => {
  const context = await createStatementTestContext();

  try {
    const firstInvoiceRow = await context.createCommissionRow({
      invoiceNumber: " INV-100 ",
      transactionName: "Invoice 100 A",
      address: "10 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-16T00:00:00.000Z",
      statementAmount: "1100"
    });

    const secondInvoiceRow = await context.createCommissionRow({
      invoiceNumber: "INV-100",
      transactionName: "Invoice 100 B",
      address: "11 Invoice Ave",
      status: "reviewed",
      calculatedAt: "2026-03-17T00:00:00.000Z",
      statementAmount: "900"
    });

    await context.createCommissionRow({
      invoiceNumber: "INV-200",
      transactionName: "Invoice 200",
      address: "20 Invoice Ave",
      status: "calculated",
      calculatedAt: "2026-03-18T00:00:00.000Z",
      statementAmount: "1500"
    });

    await context.createCommissionRow({
      invoiceNumber: "   ",
      transactionName: "Blank Invoice",
      address: "30 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-19T00:00:00.000Z",
      statementAmount: "700"
    });

    await context.createCommissionRow({
      ownerMembershipId: context.otherAgentMembership.id,
      invoiceNumber: "INV-999",
      transactionName: "Other Agent Invoice",
      address: "40 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      statementAmount: "1300"
    });

    const snapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-100"]
    });

    assert.equal(snapshot.filters.invoiceOptions.length, 2);
    assert.deepEqual(
      new Set(snapshot.filters.invoiceOptions.map((option) => option.invoiceNumber)),
      new Set(["INV-100", "INV-200"])
    );
    assert.equal(snapshot.filters.invoiceOptions.find((option) => option.invoiceNumber === "INV-100")?.rowCount, 2);
    assert.equal(snapshot.filters.invoiceOptions.find((option) => option.invoiceNumber === "INV-100")?.totalStatementAmountValue, "2000");
    assert.equal(snapshot.candidateRows.length, 2);
    assert.deepEqual(
      new Set(snapshot.candidateRows.map((row) => row.id)),
      new Set([firstInvoiceRow.id, secondInvoiceRow.id])
    );
    assert.ok(snapshot.candidateRows.every((row) => row.invoiceNumber === "INV-100"));
  } finally {
    await context.cleanup();
  }
});

test("override-backed statement rows persist and display recalculated commission rates", async () => {
  const context = await createStatementTestContext();

  try {
    const overrideRow = await context.createCommissionRow({
      invoiceNumber: "INV-OVERRIDE",
      transactionName: "Override Statement Rate",
      address: "70 Override Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-21T00:00:00.000Z",
      grossCommission: "5000",
      statementAmount: "3000",
      fees: "0",
      stakeholderBreakdown: [
        {
          membershipId: context.agentMembership.id,
          recipientType: "agent",
          sharePercent: "80",
          finalAmount: "3000"
        },
        {
          membershipId: context.otherAgentMembership.id,
          recipientType: "agent",
          sharePercent: "0",
          finalAmount: "1000"
        },
        {
          membershipId: "",
          recipientType: "brokerage",
          sharePercent: "20",
          finalAmount: "1000"
        }
      ] satisfies Prisma.InputJsonValue,
      versionSourceType: "overridden"
    });

    const result = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-OVERRIDE"],
      commissionCalculationIds: [overrideRow.id],
      actorMembershipId: context.adminMembership.id
    });

    const savedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: result.statementId
      },
      include: {
        lineItems: true
      }
    });

    assert.ok(savedStatement);
    assert.equal(savedStatement?.lineItems[0]?.commissionRate, "60%");

    await prisma.agentPayoutStatementLine.updateMany({
      where: {
        statementId: result.statementId
      },
      data: {
        commissionRate: "80%"
      }
    });

    const statementDetail = await getOfficeAgentPayoutStatementDetail({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: result.statementId
    });

    assert.equal(statementDetail?.lineItems[0]?.commissionRate, "60%");
  } finally {
    await context.cleanup();
  }
});

test("statement detail exposes post-split fee breakdown by fee name", async () => {
  const context = await createStatementTestContext();

  try {
    const feeBreakdown = [
      {
        feeType: "external_referral",
        label: "External Referral",
        calculationType: "post_split",
        rate: "2.5",
        amount: "100",
        approvalRequired: false,
        approvalStatus: "not_required",
        notes: ""
      },
      {
        feeType: "company_referral",
        label: "Company Referral",
        calculationType: "post_split",
        rate: "20",
        amount: "800",
        approvalRequired: false,
        approvalStatus: "not_required",
        notes: ""
      },
      {
        feeType: "channel_development_fee",
        label: "Channel Development Fee",
        calculationType: "post_split",
        rate: "0",
        amount: "0",
        approvalRequired: false,
        approvalStatus: "not_required",
        notes: ""
      }
    ] satisfies Prisma.InputJsonValue;

    const breakdownRow = await context.createCommissionRow({
      invoiceNumber: "INV-BREAKDOWN",
      transactionName: "Breakdown Statement",
      address: "90 Breakdown Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-23T00:00:00.000Z",
      statementAmount: "3100",
      fees: "900",
      feeBreakdown,
      stakeholderBreakdown: [
        {
          membershipId: context.agentMembership.id,
          recipientType: "agent",
          sharePercent: "75",
          finalAmount: "3100"
        },
        {
          membershipId: "",
          recipientType: "brokerage",
          sharePercent: "25",
          finalAmount: "900"
        }
      ] satisfies Prisma.InputJsonValue
    });

    const result = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-BREAKDOWN"],
      commissionCalculationIds: [breakdownRow.id],
      actorMembershipId: context.adminMembership.id
    });

    const savedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: result.statementId
      },
      include: {
        lineItems: true
      }
    });

    assert.deepEqual(savedStatement?.lineItems[0]?.feeBreakdown, feeBreakdown);

    const statementDetail = await getOfficeAgentPayoutStatementDetail({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: result.statementId
    });

    assert.deepEqual(
      statementDetail?.lineItems[0]?.postSplitBreakdown.map((item) => ({
        feeTypeValue: item.feeTypeValue,
        amountValue: item.amountValue
      })),
      [
        { feeTypeValue: "external_referral", amountValue: "100" },
        { feeTypeValue: "company_referral", amountValue: "800" },
        { feeTypeValue: "channel_development_fee", amountValue: "0" }
      ]
    );
  } finally {
    await context.cleanup();
  }
});

test("createAgentPayoutStatement includes all selected invoice rows and advances only those rows", async () => {
  const context = await createStatementTestContext();

  try {
    const invoice100RowA = await context.createCommissionRow({
      invoiceNumber: "INV-100",
      transactionName: "Invoice 100 A",
      address: "50 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-16T00:00:00.000Z",
      statementAmount: "1000"
    });

    const invoice100RowB = await context.createCommissionRow({
      invoiceNumber: "INV-100",
      transactionName: "Invoice 100 B",
      address: "51 Invoice Ave",
      status: "reviewed",
      calculatedAt: "2026-03-18T00:00:00.000Z",
      statementAmount: "1200"
    });

    const invoice200Row = await context.createCommissionRow({
      invoiceNumber: "INV-200",
      transactionName: "Invoice 200",
      address: "52 Invoice Ave",
      status: "calculated",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      statementAmount: "800"
    });

    const blankInvoiceRow = await context.createCommissionRow({
      invoiceNumber: "",
      transactionName: "Blank Invoice",
      address: "53 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-22T00:00:00.000Z",
      statementAmount: "600"
    });

    const otherAgentRow = await context.createCommissionRow({
      ownerMembershipId: context.otherAgentMembership.id,
      invoiceNumber: "INV-300",
      transactionName: "Other Agent Invoice",
      address: "54 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-24T00:00:00.000Z",
      statementAmount: "900"
    });

    const result = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-100", "INV-200"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    const savedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: result.statementId
      },
      include: {
        lineItems: true
      }
    });

    assert.ok(savedStatement);
    assert.equal(savedStatement?.periodBasis, "invoice_number");
    assert.equal(savedStatement?.lineItemCount, 3);
    assert.equal(savedStatement?.periodStart.toISOString(), "2026-03-16T00:00:00.000Z");
    assert.equal(savedStatement?.periodEnd.toISOString(), "2026-03-20T00:00:00.000Z");
    assert.deepEqual(
      new Set(savedStatement?.lineItems.map((lineItem) => lineItem.invoiceNumber)),
      new Set(["INV-100", "INV-200"])
    );

    const refreshedRows = await prisma.commissionCalculation.findMany({
      where: {
        id: {
          in: [invoice100RowA.id, invoice100RowB.id, invoice200Row.id, blankInvoiceRow.id, otherAgentRow.id]
        }
      }
    });
    const statusById = new Map(refreshedRows.map((row) => [row.id, row.status]));

    assert.equal(statusById.get(invoice100RowA.id), "payable");
    assert.equal(statusById.get(invoice100RowB.id), "payable");
    assert.equal(statusById.get(invoice200Row.id), "payable");
    assert.equal(statusById.get(blankInvoiceRow.id), "statement_ready");
    assert.equal(statusById.get(otherAgentRow.id), "statement_ready");

    const postGenerationSnapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-100", "INV-200"]
    });

    assert.deepEqual(
      new Set(postGenerationSnapshot.filters.invoiceOptions.map((option) => option.invoiceNumber)),
      new Set(["INV-100", "INV-200"])
    );
    assert.ok(postGenerationSnapshot.filters.invoiceOptions.every((option) => option.isGenerateEligible === false));
    assert.equal(postGenerationSnapshot.candidateRows.length, 3);
    assert.ok(postGenerationSnapshot.candidateRows.every((row) => row.statusValue === "payable"));
    assert.ok(postGenerationSnapshot.candidateRows.every((row) => row.isGenerateEligible === false));
  } finally {
    await context.cleanup();
  }
});

test("createAgentPayoutStatement honors row-level overrides within selected invoices", async () => {
  const context = await createStatementTestContext();

  try {
    const invoice100RowA = await context.createCommissionRow({
      invoiceNumber: "INV-100",
      transactionName: "Invoice 100 Override A",
      address: "60 Invoice Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-16T00:00:00.000Z",
      statementAmount: "1000"
    });

    const invoice100RowB = await context.createCommissionRow({
      invoiceNumber: "INV-100",
      transactionName: "Invoice 100 Override B",
      address: "61 Invoice Ave",
      status: "reviewed",
      calculatedAt: "2026-03-18T00:00:00.000Z",
      statementAmount: "700"
    });

    const invoice200Row = await context.createCommissionRow({
      invoiceNumber: "INV-200",
      transactionName: "Invoice 200 Override",
      address: "62 Invoice Ave",
      status: "calculated",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      statementAmount: "900"
    });

    const result = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-100", "INV-200"],
      commissionCalculationIds: [invoice100RowA.id, invoice200Row.id],
      actorMembershipId: context.adminMembership.id
    });

    const savedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: result.statementId
      },
      include: {
        lineItems: true
      }
    });

    assert.ok(savedStatement);
    assert.equal(savedStatement?.lineItemCount, 2);
    assert.deepEqual(
      new Set(savedStatement?.lineItems.map((lineItem) => lineItem.commissionCalculationId)),
      new Set([invoice100RowA.id, invoice200Row.id])
    );
    assert.equal(savedStatement?.periodStart.toISOString(), "2026-03-16T00:00:00.000Z");
    assert.equal(savedStatement?.periodEnd.toISOString(), "2026-03-20T00:00:00.000Z");

    const refreshedRows = await prisma.commissionCalculation.findMany({
      where: {
        id: {
          in: [invoice100RowA.id, invoice100RowB.id, invoice200Row.id]
        }
      }
    });
    const statusById = new Map(refreshedRows.map((row) => [row.id, row.status]));

    assert.equal(statusById.get(invoice100RowA.id), "payable");
    assert.equal(statusById.get(invoice200Row.id), "payable");
    assert.equal(statusById.get(invoice100RowB.id), "reviewed");
  } finally {
    await context.cleanup();
  }
});
