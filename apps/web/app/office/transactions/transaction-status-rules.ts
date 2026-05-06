import type { OfficeTransactionStatus } from "@acre/db";

const allTransactionStatusValues = ["opportunity", "active", "pending", "closed", "cancelled"] as const;
const createTransactionStatusValues = ["pending", "closed", "cancelled"] as const;

export type TransactionStatusValue = (typeof allTransactionStatusValues)[number];
export type CreateTransactionStatusValue = (typeof createTransactionStatusValues)[number];

export type TransactionStatusFieldPolicy = {
  canEdit: boolean;
  allowedValues: readonly TransactionStatusValue[];
  enforcedValue?: TransactionStatusValue;
  helperText?: string;
};

const transactionStatusLabelMap: Record<TransactionStatusValue, OfficeTransactionStatus> = {
  opportunity: "Opportunity",
  active: "Active",
  pending: "Pending",
  closed: "Closed",
  cancelled: "Cancelled"
};

export const allOfficeTransactionStatusOptions: readonly OfficeTransactionStatus[] = allTransactionStatusValues.map(
  (value) => transactionStatusLabelMap[value]
);

export function isOfficeTransactionStatus(value: string): value is OfficeTransactionStatus {
  return (allOfficeTransactionStatusOptions as readonly string[]).includes(value);
}

export function isCreateTransactionStatusValue(value: string): value is CreateTransactionStatusValue {
  return createTransactionStatusValues.includes(value as CreateTransactionStatusValue);
}

export function getCreateTransactionStatusFieldPolicy(canManageStatus: boolean): TransactionStatusFieldPolicy {
  if (canManageStatus) {
    return {
      canEdit: true,
      allowedValues: createTransactionStatusValues
    };
  }

  return {
    canEdit: false,
    allowedValues: createTransactionStatusValues,
    enforcedValue: "pending",
    helperText: "只有管理员可以修改状态。新交易默认进入待处理状态。"
  };
}

export function getEditTransactionStatusFieldPolicy(canManageStatus: boolean): TransactionStatusFieldPolicy {
  if (canManageStatus) {
    return {
      canEdit: true,
      allowedValues: allTransactionStatusValues
    };
  }

  return {
    canEdit: false,
    allowedValues: allTransactionStatusValues,
    helperText: "只有管理员可以修改状态。"
  };
}
