export const retiredTransactionCustomFieldKeys = new Set([
  "teamLeader",
  "additionalAddress",
  "additionalCity",
  "additionalState",
  "additionalZipCode",
  "moveInDateClosingDate",
  "commissionType",
  "currencyType",
  "commissionAmount",
  "yourCommissionRate",
  "rebate",
  "reimbursement",
  "commissionBreakdown",
  "companyReferral",
  "outsideReferral",
  "referralFee",
  "companyReferralEmployeeName",
  "note",
  "commissionReceivedStatus",
  "commissionConfirmation"
]);

export const retiredTransactionAdditionalFieldKeys = new Set([
  ...retiredTransactionCustomFieldKeys,
  "companyReferralEmployeesName",
  "officeNet",
  "agentNet"
]);

export function isRetiredTransactionCustomFieldKey(fieldKey: string) {
  return retiredTransactionCustomFieldKeys.has(fieldKey);
}
