import { randomUUID } from "node:crypto";
import { MembershipStatus, Prisma } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

const selectable1099MembershipStatuses = ["active", "invited"] satisfies MembershipStatus[];

export type Office1099TrackerTab = "records" | "summary";

export type Office1099TrackerMemberOption = {
  id: string;
  label: string;
};

export type Office1099PaymentRecordRow = {
  id: string;
  paymentDate: string;
  paymentDateLabel: string;
  paymentAmountLabel: string;
  paymentAmountValue: string;
  memo: string;
};

export type Office1099PaymentRecordsEditor = {
  membershipId: string;
  agentLabel: string;
  payeeName: string;
  displayName: string;
  taxYear: number;
  totalPaidLabel: string;
  totalPaidValue: string;
  missingProfileFields: string[];
  rows: Office1099PaymentRecordRow[];
};

export type Office1099SummaryRow = {
  membershipId: string;
  agentLabel: string;
  name: string;
  payeeName: string;
  totalPaidLabel: string;
  totalPaidValue: string;
  taxIdLabel: string;
  contactNumber: string;
  address: string;
  email: string;
  missingProfileFields: string[];
};

export type Office1099SummaryDetail = {
  membershipId: string;
  agentLabel: string;
  payeeName: string;
  displayName: string;
  taxYear: number;
  totalPaidLabel: string;
  totalPaidValue: string;
  taxIdLabel: string;
  taxIdTypeLabel: string;
  taxIdNumber: string;
  contactNumber: string;
  address: string;
  email: string;
  missingProfileFields: string[];
  paymentRecords: Office1099PaymentRecordRow[];
};

export type Office1099TrackerWorkspaceSnapshot = {
  tab: Office1099TrackerTab;
  filters: {
    taxYear: number;
    membershipId: string;
    memberOptions: Office1099TrackerMemberOption[];
  };
  recordsEditor: Office1099PaymentRecordsEditor | null;
  summaryRows: Office1099SummaryRow[];
};

export type GetOffice1099TrackerWorkspaceSnapshotInput = {
  organizationId: string;
  officeId?: string | null;
  taxYear?: number | string | null;
  membershipId?: string | null;
  tab?: string | null;
};

export type ListAgent1099PaymentRecordsInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  taxYear: number | string;
};

export type SaveAgent1099PaymentRecordInput = {
  id?: string;
  paymentDate: string;
  paymentAmount: string;
  memo?: string;
};

export type SaveAgent1099PaymentRecordsInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  taxYear: number | string;
  records: SaveAgent1099PaymentRecordInput[];
  actorMembershipId: string;
};

export type GetOffice1099SummaryRowsInput = {
  organizationId: string;
  officeId?: string | null;
  taxYear: number | string;
};

export type GetOffice1099SummaryDetailInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  taxYear: number | string;
};

type MembershipWith1099Profile = Prisma.MembershipGetPayload<{
  include: {
    user: true;
    agentBankInformation: true;
  };
}>;

type NormalizedPaymentRecordInput = {
  id?: string;
  paymentDate: Date;
  paymentDateValue: string;
  paymentAmount: Prisma.Decimal;
  memo: string;
};

function buildOfficeOrGlobalWhere(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }]
  };
}

function normalize1099TrackerTab(value: string | null | undefined): Office1099TrackerTab {
  return value === "summary" ? "summary" : "records";
}

function normalizeTaxYear(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1900 && value <= 9999) {
    return value;
  }

  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return new Date().getFullYear();
}

