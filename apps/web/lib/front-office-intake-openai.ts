import {
  FRONT_OFFICE_LEAD_INTAKE_AI_FIELD_KEYS,
  FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS,
  type FrontOfficeLeadIntakeAiExtraction,
  type FrontOfficeLeadIntakeAiFieldKey,
  type FrontOfficeLeadIntakeAiFieldSuggestion,
  type FrontOfficeLeadIntakeAiProvenance,
  type FrontOfficeLeadIntakeAiRiskFlag,
} from "./front-office-intake-ai";

type IntakeSourceMode = "text" | "image" | "hybrid";

type ExtractWithOpenAiInput = {
  rawText: string;
  transcriptText: string;
  ocrText: string;
  image: Blob | null;
  sourceMode: IntakeSourceMode;
  fetchImpl?: typeof fetch;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function resolveOpenAiIntakeAssistModel() {
  return process.env.OPENAI_INTAKE_ASSIST_MODEL?.trim() || "gpt-5.4-mini";
}

const canonicalStageValues = [
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Viewing Scheduled",
  "Viewing Completed",
  "Negotiation",
  "Application / Offer",
  "Won",
  "Lost",
  "Pending",
] as const;

const canonicalIntentValues = [
  "Buyer",
  "Rental",
  "Seller",
  "Landlord",
  "Investor",
  "Unknown",
] as const;

type OpenAiFieldPayload = {
  field?: unknown;
  value?: unknown;
  evidence?: unknown;
  provenance?: unknown;
  explicit?: unknown;
  riskFlags?: unknown;
};

type OpenAiExtractionPayload = {
  fields?: unknown;
};

function normalizeCompactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeBudgetValue(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? digits : null;
}

function normalizeDateValue(value: string) {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeFieldValue(field: FrontOfficeLeadIntakeAiFieldKey, value: string) {
  const trimmed = normalizeCompactText(value);

  if (!trimmed) {
    return null;
  }

  if (field === "budgetMax") {
    return normalizeBudgetValue(trimmed);
  }

  if (field === "nextFollowUpAt") {
    return normalizeDateValue(trimmed);
  }

  if (field === "stage") {
    return canonicalStageValues.includes(trimmed as (typeof canonicalStageValues)[number])
      ? trimmed
      : null;
  }

  if (field === "intent") {
    return canonicalIntentValues.includes(trimmed as (typeof canonicalIntentValues)[number])
      ? trimmed
      : null;
  }

  const maxLengthByField: Record<FrontOfficeLeadIntakeAiFieldKey, number> = {
    fullName: 80,
    phone: 40,
    email: 120,
    stage: 40,
    intent: 40,
    budgetMax: 20,
    preferredAreas: 160,
    nextFollowUpAt: 20,
    notes: 400,
  };

  return trimmed.slice(0, maxLengthByField[field]);
}

function isValidFieldKey(value: unknown): value is FrontOfficeLeadIntakeAiFieldKey {
  return (
    typeof value === "string" &&
    FRONT_OFFICE_LEAD_INTAKE_AI_FIELD_KEYS.includes(
      value as FrontOfficeLeadIntakeAiFieldKey,
    )
  );
}

function isValidProvenance(value: unknown): value is FrontOfficeLeadIntakeAiProvenance {
  return (
    value === "explicit_line" ||
    value === "pattern_match" ||
    value === "conversation_inference" ||
    value === "summary_preview"
  );
}

function normalizeRiskFlags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value)]
    .filter(
      (item): item is FrontOfficeLeadIntakeAiRiskFlag =>
        typeof item === "string" &&
        FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS.includes(
          item as FrontOfficeLeadIntakeAiRiskFlag,
        ),
    )
    .slice(0, 6);
}

function coerceFieldSuggestion(
  payload: OpenAiFieldPayload,
): FrontOfficeLeadIntakeAiFieldSuggestion | null {
  if (!isValidFieldKey(payload.field) || typeof payload.value !== "string") {
    return null;
  }

  const normalizedValue = normalizeFieldValue(payload.field, payload.value);

  if (!normalizedValue) {
    return null;
  }

  const evidence =
    typeof payload.evidence === "string" && payload.evidence.trim()
      ? normalizeCompactText(payload.evidence).slice(0, 220)
      : normalizedValue;
  const provenance = isValidProvenance(payload.provenance)
    ? payload.provenance
    : payload.field === "notes"
      ? "summary_preview"
      : "conversation_inference";

  return {
    field: payload.field,
    value: normalizedValue,
    evidence,
    provenance,
    explicit: payload.explicit === true,
    riskFlags: normalizeRiskFlags(payload.riskFlags),
  };
}

function parseJsonResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const textChunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content ?? [])
      : [];

    for (const contentItem of content) {
      if (
        contentItem &&
        typeof contentItem === "object" &&
        typeof (contentItem as { text?: unknown }).text === "string"
      ) {
        textChunks.push((contentItem as { text: string }).text);
      }
    }
  }

  return textChunks.join("\n").trim();
}

