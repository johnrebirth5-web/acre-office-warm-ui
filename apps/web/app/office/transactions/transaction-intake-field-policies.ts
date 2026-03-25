export const createModeStructuredFinanceFieldKeys = new Set([
  "commissionAmount",
  "rebate",
  "reimbursement",
  "companyReferral",
  "outsideReferral",
  "referralFee",
  "companyReferralEmployeeName",
  "note"
]);

export const createModeRetiredLegacyFieldKeys = new Set([
  "additionalAddress",
  "additionalCity",
  "additionalState",
  "additionalZipCode",
  "moveInDateClosingDate",
  "commissionType",
  "yourCommissionRate",
  "commissionBreakdown",
  "commissionReceivedStatus",
  "commissionConfirmation"
]);

export const editModeRestrictedFinanceFieldKeys = new Set([
  "commissionAmount",
  "rebate",
  "reimbursement",
  "companyReferral",
  "outsideReferral",
  "referralFee",
  "companyReferralEmployeeName",
  "companyReferralEmployeesName",
  "note",
  "officeNet",
  "agentNet"
]);

export const createModeSystemManagedFieldKeys = new Set(["currencyType"]);

export function isTransactionCreateStructuredFinanceFieldKey(fieldKey: string) {
  return createModeStructuredFinanceFieldKeys.has(fieldKey);
}

export function isTransactionCreateRetiredLegacyFieldKey(fieldKey: string) {
  return createModeRetiredLegacyFieldKeys.has(fieldKey);
}

export function isTransactionCreateSystemManagedFieldKey(fieldKey: string) {
  return createModeSystemManagedFieldKeys.has(fieldKey);
}

export function isTransactionCreateDirectCustomFieldKey(fieldKey: string) {
  return !(
    isTransactionCreateStructuredFinanceFieldKey(fieldKey) ||
    isTransactionCreateRetiredLegacyFieldKey(fieldKey) ||
    isTransactionCreateSystemManagedFieldKey(fieldKey)
  );
}
