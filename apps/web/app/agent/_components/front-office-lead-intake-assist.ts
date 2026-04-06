export type FrontOfficeLeadIntakeAssistDraft = Partial<{
  fullName: string;
  phone: string;
  email: string;
  source: string;
  stage: string;
  intent: string;
  budgetMax: string;
  preferredAreas: string;
  nextFollowUpAt: string;
  notes: string;
}>;

export type FrontOfficeLeadIntakeAssistConfidence = "high" | "medium" | "low";

export type FrontOfficeLeadIntakeAssistField = {
  field: keyof FrontOfficeLeadIntakeAssistDraft;
  label: string;
  value: string;
  confidence: FrontOfficeLeadIntakeAssistConfidence;
  autoApply: boolean;
  reasonLabel: string;
};

export type FrontOfficeLeadIntakeAssistResult = {
  rawText: string;
  draft: FrontOfficeLeadIntakeAssistDraft;
  fields: FrontOfficeLeadIntakeAssistField[];
  summaryLabel: string;
  autoApplyFieldCount: number;
  reviewFieldCount: number;
};

type IntakeSourceMode = "image" | "text";

const nameLinePattern =
  /^(?:name|client|lead|buyer|renter|seller|prospect|姓名|客户)\s*[:：-]\s*(.+)$/i;
const stageLinePattern =
  /^(?:stage|status|客户阶段|阶段)\s*[:：-]\s*(.+)$/i;
const intentLinePattern =
  /^(?:intent|type|client type|business type|需求|客户类型)\s*[:：-]\s*(.+)$/i;
const budgetLinePattern =
  /(?:budget|up to|max budget|max|under|price|rent|purchase|预算|租金|总价)/i;
const areaLinePattern =
  /(?:areas?|neighbo(?:u)?rhoods?|location|locations|looking in|interested in|preferred areas?|target areas?|区域|地区|片区)\s*[:：-]?\s*(.+)$/i;
const followUpLinePattern =
  /(?:follow-up|follow up|next touch|next step|callback|回访|跟进|下次联系)\s*[:：-]?\s*(.+)$/i;

const stageLabelMap: Record<string, string> = {
  "Cold Lead": "Stage",
  "Warm Lead": "Stage",
  Contacted: "Stage",
  "Needs Follow-up": "Stage",
  "Viewing Scheduled": "Stage",
  "Viewing Completed": "Stage",
  Negotiation: "Stage",
  "Application / Offer": "Stage",
  Won: "Stage",
  Lost: "Stage",
  Pending: "Stage",
};

const intentLabelMap: Record<string, string> = {
  Buyer: "Intent",
  Rental: "Intent",
  Seller: "Intent",
  Landlord: "Intent",
  Investor: "Intent",
  Unknown: "Intent",
};

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitMeaningfulLines(value: string) {
  return normalizeWhitespace(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function parseEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() ?? "";
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value.trim();
}

function parsePhone(text: string) {
  const match = text.match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/,
  );

  return match?.[0] ? formatPhone(match[0]) : "";
}

function normalizePhoneDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || "";
}