function normalizeMembershipId(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function formatCurrency(value: Prisma.Decimal | number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function decimalToString(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

function formatDateValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatDateLabel(value: Date | null | undefined) {
  return value
    ? value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : "—";
}

function buildMembershipLabel(membership: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}) {
  const fullName = `${membership.user.firstName} ${membership.user.lastName}`.trim();
  return fullName || membership.user.email;
}

function formatTaxIdLabel(input: {
  taxIdType?: string | null;
  taxIdValue?: string | null;
}) {
  return [input.taxIdType?.trim() ?? "", input.taxIdValue?.trim() ?? ""].filter(Boolean).join(" · ");
}

function collectMissingProfileFields(membership: MembershipWith1099Profile) {
  const bankInformation = membership.agentBankInformation;
  const missingFields: string[] = [];

  if (!bankInformation?.payeeName?.trim()) {
    missingFields.push("Payee Name");
  }

  if (!bankInformation?.taxIdType || !bankInformation.taxIdValue?.trim()) {
    missingFields.push("Tax ID");
  }

  if (!bankInformation?.phoneNumber?.trim()) {
    missingFields.push("Contact Number");
  }

  if (!bankInformation?.address?.trim()) {
    missingFields.push("Address");
  }

  if (!bankInformation?.email?.trim()) {
    missingFields.push("Email");
  }

  return missingFields;
}

function mapPaymentRecord(record: {
  id: string;
  paymentDate: Date;
  paymentAmount: Prisma.Decimal | number | string;
  memo: string | null;
}): Office1099PaymentRecordRow {
  return {
    id: record.id,
    paymentDate: formatDateValue(record.paymentDate),
    paymentDateLabel: formatDateLabel(record.paymentDate),
    paymentAmountLabel: formatCurrency(record.paymentAmount),
    paymentAmountValue: decimalToString(record.paymentAmount),
    memo: record.memo?.trim() ?? ""
  };
}

function buildProfileShape(membership: MembershipWith1099Profile) {
  const agentLabel = buildMembershipLabel(membership);
  const payeeName = membership.agentBankInformation?.payeeName?.trim() ?? "";
  const displayName = payeeName || agentLabel;
  const taxIdTypeLabel = membership.agentBankInformation?.taxIdType?.toUpperCase() ?? "";
  const taxIdNumber = membership.agentBankInformation?.taxIdValue?.trim() ?? "";

  return {
    agentLabel,
    payeeName,
    displayName,
    taxIdTypeLabel,
    taxIdNumber,
    taxIdLabel: formatTaxIdLabel({
      taxIdType: taxIdTypeLabel,
      taxIdValue: taxIdNumber
    }),
    contactNumber: membership.agentBankInformation?.phoneNumber?.trim() ?? "",
    address: membership.agentBankInformation?.address?.trim() ?? "",
    email: membership.agentBankInformation?.email?.trim() ?? "",
    missingProfileFields: collectMissingProfileFields(membership)
  };
}

function sumPaymentAmounts(records: Array<{ paymentAmount: Prisma.Decimal | number | string }>) {
  return records.reduce((sum, record) => sum.plus(new Prisma.Decimal(record.paymentAmount)), new Prisma.Decimal(0));
}

function buildRecordsContextHref(membershipId: string, taxYear: number) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", "records");
  searchParams.set("membershipId", membershipId);
  searchParams.set("taxYear", String(taxYear));
  return `/office/1099-tracker?${searchParams.toString()}`;
}

function normalizePaymentAmount(value: string, index: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Payment record ${index + 1} amount is required.`);
  }

  const normalized = trimmed.replaceAll(",", "").replace(/\$/g, "");

  if (!/^[+-]?(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(normalized)) {
    throw new Error(`Payment record ${index + 1} amount must be a signed number with up to 2 decimal places.`);
  }

  return new Prisma.Decimal(normalized).toDecimalPlaces(2);
}

function normalizePaymentDate(value: string, index: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Payment record ${index + 1} date is required.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Payment record ${index + 1} date must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Payment record ${index + 1} date is invalid.`);
  }

  return {
    date: parsed,
    value: trimmed
  };
}

function normalizePaymentRecordInputs(records: SaveAgent1099PaymentRecordInput[]) {
  const seenIds = new Set<string>();

  return records.map((record, index) => {
    const id = record.id?.trim();

    if (id) {
      if (seenIds.has(id)) {
        throw new Error("Duplicate payment record ids are not allowed.");
      }

      seenIds.add(id);
    }

    const normalizedDate = normalizePaymentDate(record.paymentDate, index);

    return {
      ...(id ? { id } : {}),
      paymentDate: normalizedDate.date,
      paymentDateValue: normalizedDate.value,
      paymentAmount: normalizePaymentAmount(record.paymentAmount, index),
      memo: record.memo?.trim() ?? ""
    } satisfies NormalizedPaymentRecordInput;
  });
}

