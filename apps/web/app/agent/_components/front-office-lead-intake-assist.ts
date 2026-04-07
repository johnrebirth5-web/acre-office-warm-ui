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

export type FrontOfficeLeadIntakeAssistSuggestedAction =
  | "safe_apply"
  | "review_first"
  | "preview_only";

export type FrontOfficeLeadIntakeAssistProvenance =
  | "explicit_line"
  | "pattern_match"
  | "conversation_inference"
  | "assist_mode"
  | "summary_preview";

export type FrontOfficeLeadIntakeAssistRiskFlag =
  | "multiple_people"
  | "household_context"
  | "speaker_switching"
  | "contact_owner_unclear"
  | "multiple_contact_values"
  | "multiple_budget_values"
  | "relative_timing"
  | "preview_summary";

export type FrontOfficeLeadIntakeAssistField = {
  field: keyof FrontOfficeLeadIntakeAssistDraft;
  label: string;
  value: string;
  confidence: FrontOfficeLeadIntakeAssistConfidence;
  confidenceLabel: string;
  suggestedAction: FrontOfficeLeadIntakeAssistSuggestedAction;
  suggestedActionLabel: string;
  reasonLabel: string;
  provenance: FrontOfficeLeadIntakeAssistProvenance;
  provenanceLabel: string;
  evidenceLabel: string;
  cautionLabels: string[];
};

export type FrontOfficeLeadIntakeAssistSafetySummary = {
  tone: "neutral" | "warning";
  label: string;
  detail: string;
  cautionLabels: string[];
};

export type FrontOfficeLeadIntakeAssistReadinessSummary = {
  tone: "neutral" | "warning";
  label: string;
  detail: string;
  nextStepLabels: string[];
};

export type FrontOfficeLeadIntakeAssistResult = {
  rawText: string;
  draft: FrontOfficeLeadIntakeAssistDraft;
  fields: FrontOfficeLeadIntakeAssistField[];
  summaryLabel: string;
  safeApplyFieldCount: number;
  reviewFieldCount: number;
  previewOnlyFieldCount: number;
  safetySummary: FrontOfficeLeadIntakeAssistSafetySummary;
  readinessSummary: FrontOfficeLeadIntakeAssistReadinessSummary;
};

type IntakeSourceMode = "image" | "text" | "hybrid";

type ParsedAssistValue = {
  value: string;
  evidence: string;
  provenance: FrontOfficeLeadIntakeAssistProvenance;
  explicit: boolean;
  riskFlags: FrontOfficeLeadIntakeAssistRiskFlag[];
};

type ConversationContext = {
  hasMultiplePeople: boolean;
  hasHouseholdContext: boolean;
  hasContactOwnerRisk: boolean;
  hasSpeakerSwitching: boolean;
  riskFlags: FrontOfficeLeadIntakeAssistRiskFlag[];
  cautionLabels: string[];
  speakerNameCandidates: string[];
};

const nameLinePattern =
  /^(?:name|client|lead|buyer|renter|seller|prospect|姓名|客户)\s*[:：-]\s*(.+)$/i;
const phoneLinePattern = /^(?:phone|mobile|cell|电话|手机号)\s*[:：-]\s*(.+)$/i;
const emailLinePattern = /^(?:email|e-mail|邮箱)\s*[:：-]\s*(.+)$/i;
const stageLinePattern = /^(?:stage|status|客户阶段|阶段)\s*[:：-]\s*(.+)$/i;
const intentLinePattern =
  /^(?:intent|type|client type|business type|需求|客户类型)\s*[:：-]\s*(.+)$/i;
const budgetLinePattern =
  /(?:budget|up to|max budget|max|under|price|rent|purchase|预算|租金|总价)/i;
const areaLinePattern =
  /(?:areas?|neighbo(?:u)?rhoods?|location|locations|looking in|interested in|preferred areas?|target areas?|区域|地区|片区)\s*[:：-]?\s*(.+)$/i;
const followUpLinePattern =
  /(?:follow-up|follow up|next touch|next step|callback|回访|跟进|下次联系)\s*[:：-]?\s*(.+)$/i;
const speakerPrefixPattern =
  /^([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,2}|[\u4e00-\u9fff]{2,6})\s*[:：]\s*/;
const selfIntroNamePattern =
  /(?:\b(?:i am|i'm|this is|my name is)\s+([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,2})\b|(?:我是|我叫)\s*([\u4e00-\u9fff]{2,4}))/i;
const familyContextPattern =
  /(?:wife|husband|spouse|partner|fianc(?:e|ee|é|ée)|boyfriend|girlfriend|family|parents?|mom|mother|dad|father|son|daughter|kids?|children|brother|sister|roommate|roommates|夫妻|家人|家庭|老公|老婆|父母|爸妈|妈妈|爸爸|儿子|女儿|孩子|室友|男朋友|女朋友)/i;
const multiPartyPattern =
  /(?:\bwe\b|\bour\b|\bus\b|couple|together|group chat|joint|夫妻|一家|两位|一起|共同|双方)/i;
const joinedNamePattern =
  /(?:[\u4e00-\u9fff]{2,4}|[A-Za-z][A-Za-z'’.-]{1,}(?:\s+[A-Za-z][A-Za-z'’.-]{1,}){0,2})\s*(?:\/|&)\s*(?:[\u4e00-\u9fff]{2,4}|[A-Za-z][A-Za-z'’.-]{1,}(?:\s+[A-Za-z][A-Za-z'’.-]{1,}){0,2})/;
