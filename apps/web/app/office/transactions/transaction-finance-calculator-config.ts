export type TransactionFinanceCalculatorFeeTypeValue =
  | "rebate"
  | "client_referral"
  | "external_referral"
  | "company_referral";

export type TransactionFinanceCalculatorCalculationTypeValue = "pre_split" | "post_split";

export type TransactionFinanceCalculatorFieldKey =
  | "rebate"
  | "clientReferral"
  | "externalReferral"
  | "companyReferral";

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
    feeTypeLabel: "返佣",
    selectedCalculationTypeValue: "pre_split"
  },
  {
    fieldKey: "clientReferral",
    feeTypeValue: "client_referral",
    feeTypeLabel: "内部推荐",
    selectedCalculationTypeValue: "pre_split"
  },
  {
    fieldKey: "externalReferral",
    feeTypeValue: "external_referral",
    feeTypeLabel: "外部推荐",
    selectedCalculationTypeValue: "post_split"
  },
  {
    fieldKey: "companyReferral",
    feeTypeValue: "company_referral",
    feeTypeLabel: "公司推荐",
    selectedCalculationTypeValue: "post_split"
  }
];

export function createEmptyTransactionFinanceCalculatorValues(): TransactionFinanceCalculatorValues {
  return {
    rebate: "",
    clientReferral: "",
    externalReferral: "",
    companyReferral: ""
  };
}

export function parseTransactionFinanceCalculatorNumber(value: string) {
  const normalized = value.replaceAll(",", "").replace(/\$/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatTransactionFinanceCalculatorNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function isConfiguredTransactionFinanceCalculatorAmount(value: string) {
  if (!value.trim()) {
    return false;
  }

  const numeric = parseTransactionFinanceCalculatorNumber(value);
  return numeric === null ? true : numeric !== 0;
}

export function deriveTransactionFinanceCalculatorAmount(grossCommissionValue: string, rateValue: string) {
  const grossValue = parseTransactionFinanceCalculatorNumber(grossCommissionValue);
  const rate = parseTransactionFinanceCalculatorNumber(rateValue);

  if (!grossValue || grossValue <= 0 || rate === null) {
    return "";
  }

  return formatTransactionFinanceCalculatorNumber((grossValue * rate) / 100);
}

export function deriveTransactionFinanceCalculatorRate(grossCommissionValue: string, amountValue: string) {
  const grossValue = parseTransactionFinanceCalculatorNumber(grossCommissionValue);
  const amount = parseTransactionFinanceCalculatorNumber(amountValue);

  if (!grossValue || grossValue <= 0 || amount === null) {
    return "";
  }

  return formatTransactionFinanceCalculatorNumber((amount / grossValue) * 100);
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