function cleanPotentialName(value: string) {
  return value
    .replace(/\b(?:phone|email|budget|area|areas|stage|intent|source)\b.*$/i, "")
    .replace(/\d{1,2}:\d{2}.*$/, "")
    .replace(/[|•·]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isLikelyName(value: string) {
  if (!value || value.length < 2 || value.length > 48) {
    return false;
  }

  if (/\d/.test(value) || value.includes("@")) {
    return false;
  }

  if (/^[\u4e00-\u9fff]{2,4}$/.test(value)) {
    return true;
  }

  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length < 2 || parts.length > 4) {
    return false;
  }

  return parts.every((part) => /^[A-Za-z][A-Za-z'’-]*$/.test(part));
}

function parseName(lines: string[]) {
  const labeledLine = lines.find((line) => nameLinePattern.test(line));

  if (labeledLine) {
    const value = cleanPotentialName(
      labeledLine.replace(nameLinePattern, "$1"),
    );

    if (isLikelyName(value)) {
      return value;
    }
  }

  for (const line of lines.slice(0, 4)) {
    const value = cleanPotentialName(line);

    if (isLikelyName(value)) {
      return value;
    }
  }

  return "";
}

function parseIntent(text: string) {
  const checks: Array<[RegExp, string]> = [
    [/\b(?:seller|selling|list my home|出售|卖房)\b/i, "Seller"],
    [/\b(?:landlord|lease out|出租)\b/i, "Landlord"],
    [/\b(?:investor|investment|投资)\b/i, "Investor"],
    [/\b(?:rental|rent|lease|tenant|租房|租客)\b/i, "Rental"],
    [/\b(?:buyer|buy|purchase|looking to buy|买房|购房)\b/i, "Buyer"],
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(text)) {
      return label;
    }
  }

  return "";
}

function parseStage(text: string) {
  const checks: Array<[RegExp, string]> = [
    [/\b(?:won|closed won|成交)\b/i, "Won"],
    [/\b(?:lost|closed lost|流失)\b/i, "Lost"],
    [/\b(?:application|offer|contract|申请|报价|合同)\b/i, "Application / Offer"],
    [/\b(?:negotiation|counter|谈判)\b/i, "Negotiation"],
    [/\b(?:viewing completed|tour completed|看过|已看房)\b/i, "Viewing Completed"],
    [/\b(?:viewing scheduled|showing scheduled|tour scheduled|预约看房|带看)\b/i, "Viewing Scheduled"],
    [/\b(?:follow-up|follow up|callback|跟进|回访)\b/i, "Needs Follow-up"],
    [/\b(?:contacted|reached|联系过)\b/i, "Contacted"],
    [/\b(?:warm|hot lead|意向较强)\b/i, "Warm Lead"],
    [/\b(?:cold|冷线索)\b/i, "Cold Lead"],
    [/\b(?:pending|待定)\b/i, "Pending"],
  ];

  for (const [pattern, label] of checks) {
    if (pattern.test(text)) {
      return label;
    }
  }

  return "";
}

function parseMoneyToken(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "").toLowerCase();

  if (!cleaned) {
    return null;
  }

  let multiplier = 1;
  let numericText = cleaned;

  if (cleaned.endsWith("k")) {
    multiplier = 1_000;
    numericText = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("m")) {
    multiplier = 1_000_000;
    numericText = cleaned.slice(0, -1);
  }

  const numeric = Number.parseFloat(numericText);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * multiplier);
}

function parseBudgetMax(lines: string[], text: string) {
  const budgetLines = lines.filter((line) =>
    /(?:budget|up to|max budget|max|under|price|rent|purchase|预算|租金|总价)/i.test(
      line,
    ),
  );
  const sourceText = budgetLines.join(" \n ") || text;
  const matches = sourceText.match(/\$?\s?\d[\d,.]*(?:\.\d+)?\s?[kKmM]?/g) ?? [];
  const values = matches
    .map((match) => parseMoneyToken(match))
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return "";
  }

  return String(Math.max(...values));
}

function collectAreaCandidates(lines: string[]) {
  const candidates: string[] = [];

  for (const line of lines) {
    const match = line.match(areaLinePattern);

    if (match?.[1]) {
      candidates.push(match[1].trim());
    }
  }

  return candidates;
}

function cleanAreaToken(value: string) {
  return value
    .replace(/^[\s:：-]+/, "")
    .replace(/\b(?:budget|price|stage|intent|source|follow-up|follow up)\b.*$/i, "")
    .replace(/[()]/g, "")
    .trim();
}

function parsePreferredAreas(lines: string[]) {
  const rawCandidates = collectAreaCandidates(lines);
  const tokens = rawCandidates.flatMap((candidate) =>
    candidate.split(/,|\/|;|\band\b|，|、/i).map((item) => cleanAreaToken(item)),
  );
  const seen = new Set<string>();
  const unique = tokens.filter((token) => {
    const normalized = token.toLowerCase();

    if (
      token.length < 2 ||
      token.length > 36 ||
      /\d/.test(token) ||
      /(?:buyer|rental|seller|investor|budget|price|follow|stage)/i.test(token)
    ) {
      return false;
    }

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });

  return unique.slice(0, 5).join(", ");
}