const contactOwnerRiskPattern =
  /(?:agent|broker|realtor|assistant|coworker|for my client|their client|经纪人|中介|助理|代发|转述|帮客户)/i;
const signatureContactPattern =
  /(?:best|thanks|regards|sincerely|call me|text me|reach me|联系我|给我打电话|给我发短信)/i;
const areaInferencePattern =
  /(?:looking (?:in|at|around)|interested in|target(?:ing)?|focus(?:ed)? on|prefer(?:s|red)?|wants?|considering|moving to|want to be in|想找|想看|考虑|目标|想住在|想在)\s+(.+)$/i;

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

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function cleanPotentialName(value: string) {
  return value
    .replace(
      /\b(?:phone|email|budget|area|areas|stage|intent|source)\b.*$/i,
      "",
    )
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

function extractLikelyNameCandidates(value: string) {
  const candidates = value
    .split(/,|，|\/|;|；|\(|\)|、|&|\band\b|和|与|及/i)
    .map((item) => cleanPotentialName(item))
    .filter(isLikelyName);

  return uniqueStrings(candidates);
}

function extractSpeakerNameCandidates(lines: string[]) {
  return uniqueStrings(
    lines.slice(0, 12).flatMap((line) => {
      if (
        nameLinePattern.test(line) ||
        phoneLinePattern.test(line) ||
        emailLinePattern.test(line) ||
        stageLinePattern.test(line) ||
        intentLinePattern.test(line)
      ) {
        return [];
      }

      const match = line.match(speakerPrefixPattern);
      const candidate = cleanPotentialName(match?.[1] ?? "");

      return isLikelyName(candidate) ? [candidate] : [];
    }),
  );
}

function extractExplicitNameCandidates(lines: string[]) {
  return uniqueStrings(
    lines
      .filter((line) => nameLinePattern.test(line))
      .flatMap((line) => {
        const match = line.match(nameLinePattern);
        return match?.[1] ? extractLikelyNameCandidates(match[1]) : [];
      }),
  );
}

function extractSelfIntroNameCandidates(lines: string[]) {
  return uniqueStrings(
    lines.flatMap((line) => {
      const match = line.match(selfIntroNamePattern);
      const candidate = cleanPotentialName(match?.[1] ?? match?.[2] ?? "");

      return isLikelyName(candidate) ? [candidate] : [];
    }),
  );
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

function countMoneyMatches(value: string) {
  return value.match(/\$?\s?\d[\d,.]*(?:\.\d+)?\s?[kKmM]?/g)?.length ?? 0;
}

function buildConversationContext(
  lines: string[],
  text: string,
): ConversationContext {
  const riskFlags = new Set<FrontOfficeLeadIntakeAssistRiskFlag>();
  const cautionLabels: string[] = [];

  const labeledNameCandidates = extractExplicitNameCandidates(lines);
  const openerNameCandidates = uniqueStrings(
    lines.slice(0, 6).flatMap((line) => extractLikelyNameCandidates(line)),
  );
  const speakerNameCandidates = extractSpeakerNameCandidates(lines);
  const combinedNameCandidates = uniqueStrings([
    ...labeledNameCandidates,
    ...openerNameCandidates,
    ...speakerNameCandidates,
  ]);

  const hasMultiplePeople =
    combinedNameCandidates.length > 1 ||
    multiPartyPattern.test(text) ||
    joinedNamePattern.test(text);
  const hasHouseholdContext = familyContextPattern.test(text);
  const hasSpeakerSwitching = speakerNameCandidates.length > 1;
  const hasContactOwnerRisk =
    contactOwnerRiskPattern.test(text) || signatureContactPattern.test(text);

  if (hasMultiplePeople) {
    riskFlags.add("multiple_people");
    cautionLabels.push(
      "Multiple people may be present in this conversation, so lead identity should be reviewed before applying.",
    );
  }

  if (hasHouseholdContext) {
    riskFlags.add("household_context");
    cautionLabels.push(
      "Family or household context appears in the thread, so contact details may not belong to just one primary lead.",
    );
  }

  if (hasSpeakerSwitching) {
    riskFlags.add("speaker_switching");
    cautionLabels.push(
      "More than one named speaker appears in the transcript, so identity-sensitive fields stay review-first.",
    );
  }

  if (hasContactOwnerRisk) {
    riskFlags.add("contact_owner_unclear");
    cautionLabels.push(
      "Some contact details may belong to an agent, assistant, or relay contact instead of the primary lead.",
    );
  }

  return {
    hasMultiplePeople,
    hasHouseholdContext,
    hasContactOwnerRisk,
    hasSpeakerSwitching,
    riskFlags: [...riskFlags],
    cautionLabels,
    speakerNameCandidates,
  };
}

function parseName(
  lines: string[],
  context: ConversationContext,
): ParsedAssistValue | null {
  const explicitNameCandidates = extractExplicitNameCandidates(lines);
  const selfIntroCandidates = extractSelfIntroNameCandidates(lines);

  if (explicitNameCandidates.length > 1) {
    return null;
  }

  if (selfIntroCandidates.length > 1) {
    return null;
  }

  for (const line of lines) {
    const match = line.match(nameLinePattern);

    if (!match?.[1]) {
      continue;
    }

    const rawValue = match[1].trim();
    const candidates = extractLikelyNameCandidates(rawValue);
    const ambiguousLine =
      familyContextPattern.test(rawValue) || multiPartyPattern.test(rawValue);
    const cleaned = cleanPotentialName(rawValue);
    const selected = candidates[0] ?? cleaned;

    if (candidates.length > 1) {
      return null;
    }

    if (!isLikelyName(selected)) {
      continue;
    }

    const riskFlags = ambiguousLine
      ? (uniqueStrings([
          ...context.riskFlags,
          "multiple_people",
          context.hasHouseholdContext ? "household_context" : "",
        ]).filter(Boolean) as FrontOfficeLeadIntakeAssistRiskFlag[])
      : [...context.riskFlags];

    return {
      value: selected,
      evidence: line,
      provenance: "explicit_line",
      explicit: true,
      riskFlags,
    };
  }

  if (selfIntroCandidates.length === 1) {
    const evidence =
      lines.find((line) => {
        const match = line.match(selfIntroNamePattern);
        const candidate = cleanPotentialName(match?.[1] ?? match?.[2] ?? "");

        return candidate === selfIntroCandidates[0];
      }) ?? selfIntroCandidates[0];

    return {
      value: selfIntroCandidates[0],
      evidence,
      provenance: "conversation_inference",
      explicit: false,
      riskFlags: [...context.riskFlags],
    };
  }

  if (context.hasMultiplePeople || context.hasHouseholdContext) {
    return null;
  }

  for (const line of lines.slice(0, 4)) {
    const cleaned = cleanPotentialName(line);

    if (!isLikelyName(cleaned)) {
      continue;
    }

    return {
      value: cleaned,
      evidence: line,
      provenance: "conversation_inference",
      explicit: false,
      riskFlags: [...context.riskFlags],
    };
  }

  return null;
}

function parseEmail(
  lines: string[],
  context: ConversationContext,
): ParsedAssistValue | null {
  const matches = uniqueStrings(
    lines
      .flatMap((line) => {
        const lineMatches =
          line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];

        return lineMatches.map((match) => `${match}|||${line}`);
      })
      .filter(Boolean),
  ).map((entry) => {
    const [value, evidence] = entry.split("|||");
    const explicit = emailLinePattern.test(evidence ?? "");
    const riskFlags = [
      ...context.riskFlags,
      familyContextPattern.test(evidence ?? "") ||
      contactOwnerRiskPattern.test(evidence ?? "") ||
      signatureContactPattern.test(evidence ?? "")
        ? "contact_owner_unclear"
        : "",
    ].filter(Boolean) as FrontOfficeLeadIntakeAssistRiskFlag[];

    return {
      value,
      evidence: evidence ?? value,
      explicit,
      riskFlags,
    };
  });

  if (!matches.length) {
    return null;
  }

  const selected = [...matches].sort(
    (left, right) => Number(right.explicit) - Number(left.explicit),
  )[0];

  return {
    value: selected.value.trim(),
    evidence: selected.evidence,
    provenance: selected.explicit ? "explicit_line" : "pattern_match",
    explicit: selected.explicit,
    riskFlags: uniqueStrings([
      ...selected.riskFlags,
      matches.length > 1 ? "multiple_contact_values" : "",
    ]).filter(Boolean) as FrontOfficeLeadIntakeAssistRiskFlag[],
  };
}

function parsePhone(
  lines: string[],
  context: ConversationContext,
): ParsedAssistValue | null {
  const matches = uniqueStrings(
    lines
      .flatMap((line) => {
        const lineMatches =
          line.match(
            /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/g,
          ) ?? [];

        return lineMatches.map((match) => `${formatPhone(match)}|||${line}`);
      })
      .filter(Boolean),
  ).map((entry) => {
    const [value, evidence] = entry.split("|||");
    const explicit = phoneLinePattern.test(evidence ?? "");
    const riskFlags = [
      ...context.riskFlags,
      familyContextPattern.test(evidence ?? "") ||
      contactOwnerRiskPattern.test(evidence ?? "") ||
      signatureContactPattern.test(evidence ?? "")
        ? "contact_owner_unclear"
        : "",
    ].filter(Boolean) as FrontOfficeLeadIntakeAssistRiskFlag[];

    return {
      value,
      evidence: evidence ?? value,
      explicit,
      riskFlags,
    };
  });

  if (!matches.length) {
    return null;
  }

  const selected = [...matches].sort(
    (left, right) => Number(right.explicit) - Number(left.explicit),
  )[0];

  return {
    value: selected.value.trim(),
    evidence: selected.evidence,
    provenance: selected.explicit ? "explicit_line" : "pattern_match",
    explicit: selected.explicit,
    riskFlags: uniqueStrings([
      ...selected.riskFlags,
      matches.length > 1 ? "multiple_contact_values" : "",
    ]).filter(Boolean) as FrontOfficeLeadIntakeAssistRiskFlag[],
  };
}

function parseIntent(text: string, lines: string[]): ParsedAssistValue | null {
  const explicitLine = lines.find((line) => intentLinePattern.test(line));

  const checks: Array<[RegExp, string]> = [
    [/\b(?:seller|selling|list my home|出售|卖房)\b/i, "Seller"],
    [/\b(?:landlord|lease out|出租)\b/i, "Landlord"],
    [/\b(?:investor|investment|投资)\b/i, "Investor"],
    [/\b(?:rental|rent|lease|tenant|租房|租客)\b/i, "Rental"],
    [/\b(?:buyer|buy|purchase|looking to buy|买房|购房)\b/i, "Buyer"],
  ];

  for (const [pattern, label] of checks) {
    if (!pattern.test(text)) {
      continue;
    }

    return {
      value: label,
      evidence: explicitLine ?? label,
      provenance: explicitLine ? "explicit_line" : "conversation_inference",
      explicit: Boolean(explicitLine),
      riskFlags: [],
    };
  }

  return null;
}

function parseStage(text: string, lines: string[]): ParsedAssistValue | null {
  const explicitLine = lines.find((line) => stageLinePattern.test(line));
  const checks: Array<[RegExp, string]> = [
    [/\b(?:won|closed won|成交)\b/i, "Won"],
    [/\b(?:lost|closed lost|流失)\b/i, "Lost"],
    [
      /\b(?:application|offer|contract|申请|报价|合同)\b/i,
      "Application / Offer",
    ],
    [/\b(?:negotiation|counter|谈判)\b/i, "Negotiation"],
    [
      /\b(?:viewing completed|tour completed|看过|已看房)\b/i,
      "Viewing Completed",
    ],
    [
      /\b(?:viewing scheduled|showing scheduled|tour scheduled|预约看房|带看)\b/i,
      "Viewing Scheduled",
    ],
    [/\b(?:follow-up|follow up|callback|跟进|回访)\b/i, "Needs Follow-up"],
    [/\b(?:contacted|reached|联系过)\b/i, "Contacted"],
    [/\b(?:warm|hot lead|意向较强)\b/i, "Warm Lead"],
    [/\b(?:cold|冷线索)\b/i, "Cold Lead"],
    [/\b(?:pending|待定)\b/i, "Pending"],
  ];

  for (const [pattern, label] of checks) {
    if (!pattern.test(text)) {
      continue;
    }

    return {
      value: label,
      evidence: explicitLine ?? label,
      provenance: explicitLine ? "explicit_line" : "conversation_inference",
      explicit: Boolean(explicitLine),
      riskFlags: [],
    };
  }

  return null;
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

function parseBudgetMax(
  lines: string[],
  text: string,
): ParsedAssistValue | null {
  const budgetLines = lines.filter((line) => budgetLinePattern.test(line));
  const sourceText = budgetLines.join(" \n ") || text;
  const matches =
    sourceText.match(/\$?\s?\d[\d,.]*(?:\.\d+)?\s?[kKmM]?/g) ?? [];
  const values = matches
    .map((match) => parseMoneyToken(match))
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return null;
  }

  return {
    value: String(Math.max(...values)),
    evidence: budgetLines[0] ?? matches[0] ?? sourceText.slice(0, 80),
    provenance: budgetLines.length ? "explicit_line" : "conversation_inference",
    explicit: budgetLines.length > 0,
    riskFlags:
      values.length > 1 || countMoneyMatches(sourceText) > 1
        ? ["multiple_budget_values"]
        : [],
  };
}

function cleanAreaToken(value: string) {
  return value
    .replace(/^[\s:：-]+/, "")
    .replace(
      /\b(?:budget|price|stage|intent|source|follow-up|follow up)\b.*$/i,
      "",
    )
    .replace(/[()]/g, "")
    .trim();
}

function extractAreaTokensFromSegment(value: string) {
  return value
    .split(/,|\/|;|\band\b|\bor\b|，|、|和|或/i)
    .map((item) => cleanAreaToken(item));
}

function parsePreferredAreas(lines: string[]): ParsedAssistValue | null {
  const labeledLines = lines.filter((line) => areaLinePattern.test(line));
  const labeledTokens = labeledLines.flatMap((line) => {
    const match = line.match(areaLinePattern);

    if (!match?.[1]) {
      return [];
    }

    return extractAreaTokensFromSegment(match[1]);
  });
  const inferenceLines = lines.filter((line) => {
    if (labeledLines.includes(line)) {
      return false;
    }

    return areaInferencePattern.test(line);
  });
  const inferredTokens = inferenceLines.flatMap((line) => {
    const match = line.match(areaInferencePattern);

    if (!match?.[1]) {
      return [];
    }

    return extractAreaTokensFromSegment(match[1]);
  });
  const seen = new Set<string>();
  const unique = [...labeledTokens, ...inferredTokens].filter((token) => {
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

  if (!unique.length) {
    return null;
  }

  return {
    value: unique.slice(0, 5).join(", "),
    evidence: labeledLines[0] ?? inferenceLines[0] ?? unique[0],
    provenance:
      labeledLines.length > 0 ? "explicit_line" : "conversation_inference",
    explicit: labeledLines.length > 0,
    riskFlags: [],
  };
}

function parseDateValue(text: string, now: Date) {
  if (/(?:tomorrow|明天)/i.test(text)) {
    return {
      value: formatIsoDate(addDays(now, 1)),
      relative: true,
    };
  }

  if (/(?:next week|下周)/i.test(text)) {
    return {
      value: formatIsoDate(addDays(now, 7)),
      relative: true,
    };
  }

  if (/(?:today|今天)/i.test(text)) {
    return {
      value: formatIsoDate(now),
      relative: true,
    };
  }

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoMatch?.[1]) {
    return {
      value: isoMatch[1],
      relative: false,
    };
  }

  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (!usDateMatch) {
    return null;
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
    return null;
  }

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    value: formatIsoDate(parsed),
    relative: false,
  };
}

function parseNextFollowUpAt(
  lines: string[],
  text: string,
  now: Date,
): ParsedAssistValue | null {
  const explicitLine = lines.find((line) => followUpLinePattern.test(line));

  if (explicitLine) {
    const parsed = parseDateValue(explicitLine, now);

    if (parsed) {
      return {
        value: parsed.value,
        evidence: explicitLine,
        provenance: "explicit_line",
        explicit: true,
        riskFlags: parsed.relative ? ["relative_timing"] : [],
      };
    }
  }

  const parsed = parseDateValue(text, now);

  if (!parsed) {
    return null;
  }

  return {
    value: parsed.value,
    evidence: parsed.relative
      ? "Relative timing found in the conversation."
      : parsed.value,
    provenance: "conversation_inference",
    explicit: false,
    riskFlags: parsed.relative ? ["relative_timing"] : [],
  };
}

function buildSourceLabel(mode: IntakeSourceMode, text: string) {
  if (/(?:wechat|we chat|微信)/i.test(text)) {
    if (mode === "hybrid") {
      return "WeChat screenshot + transcript assist";
    }

    return mode === "image" ? "WeChat OCR import" : "WeChat transcript assist";
  }

  if (mode === "hybrid") {
    return "Screenshot + transcript assist";
  }

  return mode === "image" ? "Screenshot OCR import" : "Transcript assist";
}

function parseSource(mode: IntakeSourceMode, text: string): ParsedAssistValue {
  const label = buildSourceLabel(mode, text);
  const evidence =
    mode === "hybrid"
      ? "Derived from the uploaded screenshot plus pasted transcript."
      : mode === "image"
        ? "Derived from the uploaded screenshot."
        : "Derived from the pasted transcript.";

  return {
    value: label,
    evidence,
    provenance: "assist_mode",
    explicit: true,
    riskFlags: [],
  };
}

function buildNotes(
  lines: string[],
  rawText: string,
  sourceLabel: string,
  context: ConversationContext,
): ParsedAssistValue | null {
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
  const cautionPrefix =
    context.hasMultiplePeople || context.hasHouseholdContext
      ? "Review household context before applying. "
      : "";
  const value = noteBody
    ? `${sourceLabel}: ${cautionPrefix}${noteBody}`.slice(0, 400)
    : `${sourceLabel}: ${cautionPrefix}${rawText.replace(/\s+/g, " ").slice(0, 320)}`.trim();

  return {
    value,
    evidence: candidates[0] ?? sourceLabel,
    provenance: "summary_preview",
    explicit: false,
    riskFlags: uniqueStrings([
      ...context.riskFlags,
      "preview_summary",
    ]) as FrontOfficeLeadIntakeAssistRiskFlag[],
  };
}

function buildProvenanceLabel(
  provenance: FrontOfficeLeadIntakeAssistProvenance,
) {
  switch (provenance) {
    case "explicit_line":
      return "Explicitly labeled in the extract";
    case "pattern_match":
      return "Matched from a structured pattern";
    case "conversation_inference":
      return "Inferred from conversation context";
    case "assist_mode":
      return "Derived from assist input mode only";
    case "summary_preview":
      return "Preview-only summary from the extract";
  }
}

function buildConfidenceLabel(
  confidence: FrontOfficeLeadIntakeAssistConfidence,
) {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

function buildSuggestedActionLabel(
  action: FrontOfficeLeadIntakeAssistSuggestedAction,
) {
  switch (action) {
    case "safe_apply":
      return "Ready once reviewed";
    case "review_first":
      return "Review required before apply";
    case "preview_only":
      return "Preview only";
  }
}

function buildCautionLabels(riskFlags: FrontOfficeLeadIntakeAssistRiskFlag[]) {
  const labels: string[] = [];

  if (riskFlags.includes("multiple_people")) {
    labels.push("Multiple people may be involved");
  }

  if (riskFlags.includes("household_context")) {
    labels.push("Household or family context detected");
  }

  if (riskFlags.includes("speaker_switching")) {
    labels.push("More than one speaker appears in the transcript");
  }

  if (riskFlags.includes("contact_owner_unclear")) {
    labels.push("Contact ownership may be unclear");
  }

  if (riskFlags.includes("multiple_contact_values")) {
    labels.push("More than one contact value appeared");
  }

  if (riskFlags.includes("multiple_budget_values")) {
    labels.push("More than one budget-like amount appeared");
  }

  if (riskFlags.includes("relative_timing")) {
    labels.push("Relative timing should be confirmed");
  }

  if (riskFlags.includes("preview_summary")) {
    labels.push("Preview summary only");
  }

  return labels;
}

function truncateEvidenceLabel(value: string) {
  const flattened = value.replace(/\s+/g, " ").trim();

  if (flattened.length <= 180) {
    return flattened;
  }

  return `${flattened.slice(0, 177)}...`;
}

function resolveFieldAssessment(input: {
  field: keyof FrontOfficeLeadIntakeAssistDraft;
  parsed: ParsedAssistValue;
  context: ConversationContext;
}) {
  const cautionLabels = buildCautionLabels(input.parsed.riskFlags);
  const hasIdentityRisk =
    input.parsed.riskFlags.includes("multiple_people") ||
    input.parsed.riskFlags.includes("household_context") ||
    input.parsed.riskFlags.includes("speaker_switching") ||
    input.parsed.riskFlags.includes("contact_owner_unclear") ||
    input.parsed.riskFlags.includes("multiple_contact_values");

  switch (input.field) {
    case "fullName":
      return input.parsed.explicit && !hasIdentityRisk
        ? {
            confidence: "high" as const,
            suggestedAction: "safe_apply" as const,
            reasonLabel:
              "A single lead name was explicitly labeled in the extract.",
            cautionLabels,
          }
        : {
            confidence: input.parsed.explicit
              ? ("medium" as const)
              : ("low" as const),
            suggestedAction: "review_first" as const,
            reasonLabel:
              "Lead identity needs review because the conversation may reference more than one person.",
            cautionLabels,
          };
    case "phone":
    case "email":
      if (input.parsed.riskFlags.includes("multiple_contact_values")) {
        return {
          confidence: "low" as const,
          suggestedAction: "review_first" as const,
          reasonLabel:
            "More than one contact value appeared, so Acre will not treat a single match as reliable until you confirm it.",
          cautionLabels,
        };
      }

      return !hasIdentityRisk
        ? {
            confidence: "high" as const,
            suggestedAction: "safe_apply" as const,
            reasonLabel: `${input.field === "phone" ? "Phone" : "Email"} matched a clear contact pattern.`,
            cautionLabels,
          }
        : {
            confidence: "medium" as const,
            suggestedAction: "review_first" as const,
            reasonLabel:
              "Contact details were found, but they may belong to a family member, relay contact, or another participant.",
            cautionLabels,
          };
    case "source":
      return {
        confidence: "high" as const,
        suggestedAction: "safe_apply" as const,
        reasonLabel: "Source comes directly from the assist mode you used.",
        cautionLabels,
      };
    case "stage":
    case "intent":
      return input.parsed.explicit
        ? {
            confidence: "high" as const,
            suggestedAction: "safe_apply" as const,
            reasonLabel: `${input.field === "stage" ? "Stage" : "Intent"} was explicitly labeled.`,
            cautionLabels,
          }
        : {
            confidence: "medium" as const,
            suggestedAction: "review_first" as const,
            reasonLabel: `${input.field === "stage" ? "Stage" : "Intent"} was inferred from conversation keywords.`,
            cautionLabels,
          };
    case "budgetMax":
      return input.parsed.riskFlags.includes("multiple_budget_values")
        ? {
            confidence: "medium" as const,
            suggestedAction: "review_first" as const,
            reasonLabel:
              "A budget signal was found, but multiple amounts appeared in the same extract.",
            cautionLabels,
          }
        : {
            confidence: input.parsed.explicit
              ? ("high" as const)
              : ("medium" as const),
            suggestedAction: input.parsed.explicit
              ? ("safe_apply" as const)
              : ("review_first" as const),
            reasonLabel: input.parsed.explicit
              ? "Budget came from a dedicated budget line."
              : "Budget was inferred from the broader conversation.",
            cautionLabels,
          };
    case "preferredAreas":
      return {
        confidence: input.parsed.explicit
          ? ("high" as const)
          : ("medium" as const),
        suggestedAction: input.parsed.explicit
          ? ("safe_apply" as const)
          : ("review_first" as const),
        reasonLabel: input.parsed.explicit
          ? "Areas came from a location line."
          : "Areas were inferred from freeform text.",
        cautionLabels,
      };
    case "nextFollowUpAt":
      if (input.parsed.riskFlags.includes("relative_timing")) {
        return {
          confidence: "medium" as const,
          suggestedAction: "review_first" as const,
          reasonLabel:
            "Follow-up timing was detected, but relative dates should be confirmed before applying.",
          cautionLabels,
        };
      }

      return {
        confidence: input.parsed.explicit
          ? ("high" as const)
          : ("medium" as const),
        suggestedAction: input.parsed.explicit
          ? ("safe_apply" as const)
          : ("review_first" as const),
        reasonLabel: input.parsed.explicit
          ? "Follow-up timing was explicitly labeled."
          : "Follow-up timing was inferred from date text in the conversation.",
        cautionLabels,
      };
    case "notes":
      return {
        confidence: "low" as const,
        suggestedAction: "preview_only" as const,
        reasonLabel:
          "Notes stay as a conservative preview summary until you rewrite or paste them manually.",
        cautionLabels,
      };
  }
}

function buildField(
  field: keyof FrontOfficeLeadIntakeAssistDraft,
  label: string,
  parsed: ParsedAssistValue | null,
  context: ConversationContext,
): FrontOfficeLeadIntakeAssistField | null {
  if (!parsed?.value.trim()) {
    return null;
  }

  const assessment = resolveFieldAssessment({
    field,
    parsed,
    context,
  });

  return {
    field,
    label,
    value: parsed.value.trim(),
    provenance: parsed.provenance,
    provenanceLabel: buildProvenanceLabel(parsed.provenance),
    confidenceLabel: buildConfidenceLabel(assessment.confidence),
    suggestedActionLabel: buildSuggestedActionLabel(assessment.suggestedAction),
    evidenceLabel: truncateEvidenceLabel(parsed.evidence),
    ...assessment,
  };
}

function buildSafetySummary(
  context: ConversationContext,
): FrontOfficeLeadIntakeAssistSafetySummary {
  if (!context.cautionLabels.length) {
    return {
      tone: "neutral",
      label: "Single-lead parsing looks straightforward",
      detail:
        "Acre did not detect obvious household, group-chat, or relay-contact risk in this extract.",
      cautionLabels: [],
    };
  }

  return {
    tone: "warning",
    label: "Review lead identity before applying suggestions",
    detail:
      "This extract may involve multiple people or indirect contact details, so Acre kept identity-sensitive fields conservative.",
    cautionLabels: context.cautionLabels,
  };
}

function countAlphaNumericLikeChars(value: string) {
  return value.match(/[A-Za-z0-9\u4e00-\u9fff]/g)?.length ?? 0;
}

function buildReadinessSummary(input: {
  rawText: string;
  lines: string[];
  fields: FrontOfficeLeadIntakeAssistField[];
  context: ConversationContext;
  sourceMode: IntakeSourceMode;
}): FrontOfficeLeadIntakeAssistReadinessSummary {
  const identityFields = input.fields.filter(
    (field) =>
      field.field === "fullName" ||
      field.field === "phone" ||
      field.field === "email",
  );
  const hasLeadName = input.fields.some((field) => field.field === "fullName");
  const hasWorkflowField = input.fields.some((field) =>
    [
      "stage",
      "intent",
      "budgetMax",
      "preferredAreas",
      "nextFollowUpAt",
    ].includes(field.field),
  );
  const alphaNumericChars = countAlphaNumericLikeChars(input.rawText);
  const signalRatio =
    input.rawText.length > 0 ? alphaNumericChars / input.rawText.length : 0;
  const lowSignal =
    input.lines.length <= 2 ||
    alphaNumericChars < 20 ||
    (input.fields.length <= 2 && signalRatio < 0.45);

  const screenshotGuidance =
    input.sourceMode === "image" || input.sourceMode === "hybrid"
      ? "Crop tighter around the lead messages before re-running OCR"
      : "";
  const transcriptGuidance =
    input.sourceMode === "text" || input.sourceMode === "hybrid"
      ? "Paste 3-8 lines that include name, contact clues, or a clear next step"
      : "";

  if (!input.fields.length) {
    return {
      tone: "warning",
      label: "Extraction stayed conservative",
      detail:
        "Acre found text, but not enough structured lead data to move anything into the live form yet.",
      nextStepLabels: uniqueStrings([
        screenshotGuidance,
        transcriptGuidance,
        "Manual entry is still the safe fallback if you already know the lead",
      ]).filter(Boolean),
    };
  }

  if (!hasLeadName && identityFields.length > 0) {
    return {
      tone: "warning",
      label: "Contact clues appeared without a clear lead name",
      detail:
        "Phone or email may be usable, but review who those details belong to before applying them into the live form.",
      nextStepLabels: uniqueStrings([
        transcriptGuidance,
        "Look for a self-introduction or labeled name line before applying contact details",
      ]).filter(Boolean),
    };
  }

  if (lowSignal) {
    return {
      tone: "warning",
      label: "Low-signal extract: keep review tight",
      detail:
        "Acre found a few usable clues, but the extract still looks sparse or noisy, so review each field before you apply it.",
      nextStepLabels: uniqueStrings([
        screenshotGuidance,
        transcriptGuidance,
        hasWorkflowField
          ? "Apply only the fields you are comfortable promoting into the live form"
          : "Add one workflow clue such as budget, areas, or next follow-up timing",
      ]).filter(Boolean),
    };
  }

  if (input.context.cautionLabels.length > 0) {
    return {
      tone: "warning",
      label: "Structured fields found, but identity still needs review",
      detail:
        "Acre found usable lead signals, yet household, multi-party, or relay-contact context means the live form should stay under manual control.",
      nextStepLabels: [
        "Review identity fields first",
        "Only apply the values that clearly belong to the primary lead",
        "Create uses live form values only",
      ],
    };
  }

  return {
    tone: "neutral",
    label: "Good starting point for review",
    detail:
      "Acre found structured lead fields and kept every suggestion separate from the live form until you review and apply it.",
    nextStepLabels: [
      "Review safe suggestions first",
      "Apply only the fields you want in the live form",
      "No auto-create or auto-send happens here",
    ],
  };
}

export function extractFrontOfficeLeadIntakeAssist(input: {
  rawText: string;
  sourceMode: IntakeSourceMode;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const normalizedText = normalizeWhitespace(input.rawText);
  const lines = splitMeaningfulLines(normalizedText);
  const context = buildConversationContext(lines, normalizedText);
  const source = parseSource(input.sourceMode, normalizedText);
  const name = parseName(lines, context);
  const phone = parsePhone(lines, context);
  const email = parseEmail(lines, context);
  const stage = parseStage(normalizedText, lines);
  const intent = parseIntent(normalizedText, lines);
  const budgetMax = parseBudgetMax(lines, normalizedText);
  const preferredAreas = parsePreferredAreas(lines);
  const nextFollowUpAt = parseNextFollowUpAt(lines, normalizedText, now);
  const notes = buildNotes(lines, normalizedText, source.value, context);

  const draft: FrontOfficeLeadIntakeAssistDraft = {
    fullName: name?.value,
    phone: phone?.value,
    email: email?.value,
    source: source.value,
    stage: stage?.value,
    intent: intent?.value,
    budgetMax: budgetMax?.value,
    preferredAreas: preferredAreas?.value,
    nextFollowUpAt: nextFollowUpAt?.value,
    notes: notes?.value,
  };

  const fields = [
    buildField("fullName", "Full name", name, context),
    buildField("phone", "Phone", phone, context),
    buildField("email", "Email", email, context),
    buildField("source", "Source", source, context),
    stage?.value && stageLabelMap[stage.value]
      ? buildField("stage", "Stage", stage, context)
      : null,
    intent?.value && intentLabelMap[intent.value]
      ? buildField("intent", "Intent", intent, context)
      : null,
    buildField("budgetMax", "Budget up to", budgetMax, context),
    buildField("preferredAreas", "Preferred areas", preferredAreas, context),
    buildField("nextFollowUpAt", "Next follow-up", nextFollowUpAt, context),
    buildField("notes", "Notes", notes, context),
  ].filter((field): field is FrontOfficeLeadIntakeAssistField =>
    Boolean(field),
  );

  const safeApplyFieldCount = fields.filter(
    (field) => field.suggestedAction === "safe_apply",
  ).length;
  const reviewFieldCount = fields.filter(
    (field) => field.suggestedAction === "review_first",
  ).length;
  const previewOnlyFieldCount = fields.filter(
    (field) => field.suggestedAction === "preview_only",
  ).length;

  return {
    rawText: normalizedText,
    draft,
    fields,
    summaryLabel: fields.length
      ? `Detected ${fields.length} intake field(s) · ${safeApplyFieldCount} safe after review`
      : "No structured lead fields detected yet",
    safeApplyFieldCount,
    reviewFieldCount,
    previewOnlyFieldCount,
    safetySummary: buildSafetySummary(context),
    readinessSummary: buildReadinessSummary({
      rawText: normalizedText,
      lines,
      fields,
      context,
      sourceMode: input.sourceMode,
    }),
  } satisfies FrontOfficeLeadIntakeAssistResult;
}
