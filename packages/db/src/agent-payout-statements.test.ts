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
  summarizeAgentPayoutStatementRows,
  updateAgentPayoutStatementManualLineItems
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
  assert.equal(options[0]?.isGenerateEligible, true);
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
        { feeTypeValue: "company_referral", amountValue: "800" }
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
    assert.ok(postGenerationSnapshot.filters.invoiceOptions.every((option) => option.isGenerateEligible === true));
    assert.equal(postGenerationSnapshot.candidateRows.length, 3);
    assert.ok(postGenerationSnapshot.candidateRows.every((row) => row.statusValue === "payable"));
    assert.ok(postGenerationSnapshot.candidateRows.every((row) => row.isGenerateEligible === true));
  } finally {
    await context.cleanup();
  }
});

test("createAgentPayoutStatement can regenerate snapshots from payable and paid rows without downgrading paid status", async () => {
  const context = await createStatementTestContext();

  try {
    const payableRow = await context.createCommissionRow({
      invoiceNumber: "INV-400",
      transactionName: "Invoice 400 Payable",
      address: "70 Invoice Ave",
      status: "payable",
      calculatedAt: "2026-03-16T00:00:00.000Z",
      statementAmount: "1000"
    });

    const paidRow = await context.createCommissionRow({
      invoiceNumber: "INV-400",
      transactionName: "Invoice 400 Paid",
      address: "71 Invoice Ave",
      status: "paid",
      calculatedAt: "2026-03-18T00:00:00.000Z",
      statementAmount: "500"
    });

    const reviewedRow = await context.createCommissionRow({
      invoiceNumber: "INV-500",
      transactionName: "Invoice 500 Reviewed",
      address: "72 Invoice Ave",
      status: "reviewed",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      statementAmount: "900"
    });

    const firstStatement = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-400", "INV-500"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    const secondStatement = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-400", "INV-500"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    assert.notEqual(firstStatement.statementId, secondStatement.statementId);

    const savedStatements = await prisma.agentPayoutStatement.findMany({
      where: {
        id: {
          in: [firstStatement.statementId, secondStatement.statementId]
        }
      },
      include: {
        lineItems: true
      },
      orderBy: {
        generatedAt: "asc"
      }
    });

    assert.equal(savedStatements.length, 2);
    assert.ok(savedStatements.every((statement) => statement.lineItemCount === 3));
    assert.ok(
      savedStatements.every((statement) =>
        new Set(statement.lineItems.map((lineItem) => lineItem.commissionCalculationId)).size === 3
      )
    );

    const refreshedRows = await prisma.commissionCalculation.findMany({
      where: {
        id: {
          in: [payableRow.id, paidRow.id, reviewedRow.id]
        }
      }
    });
    const statusById = new Map(refreshedRows.map((row) => [row.id, row.status]));

    assert.equal(statusById.get(payableRow.id), "payable");
    assert.equal(statusById.get(paidRow.id), "paid");
    assert.equal(statusById.get(reviewedRow.id), "payable");

    const postGenerationSnapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-400", "INV-500"]
    });

    assert.ok(postGenerationSnapshot.filters.invoiceOptions.every((option) => option.isGenerateEligible === true));
    assert.equal(postGenerationSnapshot.candidateRows.length, 3);
    assert.deepEqual(
      new Set(postGenerationSnapshot.candidateRows.map((row) => row.statusValue)),
      new Set(["payable", "paid"])
    );
    assert.ok(postGenerationSnapshot.candidateRows.every((row) => row.isGenerateEligible === true));
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

test("updateAgentPayoutStatementManualLineItems persists manual adjustments and detail totals", async () => {
  const context = await createStatementTestContext();

  try {
    await context.createCommissionRow({
      invoiceNumber: "INV-MANUAL-100",
      transactionName: "Manual Adjustment Invoice A",
      address: "100 Manual Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-16T00:00:00.000Z",
      statementAmount: "1000"
    });

    await context.createCommissionRow({
      invoiceNumber: "INV-MANUAL-200",
      transactionName: "Manual Adjustment Invoice B",
      address: "101 Manual Ave",
      status: "reviewed",
      calculatedAt: "2026-03-18T00:00:00.000Z",
      statementAmount: "700"
    });

    const statement = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-MANUAL-100", "INV-MANUAL-200"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    const updated = await updateAgentPayoutStatementManualLineItems({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: statement.statementId,
      manualLineItems: [
        {
          memo: "Insurance Deduction",
          amount: "-500"
        },
        {
          memo: "Bonus",
          amount: "300.25"
        }
      ],
      actorMembershipId: context.adminMembership.id
    });

    assert.equal(updated?.statementId, statement.statementId);

    const savedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: statement.statementId
      },
      include: {
        lineItems: true,
        manualLineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      }
    });

    assert.ok(savedStatement);
    assert.equal(savedStatement?.lineItemCount, 4);
    assert.equal(savedStatement?.totalStatementAmount.toString(), "1500.25");
    assert.deepEqual(
      savedStatement?.manualLineItems.map((lineItem) => ({
        memo: lineItem.memo,
        amount: lineItem.amount.toString()
      })),
      [
        { memo: "Insurance Deduction", amount: "-500" },
        { memo: "Bonus", amount: "300.25" }
      ]
    );

    const detail = await getOfficeAgentPayoutStatementDetail({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: statement.statementId
    });

    assert.equal(detail?.manualLineItems.length, 2);
    assert.equal(detail?.invoicePayoutTotalValue, "1700");
    assert.equal(detail?.manualAdjustmentTotalValue, "-199.75");
    assert.equal(detail?.totalStatementAmountValue, "1500.25");
  } finally {
    await context.cleanup();
  }
});