async function listSelectable1099Memberships(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  return prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
      status: {
        in: selectable1099MembershipStatuses
      }
    },
    include: {
      user: true,
      agentBankInformation: true
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }, { user: { email: "asc" } }]
  });
}

export async function listAgent1099PaymentRecords(
  input: ListAgent1099PaymentRecordsInput
): Promise<Office1099PaymentRecordsEditor | null> {
  const membershipId = normalizeMembershipId(input.membershipId);
  const taxYear = normalizeTaxYear(input.taxYear);

  if (!membershipId) {
    return null;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
      status: {
        in: selectable1099MembershipStatuses
      }
    },
    include: {
      user: true,
      agentBankInformation: true
    }
  });

  if (!membership) {
    return null;
  }

  const records = await prisma.agent1099PaymentRecord.findMany({
    where: {
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
      membershipId,
      taxYear
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }, { id: "asc" }]
  });

  const profile = buildProfileShape(membership);
  const totalPaid = sumPaymentAmounts(records);

  return {
    membershipId,
    agentLabel: profile.agentLabel,
    payeeName: profile.payeeName,
    displayName: profile.displayName,
    taxYear,
    totalPaidLabel: formatCurrency(totalPaid),
    totalPaidValue: decimalToString(totalPaid),
    missingProfileFields: profile.missingProfileFields,
    rows: records.map(mapPaymentRecord)
  };
}

export async function getOffice1099SummaryRows(
  input: GetOffice1099SummaryRowsInput
): Promise<Office1099SummaryRow[]> {
  const taxYear = normalizeTaxYear(input.taxYear);
  const groupedRows = await prisma.agent1099PaymentRecord.groupBy({
    by: ["membershipId"],
    where: {
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
      taxYear
    },
    _sum: {
      paymentAmount: true
    }
  });

  if (groupedRows.length === 0) {
    return [];
  }

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
      id: {
        in: groupedRows.map((row) => row.membershipId)
      }
    },
    include: {
      user: true,
      agentBankInformation: true
    }
  });

  const membershipsById = new Map(memberships.map((membership) => [membership.id, membership]));

  return groupedRows
    .map((row) => {
      const membership = membershipsById.get(row.membershipId);

      if (!membership) {
        return null;
      }

      const profile = buildProfileShape(membership);
      const totalPaid = row._sum.paymentAmount ?? new Prisma.Decimal(0);

      return {
        membershipId: membership.id,
        agentLabel: profile.agentLabel,
        name: profile.displayName,
        payeeName: profile.payeeName,
        totalPaidLabel: formatCurrency(totalPaid),
        totalPaidValue: decimalToString(totalPaid),
        taxIdLabel: profile.taxIdLabel || "—",
        contactNumber: profile.contactNumber || "—",
        address: profile.address || "—",
        email: profile.email || "—",
        missingProfileFields: profile.missingProfileFields
      } satisfies Office1099SummaryRow;
    })
    .filter((row): row is Office1099SummaryRow => Boolean(row))
    .sort((left, right) => left.name.localeCompare(right.name) || left.agentLabel.localeCompare(right.agentLabel));
}

export async function getOffice1099SummaryDetail(
  input: GetOffice1099SummaryDetailInput
): Promise<Office1099SummaryDetail | null> {
  const membershipId = normalizeMembershipId(input.membershipId);
  const taxYear = normalizeTaxYear(input.taxYear);

  if (!membershipId) {
    return null;
  }

  const [membership, paymentRecords] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalWhere(input.officeId) ?? {})
      },
      include: {
        user: true,
        agentBankInformation: true
      }
    }),
    prisma.agent1099PaymentRecord.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
        membershipId,
        taxYear
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    })
  ]);

  if (!membership || paymentRecords.length === 0) {
    return null;
  }

  const profile = buildProfileShape(membership);
  const totalPaid = sumPaymentAmounts(paymentRecords);

  return {
    membershipId,
    agentLabel: profile.agentLabel,
    payeeName: profile.payeeName,
    displayName: profile.displayName,
    taxYear,
    totalPaidLabel: formatCurrency(totalPaid),
    totalPaidValue: decimalToString(totalPaid),
    taxIdLabel: profile.taxIdLabel,
    taxIdTypeLabel: profile.taxIdTypeLabel,
    taxIdNumber: profile.taxIdNumber,
    contactNumber: profile.contactNumber,
    address: profile.address,
    email: profile.email,
    missingProfileFields: profile.missingProfileFields,
    paymentRecords: paymentRecords.map(mapPaymentRecord)
  };
}