function parseNextFollowUpAt(text: string, now: Date) {
  if (/(?:tomorrow|明天)/i.test(text)) {
    return formatIsoDate(addDays(now, 1));
  }

  if (/(?:next week|下周)/i.test(text)) {
    return formatIsoDate(addDays(now, 7));
  }

  if (/(?:today|今天)/i.test(text)) {
    return formatIsoDate(now);
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (!usDateMatch) {
    return "";
  }

  const month = Number.parseInt(usDateMatch[1] ?? "", 10);
  const day = Number.parseInt(usDateMatch[2] ?? "", 10);
  const rawYear = usDateMatch[3];
  const year =
    rawYear && rawYear.length === 4
      ? Number.parseInt(rawYear, 10)
      : rawYear && rawYear.length === 2
        ? 2000 + Number.parseInt(rawYear, 10)
        : now.getFullYear();

  if (!month || !day || !year) {
    return "";
  }

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return formatIsoDate(parsed);
}

function buildSourceLabel(mode: IntakeSourceMode, text: string) {
  if (/(?:wechat|we chat|微信)/i.test(text)) {
    return mode === "image" ? "WeChat OCR import" : "WeChat transcript assist";
  }

  return mode === "image" ? "Screenshot OCR import" : "Transcript assist";
}

function buildNotes(lines: string[], rawText: string, sourceLabel: string) {
  const candidates = lines.filter((line) => {
    if (!line || line.length < 8) {
      return false;
    }

    if (
      /^(?:name|client|lead|buyer|renter|seller|prospect|phone|email|budget|areas?|source|intent|stage|姓名|客户|电话|邮箱|预算|区域)\s*[:：-]/i.test(
        line,
      )
    ) {
      return false;
    }

    if (/^\d{1,2}:\d{2}/.test(line)) {
      return false;
    }

    return true;
  });

  const noteBody = candidates.slice(0, 3).join(" ");

  if (noteBody) {
    return `${sourceLabel}: ${noteBody}`.slice(0, 400);
  }

  return `${sourceLabel}: ${rawText.replace(/\s+/g, " ").slice(0, 320)}`.trim();
}

function normalizeComparisonValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function countMoneyMatches(value: string) {
  return value.match(/\$?\s?\d[\d,.]*(?:\.\d+)?\s?[kKmM]?/g)?.length ?? 0;
}

function resolveFieldAssessment(input: {
  field: keyof FrontOfficeLeadIntakeAssistDraft;
  value: string;
  lines: string[];
  text: string;
}) {
  const normalizedValue = normalizeComparisonValue(input.value);
  const budgetLines = input.lines.filter((line) => budgetLinePattern.test(line));
  const hasLabeledArea = input.lines.some((line) => areaLinePattern.test(line));
  const hasLabeledFollowUp = input.lines.some((line) =>
    followUpLinePattern.test(line),
  );

  switch (input.field) {
    case "fullName": {
      const hasLabeledName = input.lines.some((line) => {
        const match = line.match(nameLinePattern);

        if (!match?.[1]) {
          return false;
        }

        return (
          normalizeComparisonValue(cleanPotentialName(match[1])) ===
          normalizedValue
        );
      });

      return hasLabeledName
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Explicitly labeled in the transcript.",
          }
        : {
            confidence: "medium" as const,
            autoApply: false,
            reasonLabel: "Inferred from the opening lines.",
          };
    }
    case "phone":
      return normalizePhoneDigits(input.value).length >= 10
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Matched a full phone-number pattern.",
          }
        : {
            confidence: "medium" as const,
            autoApply: false,
            reasonLabel: "Looks like a phone number, but review it first.",
          };
    case "email":
      return {
        confidence: "high" as const,
        autoApply: true,
        reasonLabel: "Matched a valid email pattern.",
      };
    case "source":
      return {
        confidence: "high" as const,
        autoApply: true,
        reasonLabel: "Derived directly from the assist mode you used.",
      };
    case "stage":
      return input.lines.some((line) => stageLinePattern.test(line))
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Stage was explicitly labeled.",
          }
        : {
            confidence: "medium" as const,
            autoApply: false,
            reasonLabel: "Stage was inferred from conversation keywords.",
          };
    case "intent":
      return input.lines.some((line) => intentLinePattern.test(line))
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Intent was explicitly labeled.",
          }
        : {
            confidence: "medium" as const,
            autoApply: false,
            reasonLabel: "Intent was inferred from housing keywords.",
          };
    case "budgetMax": {
      const budgetContext = budgetLines.join(" ");
      const isSingleBudgetSignal =
        budgetLines.length > 0 && countMoneyMatches(budgetContext) <= 1;

      return budgetLines.length > 0 && isSingleBudgetSignal
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Budget came from a dedicated budget line.",
          }
        : {
            confidence: budgetLines.length > 0 ? ("medium" as const) : ("low" as const),
            autoApply: false,
            reasonLabel:
              budgetLines.length > 0
                ? "Multiple budget-like amounts were found, so review the suggestion."
                : "Budget was inferred from general transcript text.",
          };
    }
    case "preferredAreas":
      return hasLabeledArea
        ? {
            confidence: "high" as const,
            autoApply: true,
            reasonLabel: "Areas came from a location line.",
          }
        : {
            confidence: "medium" as const,
            autoApply: false,
            reasonLabel: "Areas were inferred from freeform text.",
          };
    case "nextFollowUpAt":
      if (hasLabeledFollowUp) {
        return {
          confidence: "high" as const,
          autoApply: true,
          reasonLabel: "Follow-up timing was explicitly labeled.",
        };
      }

      if (/(?:tomorrow|明天|next week|下周|today|今天|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)/i.test(input.text)) {
        return {
          confidence: "medium" as const,
          autoApply: false,
          reasonLabel: "Timing was inferred from relative or freeform date text.",
        };
      }

      return {
        confidence: "low" as const,
        autoApply: false,
        reasonLabel: "Date hint is too soft to auto-fill.",
      };
    case "notes":
      return {
        confidence: "low" as const,
        autoApply: false,
        reasonLabel: "Preview summary only. Keep or rewrite it manually.",
      };
  }
}

