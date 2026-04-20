type ParseFrontOfficeEventDraftInput = {
  rawText: string;
  fetchImpl?: typeof fetch;
};

export type FrontOfficeEventParseDraft = {
  title: string | null;
  description: string | null;
  eventType: "activity" | "training" | "admin" | null;
  area: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isOnline: boolean | null;
  meetingUrl: string | null;
  meetingPassword: string | null;
  recurrenceHint: "weekly_thursday" | "monthly_first_friday" | null;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function resolveOpenAiEventAssistModel() {
  return process.env.OPENAI_INTAKE_ASSIST_MODEL?.trim() || "gpt-5.4-mini";
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeDateTimeValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : /^[^\s/]+\.[^\s]+(?:\/.*)?$/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeEventType(value: string | null | undefined) {
  switch (value?.trim()) {
    case "training":
    case "admin":
    case "activity":
      return value.trim() as FrontOfficeEventParseDraft["eventType"];
    default:
      return null;
  }
}

function normalizeRecurrenceHint(value: string | null | undefined) {
  switch (value?.trim()) {
    case "weekly_thursday":
    case "monthly_first_friday":
      return value.trim() as FrontOfficeEventParseDraft["recurrenceHint"];
    default:
      return null;
  }
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

function coerceEventParseDraft(
  payload: Record<string, unknown>,
): FrontOfficeEventParseDraft {
  return {
    title: normalizeText(
      typeof payload.title === "string" ? payload.title : null,
      120,
    ),
    description: normalizeText(
      typeof payload.description === "string" ? payload.description : null,
      1200,
    ),
    eventType: normalizeEventType(
      typeof payload.eventType === "string" ? payload.eventType : null,
    ),
    area: normalizeText(typeof payload.area === "string" ? payload.area : null, 160),
    location: normalizeText(
      typeof payload.location === "string" ? payload.location : null,
      240,
    ),
    startsAt: normalizeDateTimeValue(
      typeof payload.startsAt === "string" ? payload.startsAt : null,
    ),
    endsAt: normalizeDateTimeValue(
      typeof payload.endsAt === "string" ? payload.endsAt : null,
    ),
    isOnline:
      typeof payload.isOnline === "boolean" ? payload.isOnline : null,
    meetingUrl: normalizeUrl(
      typeof payload.meetingUrl === "string" ? payload.meetingUrl : null,
    ),
    meetingPassword: normalizeText(
      typeof payload.meetingPassword === "string"
        ? payload.meetingPassword
        : null,
      80,
    ),
    recurrenceHint: normalizeRecurrenceHint(
      typeof payload.recurrenceHint === "string"
        ? payload.recurrenceHint
        : null,
    ),
  };
}

export function canUseFrontOfficeEventOpenAi() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function parseFrontOfficeEventDraftWithOpenAi(
  input: ParseFrontOfficeEventDraftInput,
): Promise<FrontOfficeEventParseDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  const rawText = input.rawText.trim();

  if (!rawText) {
    return null;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveOpenAiEventAssistModel(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You extract a structured shared-event draft for a human review workflow.",
                "Do not invent missing facts.",
                "Return only valid JSON that matches the schema.",
                "Allowed eventType values: activity, training, admin.",
                "Allowed recurrenceHint values: weekly_thursday, monthly_first_friday.",
                "Use ISO 8601 datetimes when a date or time is present.",
                "Leave unknown fields null.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: rawText,
            },
          ],
        },
      ],
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "front_office_event_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              eventType: {
                type: ["string", "null"],
                enum: ["activity", "training", "admin", null],
              },
              area: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              startsAt: { type: ["string", "null"] },
              endsAt: { type: ["string", "null"] },
              isOnline: { type: ["boolean", "null"] },
              meetingUrl: { type: ["string", "null"] },
              meetingPassword: { type: ["string", "null"] },
              recurrenceHint: {
                type: ["string", "null"],
                enum: ["weekly_thursday", "monthly_first_friday", null],
              },
            },
            required: [
              "title",
              "description",
              "eventType",
              "area",
              "location",
              "startsAt",
              "endsAt",
              "isOnline",
              "meetingUrl",
              "meetingPassword",
              "recurrenceHint",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const jsonText = parseJsonResponseText(payload);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return coerceEventParseDraft(parsed);
  } catch {
    return null;
  }
}
