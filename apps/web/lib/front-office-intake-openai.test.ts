import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFrontOfficeLeadIntakeWithOpenAi,
} from "./front-office-intake-openai";

test("returns null when OPENAI_API_KEY is not configured", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await extractFrontOfficeLeadIntakeWithOpenAi({
      rawText: "Name: Jamie Chen",
      transcriptText: "Name: Jamie Chen",
      ocrText: "",
      image: null,
      sourceMode: "text",
      fetchImpl: async () => {
        throw new Error("fetch should not be called without a key");
      },
    });

    assert.equal(result, null);
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

test("coerces a valid OpenAI extraction response into intake field suggestions", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_INTAKE_ASSIST_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_INTAKE_ASSIST_MODEL = "gpt-5.4-mini";

  try {
    let requestedModel = "";
    const result = await extractFrontOfficeLeadIntakeWithOpenAi({
      rawText: "Buyer from WeChat. Jamie Chen wants LIC. Budget up to $5500.",
      transcriptText:
        "Buyer from WeChat. Jamie Chen wants LIC. Budget up to $5500.",
      ocrText: "",
      image: null,
      sourceMode: "text",
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          model?: string;
        };
        requestedModel = body.model ?? "";

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              fields: [
                {
                  field: "fullName",
                  value: "Jamie Chen",
                  evidence: "Jamie Chen wants LIC.",
                  provenance: "conversation_inference",
                  explicit: false,
                  riskFlags: [],
                },
                {
                  field: "budgetMax",
                  value: "$5,500",
                  evidence: "Budget up to $5500.",
                  provenance: "conversation_inference",
                  explicit: false,
                  riskFlags: [],
                },
                {
                  field: "nextFollowUpAt",
                  value: "next week",
                  evidence: "tour next week",
                  provenance: "conversation_inference",
                  explicit: false,
                  riskFlags: ["relative_timing"],
                },
              ],
            }),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    });

    assert.equal(requestedModel, "gpt-5.4-mini");
    assert.deepEqual(result, {
      provider: "openai",
      model: "gpt-5.4-mini",
      fields: [
        {
          field: "fullName",
          value: "Jamie Chen",
          evidence: "Jamie Chen wants LIC.",
          provenance: "conversation_inference",
          explicit: false,
          riskFlags: [],
        },
        {
          field: "budgetMax",
          value: "5500",
          evidence: "Budget up to $5500.",
          provenance: "conversation_inference",
          explicit: false,
          riskFlags: [],
        },
      ],
    });
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }

    if (previousModel === undefined) {
      delete process.env.OPENAI_INTAKE_ASSIST_MODEL;
    } else {
      process.env.OPENAI_INTAKE_ASSIST_MODEL = previousModel;
    }
  }
});