function parseExtractionPayload(
  payload: Record<string, unknown>,
  model: string,
): FrontOfficeLeadIntakeAiExtraction | null {
  const rawJson = parseJsonResponseText(payload);

  if (!rawJson) {
    return null;
  }

  let parsed: OpenAiExtractionPayload;

  try {
    parsed = JSON.parse(rawJson) as OpenAiExtractionPayload;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed.fields)) {
    return null;
  }

  const seen = new Set<FrontOfficeLeadIntakeAiFieldKey>();
  const fields = parsed.fields
    .flatMap((item) =>
      item && typeof item === "object"
        ? [coerceFieldSuggestion(item as OpenAiFieldPayload)]
        : [],
    )
    .filter(
      (field): field is FrontOfficeLeadIntakeAiFieldSuggestion =>
        field !== null,
    )
    .filter((field) => {
      if (seen.has(field.field)) {
        return false;
      }

      seen.add(field.field);
      return true;
    });

  if (!fields.length) {
    return null;
  }

  return {
    provider: "openai",
    model,
    fields,
  };
}

function buildImageDataUrl(image: Blob, fallbackMimeType = "image/png") {
  return image.arrayBuffer().then((buffer) => {
    const mimeType =
      typeof image.type === "string" && image.type.trim()
        ? image.type
        : fallbackMimeType;
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${mimeType};base64,${base64}`;
  });
}

function buildUserPrompt(input: ExtractWithOpenAiInput) {
  const textParts = [
    input.transcriptText ? `Transcript:\n${input.transcriptText}` : "",
    input.ocrText ? `OCR text:\n${input.ocrText}` : "",
    input.rawText ? `Combined intake text:\n${input.rawText}` : "",
  ].filter(Boolean);

  return [
    "Extract conservative front-office lead intake suggestions from the provided text and optional screenshot.",
    "Only return fields when the evidence is genuinely present.",
    "If identity is ambiguous, still return the candidate value but mark review risk flags.",
    "Use only the allowed canonical values for stage and intent.",
    textParts.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAiPreviewText(fields: FrontOfficeLeadIntakeAiFieldSuggestion[]) {
  const labels: Record<FrontOfficeLeadIntakeAiFieldKey, string> = {
    fullName: "Name",
    phone: "Phone",
    email: "Email",
    stage: "Stage",
    intent: "Intent",
    budgetMax: "Budget",
    preferredAreas: "Areas",
    nextFollowUpAt: "Next follow-up",
    notes: "Notes",
  };

  return fields
    .map((field) => `${labels[field.field]}: ${field.value}`)
    .join("\n");
}

export function canUseFrontOfficeLeadIntakeOpenAi() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function extractFrontOfficeLeadIntakeWithOpenAi(
  input: ExtractWithOpenAiInput,
): Promise<FrontOfficeLeadIntakeAiExtraction | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const model = resolveOpenAiIntakeAssistModel();

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildUserPrompt(input),
    },
  ];

  if (input.image) {
    content.push({
      type: "input_image",
      image_url: await buildImageDataUrl(input.image),
    });
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You extract structured lead-intake suggestions for a human review queue.",
                "Do not invent missing facts.",
                "Return only valid JSON matching the schema.",
                "Allowed field keys: fullName, phone, email, stage, intent, budgetMax, preferredAreas, nextFollowUpAt, notes.",
                `Allowed stage values: ${canonicalStageValues.join(", ")}.`,
                `Allowed intent values: ${canonicalIntentValues.join(", ")}.`,
                `Allowed risk flags: ${FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS.join(", ")}.`,
                "Use summary_preview only for notes. Use YYYY-MM-DD for nextFollowUpAt. Use digits only for budgetMax.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content,
        },
      ],
      max_output_tokens: 1200,
      text: {
        format: {
          type: "json_schema",
          name: "front_office_lead_intake_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              fields: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    field: {
                      type: "string",
                      enum: [...FRONT_OFFICE_LEAD_INTAKE_AI_FIELD_KEYS],
                    },
                    value: {
                      type: "string",
                    },
                    evidence: {
                      type: "string",
                    },
                    provenance: {
                      type: "string",
                      enum: [
                        "explicit_line",
                        "pattern_match",
                        "conversation_inference",
                        "summary_preview",
                      ],
                    },
                    explicit: {
                      type: "boolean",
                    },
                    riskFlags: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [...FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS],
                      },
                    },
                  },
                  required: [
                    "field",
                    "value",
                    "evidence",
                    "provenance",
                    "explicit",
                    "riskFlags",
                  ],
                },
              },
            },
            required: ["fields"],
          },
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!payload) {
    return null;
  }

  return parseExtractionPayload(payload, model);
}

export function buildFrontOfficeLeadIntakeAiPreviewText(
  extraction: FrontOfficeLeadIntakeAiExtraction,
) {
  return buildAiPreviewText(extraction.fields);
}