test("updateAgentPayoutStatementManualLineItems edits and removes adjustments without changing commission statuses", async () => {
  const context = await createStatementTestContext();

  try {
    const firstRow = await context.createCommissionRow({
      invoiceNumber: "INV-MANUAL-300",
      transactionName: "Manual Update Invoice A",
      address: "110 Manual Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-19T00:00:00.000Z",
      statementAmount: "1200"
    });

    const secondRow = await context.createCommissionRow({
      invoiceNumber: "INV-MANUAL-400",
      transactionName: "Manual Update Invoice B",
      address: "111 Manual Ave",
      status: "calculated",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      statementAmount: "800"
    });

    const statement = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-MANUAL-300", "INV-MANUAL-400"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    await updateAgentPayoutStatementManualLineItems({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: statement.statementId,
      manualLineItems: [
        {
          memo: "Initial Deduction",
          amount: "-100"
        },
        {
          memo: "Initial Bonus",
          amount: "200"
        }
      ],
      actorMembershipId: context.adminMembership.id
    });

    const firstSavedState = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: statement.statementId
      },
      include: {
        manualLineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      }
    });

    assert.ok(firstSavedState);
    assert.equal(firstSavedState?.manualLineItems.length, 2);

    await updateAgentPayoutStatementManualLineItems({
      organizationId: context.organization.id,
      officeId: context.office.id,
      statementId: statement.statementId,
      manualLineItems: [
        {
          id: firstSavedState?.manualLineItems[1]?.id,
          memo: "Updated Bonus",
          amount: "150"
        },
        {
          memo: "Reimbursement Adjustment",
          amount: "25"
        }
      ],
      actorMembershipId: context.adminMembership.id
    });

    const refreshedStatement = await prisma.agentPayoutStatement.findUnique({
      where: {
        id: statement.statementId
      },
      include: {
        manualLineItems: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        }
      }
    });

    assert.ok(refreshedStatement);
    assert.equal(refreshedStatement?.lineItemCount, 4);
    assert.equal(refreshedStatement?.manualLineItems.length, 2);
    assert.equal(refreshedStatement?.totalStatementAmount.toString(), "2175");
    assert.deepEqual(
      refreshedStatement?.manualLineItems.map((lineItem) => ({
        memo: lineItem.memo,
        amount: lineItem.amount.toString()
      })),
      [
        { memo: "Updated Bonus", amount: "150" },
        { memo: "Reimbursement Adjustment", amount: "25" }
      ]
    );

    const refreshedRows = await prisma.commissionCalculation.findMany({
      where: {
        id: {
          in: [firstRow.id, secondRow.id]
        }
      }
    });
    const statusById = new Map(refreshedRows.map((row) => [row.id, row.status]));

    assert.equal(statusById.get(firstRow.id), "payable");
    assert.equal(statusById.get(secondRow.id), "payable");
  } finally {
    await context.cleanup();
  }
});

test("statement history generatedAtLabel uses organization timezone instead of server timezone", async () => {
  const context = await createStatementTestContext();
  const previousTimeZone = process.env.TZ;

  try {
    await context.createCommissionRow({
      invoiceNumber: "INV-TZ-100",
      transactionName: "Timezone History Row",
      address: "90 Timezone Ave",
      status: "statement_ready",
      calculatedAt: "2026-03-27T16:30:00.000Z",
      statementAmount: "1000"
    });

    const statement = await createAgentPayoutStatement({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id,
      invoiceNumbers: ["INV-TZ-100"],
      commissionCalculationIds: [],
      actorMembershipId: context.adminMembership.id
    });

    await prisma.agentPayoutStatement.update({
      where: {
        id: statement.statementId
      },
      data: {
        generatedAt: new Date("2026-03-27T16:59:00.000Z")
      }
    });

    process.env.TZ = "UTC";

    const snapshot = await getOfficeAgentPayoutStatementsWorkspaceSnapshot({
      organizationId: context.organization.id,
      officeId: context.office.id,
      membershipId: context.agentMembership.id
    });

    assert.equal(snapshot.history[0]?.generatedAtLabel, "Mar 27, 2026, 12:59 PM");
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }

    await context.cleanup();
  }
});
