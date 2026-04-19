import { Prisma } from "@prisma/client";
import {
  formatCurrency,
  formatDateValue,
  transactionFinanceVersionSourceLabelMap,
  type OfficeTransactionFinanceVersionRecord,
} from "./types";

export function buildCommissionChanges(
  previous: {
    grossCommission: Prisma.Decimal | null;
    referralFee: Prisma.Decimal | null;
    officeNet: Prisma.Decimal | null;
    agentNet: Prisma.Decimal | null;
  } | null,
  next: {
    grossCommission: Prisma.Decimal;
    referralFee: Prisma.Decimal;
    officeNet: Prisma.Decimal;
    agentNet: Prisma.Decimal;
    fees: Prisma.Decimal;
  },
) {
  const changes: Array<{
    label: string;
    previousValue: string;
    nextValue: string;
  }> = [];

  const pairs = [
    ["Gross commission", previous?.grossCommission ?? null, next.grossCommission],
    ["Referral fee", previous?.referralFee ?? null, next.referralFee],
    ["Office net", previous?.officeNet ?? null, next.officeNet],
    ["Agent net", previous?.agentNet ?? null, next.agentNet],
  ] as const;

  for (const [label, previousValue, nextValue] of pairs) {
    const previousLabel = previousValue ? formatCurrency(previousValue) : "—";
    const nextLabel = formatCurrency(nextValue);

    if (previousLabel !== nextLabel) {
      changes.push({
        label,
        previousValue: previousLabel,
        nextValue: nextLabel,
      });
    }
  }

  changes.push({
    label: "Calculated fees",
    previousValue: "—",
    nextValue: formatCurrency(next.fees),
  });

  return changes;
}

export function mapTransactionFinanceVersionRecord(
  version: Prisma.TransactionFinanceCalculationVersionGetPayload<{
    include: {
      createdByMembership: {
        include: {
          user: true;
        };
      };
    };
  }>,
): OfficeTransactionFinanceVersionRecord {
  const createdByLabel = version.createdByMembership
    ? `${version.createdByMembership.user.firstName} ${version.createdByMembership.user.lastName}`.trim()
    : "System";

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    sourceTypeValue: version.sourceType,
    sourceTypeLabel: transactionFinanceVersionSourceLabelMap[version.sourceType],
    createdAt: formatDateValue(version.createdAt),
    createdByLabel,
    notes: version.notes ?? "",
    overrideReason: version.overrideReason ?? "",
    finalAgentNetLabel: formatCurrency(version.finalAgentNet),
    finalOfficeNetLabel: formatCurrency(version.finalOfficeNet),
    isCurrent: version.isCurrent,
  };
}