export async function getOffice1099TrackerWorkspaceSnapshot(
  input: GetOffice1099TrackerWorkspaceSnapshotInput
): Promise<Office1099TrackerWorkspaceSnapshot> {
  const tab = normalize1099TrackerTab(input.tab);
  const taxYear = normalizeTaxYear(input.taxYear);
  const requestedMembershipId = normalizeMembershipId(input.membershipId);
  const memberOptions = await listSelectable1099Memberships({
    organizationId: input.organizationId,
    officeId: input.officeId
  });
  const validMembershipId = memberOptions.some((membership) => membership.id === requestedMembershipId) ? requestedMembershipId : "";

  const [recordsEditor, summaryRows] = await Promise.all([
    tab === "records" && validMembershipId
      ? listAgent1099PaymentRecords({
          organizationId: input.organizationId,
          officeId: input.officeId,
          membershipId: validMembershipId,
          taxYear
        })
      : Promise.resolve(null),
    tab === "summary"
      ? getOffice1099SummaryRows({
          organizationId: input.organizationId,
          officeId: input.officeId,
          taxYear
        })
      : Promise.resolve([] as Office1099SummaryRow[])
  ]);

  return {
    tab,
    filters: {
      taxYear,
      membershipId: validMembershipId,
      memberOptions: memberOptions.map((membership) => ({
        id: membership.id,
        label: buildMembershipLabel(membership)
      }))
    },
    recordsEditor,
    summaryRows
  };
}