function buildFields(
  draft: FrontOfficeLeadIntakeAssistDraft,
  lines: string[],
  text: string,
) {
  const fields: FrontOfficeLeadIntakeAssistField[] = [];

  if (draft.fullName) {
    const assessment = resolveFieldAssessment({
      field: "fullName",
      value: draft.fullName,
      lines,
      text,
    });
    fields.push({
      field: "fullName",
      label: "Full name",
      value: draft.fullName,
      ...assessment,
    });
  }

  if (draft.phone) {
    const assessment = resolveFieldAssessment({
      field: "phone",
      value: draft.phone,
      lines,
      text,
    });
    fields.push({ field: "phone", label: "Phone", value: draft.phone, ...assessment });
  }

  if (draft.email) {
    const assessment = resolveFieldAssessment({
      field: "email",
      value: draft.email,
      lines,
      text,
    });
    fields.push({ field: "email", label: "Email", value: draft.email, ...assessment });
  }

  if (draft.source) {
    const assessment = resolveFieldAssessment({
      field: "source",
      value: draft.source,
      lines,
      text,
    });
    fields.push({ field: "source", label: "Source", value: draft.source, ...assessment });
  }

  if (draft.stage && stageLabelMap[draft.stage]) {
    const assessment = resolveFieldAssessment({
      field: "stage",
      value: draft.stage,
      lines,
      text,
    });
    fields.push({ field: "stage", label: "Stage", value: draft.stage, ...assessment });
  }

  if (draft.intent && intentLabelMap[draft.intent]) {
    const assessment = resolveFieldAssessment({
      field: "intent",
      value: draft.intent,
      lines,
      text,
    });
    fields.push({ field: "intent", label: "Intent", value: draft.intent, ...assessment });
  }

  if (draft.budgetMax) {
    const assessment = resolveFieldAssessment({
      field: "budgetMax",
      value: draft.budgetMax,
      lines,
      text,
    });
    fields.push({
      field: "budgetMax",
      label: "Budget up to",
      value: draft.budgetMax,
      ...assessment,
    });
  }

  if (draft.preferredAreas) {
    const assessment = resolveFieldAssessment({
      field: "preferredAreas",
      value: draft.preferredAreas,
      lines,
      text,
    });
    fields.push({
      field: "preferredAreas",
      label: "Preferred areas",
      value: draft.preferredAreas,
      ...assessment,
    });
  }

  if (draft.nextFollowUpAt) {
    const assessment = resolveFieldAssessment({
      field: "nextFollowUpAt",
      value: draft.nextFollowUpAt,
      lines,
      text,
    });
    fields.push({
      field: "nextFollowUpAt",
      label: "Next follow-up",
      value: draft.nextFollowUpAt,
      ...assessment,
    });
  }

  if (draft.notes) {
    const assessment = resolveFieldAssessment({
      field: "notes",
      value: draft.notes,
      lines,
      text,
    });
    fields.push({ field: "notes", label: "Notes", value: draft.notes, ...assessment });
  }

  return fields;
}

export function extractFrontOfficeLeadIntakeAssist(input: {
  rawText: string;
  sourceMode: IntakeSourceMode;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const normalizedText = normalizeWhitespace(input.rawText);
  const lines = splitMeaningfulLines(normalizedText);
  const sourceLabel = buildSourceLabel(input.sourceMode, normalizedText);
  const draft: FrontOfficeLeadIntakeAssistDraft = {
    fullName: parseName(lines),
    phone: parsePhone(normalizedText),
    email: parseEmail(normalizedText),
    source: sourceLabel,
    stage: parseStage(normalizedText),
    intent: parseIntent(normalizedText),
    budgetMax: parseBudgetMax(lines, normalizedText),
    preferredAreas: parsePreferredAreas(lines),
    nextFollowUpAt: parseNextFollowUpAt(normalizedText, now),
    notes: buildNotes(lines, normalizedText, sourceLabel),
  };
  const fields = buildFields(draft, lines, normalizedText);
  const autoApplyFieldCount = fields.filter((field) => field.autoApply).length;
  const reviewFieldCount = fields.length - autoApplyFieldCount;

  return {
    rawText: normalizedText,
    draft,
    fields,
    summaryLabel: fields.length
      ? `Detected ${fields.length} intake field(s) · ${autoApplyFieldCount} ready to use`
      : "No structured lead fields detected yet",
    autoApplyFieldCount,
    reviewFieldCount,
  } satisfies FrontOfficeLeadIntakeAssistResult;
}
