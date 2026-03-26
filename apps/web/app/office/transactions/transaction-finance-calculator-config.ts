export type TransactionFinanceCalculatorFeeTypeValue =
  | "rebate"
  | "client_referral"
  | "external_referral"
  | "company_referral"
  | "channel_development_fee";

export type TransactionFinanceCalculatorCalculationTypeValue = "pre_split" | "post_split";

export type TransactionFinanceCalculatorFieldKey =
  | "rebate"
  | "clientReferral"
  | "externalReferral"
  | "companyReferral"
  | "channelDevelopmentFee";

export type TransactionFinanceCalculatorFieldDefinition = {
  fieldKey: TransactionFinanceCalculatorFieldKey;
  feeTypeValue: TransactionFinanceCalculatorFeeTypeValue;
  feeTypeLabel: string;
  selectedCalculationTypeValue: TransactionFinanceCalculatorCalculationTypeValue;
};

export type TransactionFinanceCalculatorValues = Record<TransactionFinanceCalculatorFieldKey, string>;

export const transactionFinanceCalculatorFieldDefinitions: TransactionFinanceCalculatorFieldDefinition[] = [
  {
    fieldKey: "rebate",
    feeTypeValue: "rebate",
    feeTypeLabel: "Rebate",
    selectedCalculationTypeValue: "pre_split"
  },
  {
    fieldKey: "clientReferral",
    feeTypeValue: "client_referral",
    feeTypeLabel: "Client Referral",
    selectedCalculationTypeValue: "pre_split"
  },
  {
    fieldKey: "externalReferral",
    feeTypeValue: "external_referral",
    feeTypeLabel: "External Referral",
    selectedCalculationTypeValue: "post_split"
  },
  {
    fieldKey: "companyReferral",
    feeTypeValue: "company_referral",
    feeTypeLabel: "Company Referral",
    selectedCalculationTypeValue: "post_split"
  },
  {
    fieldKey: "channelDevelopmentFee",
    feeTypeValue: "channel_development_fee",
    feeTypeLabel: "Channel Development Fee",
    selectedCalculationTypeValue: "post_split"
  }
];

export function createEmptyTransactionFinanceCalculatorValues(): TransactionFinanceCalculatorValues {
  return {
    rebate: "",
    clientReferral: "",
    externalReferral: "",
    companyReferral: "",
    channelDevelopmentFee: ""
  };
}

function parseCalculatorNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isConfiguredTransactionFinanceCalculatorAmount(value: string) {
  if (!value.trim()) {
    return false;
  }

  const numeric = parseCalculatorNumber(value);
  return numeric === null ? true : numeric !== 0;
}

export function buildTransactionFinanceCalculatorValuesFromFees<
  T extends {
    feeTypeValue: string;
    amount: string;
  }
>(fees: T[]): TransactionFinanceCalculatorValues {
  const nextValues = createEmptyTransactionFinanceCalculatorValues();

  for (const field of transactionFinanceCalculatorFieldDefinitions) {
    const fee = fees.find((entry) => entry.feeTypeValue === field.feeTypeValue);

    if (fee) {
      nextValues[field.fieldKey] = fee.amount;
    }
  }

  return nextValues;
}