export async function saveAgent1099PaymentRecords(input: SaveAgent1099PaymentRecordsInput) {
  const membershipId = normalizeMembershipId(input.membershipId);
  const taxYear = normalizeTaxYear(input.taxYear);
  const normalizedRecords = normalizePaymentRecordInputs(input.records);

  if (!membershipId) {
    throw new Error("Membership is required.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
        status: {
          in: selectable1099MembershipStatuses
        }
      },
      include: {
        user: true,
        agentBankInformation: true
      }
    });

    if (!membership) {
      throw new Error("Active or invited membership not found for 1099 payment records.");
    }

    const existingRecords = await tx.agent1099PaymentRecord.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
        membershipId,
        taxYear
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });

    const existingById = new Map(existingRecords.map((record) => [record.id, record]));

    for (const record of normalizedRecords) {
      if (record.id && !existingById.has(record.id)) {
        throw new Error("Some payment records are no longer available for this agent and tax year.");
      }
    }

    const retainedIds = new Set(normalizedRecords.map((record) => record.id).filter(Boolean));
    const removedRecords = existingRecords.filter((record) => !retainedIds.has(record.id));
    const recordsToCreate = normalizedRecords.filter((record) => !record.id);
    const recordsToUpdate = normalizedRecords.filter((record) => {
      if (!record.id) {
        return false;
      }

      const existingRecord = existingById.get(record.id);

      if (!existingRecord) {
        return false;
      }

      return (
        formatDateValue(existingRecord.paymentDate) !== record.paymentDateValue ||
        decimalToString(existingRecord.paymentAmount) !== record.paymentAmount.toFixed(2) ||
        (existingRecord.memo?.trim() ?? "") !== record.memo
      );
    });

    if (removedRecords.length > 0) {
      await tx.agent1099PaymentRecord.deleteMany({
        where: {
          id: {
            in: removedRecords.map((record) => record.id)
          }
        }
      });
    }

    for (const record of recordsToUpdate) {
      await tx.agent1099PaymentRecord.update({
        where: {
          id: record.id
        },
        data: {
          paymentDate: record.paymentDate,
          paymentAmount: record.paymentAmount,
          memo: record.memo || null
        }
      });
    }

    const createdRecords = [] as Array<{ id: string; paymentAmount: Prisma.Decimal }>;

    for (const record of recordsToCreate) {
      const createdRecord = await tx.agent1099PaymentRecord.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId ?? membership.officeId,
          membershipId,
          taxYear,
          paymentDate: record.paymentDate,
          paymentAmount: record.paymentAmount,
          memo: record.memo || null,
          createdByMembershipId: input.actorMembershipId
        },
        select: {
          id: true,
          paymentAmount: true
        }
      });

      createdRecords.push(createdRecord);
    }

    const previousTotal = sumPaymentAmounts(existingRecords);
    const nextTotal = sumPaymentAmounts(
      normalizedRecords.map((record) => ({
        paymentAmount: record.paymentAmount
      }))
    );
    const contextHref = buildRecordsContextHref(membershipId, taxYear);
    const objectLabel = `${buildMembershipLabel(membership)} · 1099 payment records`;

    if (createdRecords.length > 0) {
      const createdTotal = sumPaymentAmounts(createdRecords);

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "agent_1099_payment_record",
        entityId: createdRecords[0]?.id ?? randomUUID(),
        action: activityLogActions.agent1099PaymentRecordSaved,
        payload: {
          officeId: input.officeId ?? membership.officeId ?? null,
          objectLabel,
          contextHref,
          details: [
            `Agent: ${buildMembershipLabel(membership)}`,
            `Tax year: ${taxYear}`,
            `Created records: ${createdRecords.length}`,
            `Created amount: ${formatCurrency(createdTotal)}`,
            `Total paid: ${formatCurrency(nextTotal)}`
          ]
        }
      });
    }

    if (recordsToUpdate.length > 0) {
      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "agent_1099_payment_record",
        entityId: recordsToUpdate[0]?.id ?? randomUUID(),
        action: activityLogActions.agent1099PaymentRecordUpdated,
        payload: {
          officeId: input.officeId ?? membership.officeId ?? null,
          objectLabel,
          contextHref,
          details: [
            `Agent: ${buildMembershipLabel(membership)}`,
            `Tax year: ${taxYear}`,
            `Updated records: ${recordsToUpdate.length}`,
            `Total paid: ${formatCurrency(previousTotal)} → ${formatCurrency(nextTotal)}`
          ]
        }
      });
    }

    if (removedRecords.length > 0) {
      const removedTotal = sumPaymentAmounts(removedRecords);

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "agent_1099_payment_record",
        entityId: removedRecords[0]?.id ?? randomUUID(),
        action: activityLogActions.agent1099PaymentRecordDeleted,
        payload: {
          officeId: input.officeId ?? membership.officeId ?? null,
          objectLabel,
          contextHref,
          details: [
            `Agent: ${buildMembershipLabel(membership)}`,
            `Tax year: ${taxYear}`,
            `Deleted records: ${removedRecords.length}`,
            `Deleted amount: ${formatCurrency(removedTotal)}`,
            `Total paid: ${formatCurrency(previousTotal)} → ${formatCurrency(nextTotal)}`
          ]
        }
      });
    }

    const savedRecords = await tx.agent1099PaymentRecord.findMany({
      where: {
        organizationId: input.organizationId,
        ...(buildOfficeOrGlobalWhere(input.officeId) ?? {}),
        membershipId,
        taxYear
      },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });
    const profile = buildProfileShape(membership);

    return {
      membershipId,
      agentLabel: profile.agentLabel,
      payeeName: profile.payeeName,
      displayName: profile.displayName,
      taxYear,
      totalPaidLabel: formatCurrency(nextTotal),
      totalPaidValue: decimalToString(nextTotal),
      missingProfileFields: profile.missingProfileFields,
      rows: savedRecords.map(mapPaymentRecord)
    } satisfies Office1099PaymentRecordsEditor;
  });
}
