type LabeledValue = {
  label: string;
  value: string;
};

type ListingStudioFinancialHighlightKey =
  | "commonCharges"
  | "taxes"
  | "taxAbatement";

export type ListingStudioFinancialHighlight = {
  key: ListingStudioFinancialHighlightKey;
  label: string;
  value: string;
};

type ListingStudioFinancialHighlightSource = {
  facts: LabeledValue[];
  sourceFacts: LabeledValue[];
};

function classifyFinancialFactLabel(
  label: string,
): ListingStudioFinancialHighlightKey | null {
  const normalized = label.toLowerCase();

  if (/tax\s+abatement|abatement/.test(normalized)) {
    return "taxAbatement";
  }

  if (/common charges?|hoa|maintenance/.test(normalized)) {
    return "commonCharges";
  }

  if (/tax(?:es)?/.test(normalized)) {
    return "taxes";
  }

  return null;
}

export function isListingStudioFinancialFactLabel(label: string) {
  return classifyFinancialFactLabel(label) !== null;
}

function formatMonthlyHighlightValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "—";
  }

  if (/\$\s*[\d,.]+.*\/\s*(?:mo|month)/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim();
  }

  const numericMatch = trimmed.match(/-?[\d,.]+/);
  if (numericMatch?.[0]) {
    return `$${numericMatch[0]}/mo`;
  }

  return trimmed.replace(/\s+/g, " ").trim();
}

function formatTextHighlightValue(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "—";
}

export function collectListingStudioFinancialHighlights(
  detail: ListingStudioFinancialHighlightSource,
): ListingStudioFinancialHighlight[] {
  const values = new Map<ListingStudioFinancialHighlightKey, string>();
  const candidates = [...detail.sourceFacts, ...detail.facts];

  for (const item of candidates) {
    const key = classifyFinancialFactLabel(item.label);
    if (!key || values.has(key)) {
      continue;
    }

    values.set(key, item.value);
  }

  return [
    {
      key: "commonCharges",
      label: "Common Charges",
      value: formatMonthlyHighlightValue(values.get("commonCharges") ?? ""),
    },
    {
      key: "taxes",
      label: "Taxes",
      value: formatMonthlyHighlightValue(values.get("taxes") ?? ""),
    },
    {
      key: "taxAbatement",
      label: "Tax Abatement",
      value: formatTextHighlightValue(values.get("taxAbatement") ?? ""),
    },
  ];
}
