import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
  extractFrontOfficeLeadIntakeAssistServer,
  readFrontOfficeLeadIntakeAssistServerFormData,
  validateFrontOfficeLeadIntakeAssistServerInput,
} from "./front-office-intake-assist-server";
import { resolveFrontOfficeLeadIntakeOcrContract } from "./front-office-intake-ocr";
import type { FrontOfficeLeadIntakeAiExtraction } from "./front-office-intake-ai";

test("reads intake server form data with transcript and image", () => {
  const formData = new FormData();
  formData.append("transcript", "  Alice / 555-0100  ");
  formData.append(
    "image",
    new Blob(["fake image bytes"], { type: "image/png" }),
    "lead.png",
  );
  formData.append("sourceSurface", "dashboard");

  const result = readFrontOfficeLeadIntakeAssistServerFormData(formData);

  assert.equal(result.transcriptText, "Alice / 555-0100");
  assert.ok(result.image instanceof Blob);
  assert.equal(result.sourceSurface, "dashboard");
});

test("extracts transcript-only payload without calling OCR", async () => {
  let recognizeCalls = 0;

  const result = await extractFrontOfficeLeadIntakeAssistServer({
    transcriptText: "  Alice / 555-0100\nBuyer follow-up on Thursday  ",
    recognizeImage: async () => {
      recognizeCalls += 1;
      return "should not run";
    },
  });

  assert.equal(recognizeCalls, 0);
  assert.equal(result.sourceMode, "text");
  assert.equal(result.hadImage, false);
  assert.equal(result.ocrSucceeded, false);
  assert.deepEqual(result.metadata.ocr, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    providerChain: ["local_tesseract"],
    provider: "local_tesseract",
    resolverMode: "local_only",
    attempted: false,
    succeeded: false,
    fallback: "none",
  });
  assert.equal(result.metadata.provenance.transcript.present, true);
  assert.equal(result.metadata.provenance.image.present, false);
  assert.equal(result.metadata.provenance.rawText.sourceMode, "text");
  assert.equal(result.metadata.provenance.rawText.transcriptIncluded, true);
  assert.equal(result.metadata.provenance.rawText.ocrIncluded, false);
  assert.equal(result.metadata.warnings.length, 0);
  assert.equal(
    result.rawText,
    "Alice / 555-0100\nBuyer follow-up on Thursday",
  );
});

test("combines transcript and server OCR into one hybrid extract", async () => {
  const result = await extractFrontOfficeLeadIntakeAssistServer({
    transcriptText: "Client text line 1\nClient text line 2",
    image: new Blob(["fake screenshot bytes"], { type: "image/png" }),
    recognizeImage: async () =>
      "OCR line 1\nOCR line 2\n  OCR line 3  ",
  });

  assert.equal(result.sourceMode, "hybrid");
  assert.equal(result.hadImage, true);
  assert.equal(result.ocrSucceeded, true);
  assert.equal(result.ocrText, "OCR line 1\nOCR line 2\nOCR line 3");
  assert.deepEqual(result.metadata.ocr, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    providerChain: ["local_tesseract"],
    provider: "local_tesseract",
    resolverMode: "local_only",
    attempted: true,
    succeeded: true,
    fallback: "none",
  });
  assert.equal(result.metadata.provenance.image.ocrAttempted, true);
  assert.equal(result.metadata.provenance.image.ocrSucceeded, true);
  assert.equal(result.metadata.provenance.rawText.sourceMode, "hybrid");
  assert.equal(result.metadata.provenance.rawText.transcriptIncluded, true);
  assert.equal(result.metadata.provenance.rawText.ocrIncluded, true);
  assert.equal(result.metadata.warnings.length, 0);
  assert.equal(
    result.rawText,
    "Client text line 1\nClient text line 2\n\nOCR line 1\nOCR line 2\nOCR line 3",
  );
});

test("prefers OpenAI image extraction before local OCR when the screenshot already yields fields", async () => {
  let recognizeCalls = 0;

  const result = await extractFrontOfficeLeadIntakeAssistServer({
    image: new Blob(["fake screenshot bytes"], { type: "image/png" }),
    recognizeImage: async () => {
      recognizeCalls += 1;
      return "OCR should not run";
    },
    extractWithOpenAi: async () =>
      ({
        provider: "openai",
        model: "gpt-5.4-mini",
        fields: [
          {
            field: "fullName",
            value: "Jamie Chen",
            evidence: "Name shown in the screenshot thread.",
            provenance: "conversation_inference",
            explicit: false,
            riskFlags: [],
          },
          {
            field: "budgetMax",
            value: "5500",
            evidence: "Budget up to $5,500.",
            provenance: "conversation_inference",
            explicit: false,
            riskFlags: [],
          },
        ],
      }) satisfies FrontOfficeLeadIntakeAiExtraction,
  });

  assert.equal(recognizeCalls, 0);
  assert.equal(result.sourceMode, "image");
  assert.equal(result.hadImage, true);
  assert.equal(result.ocrSucceeded, false);
  assert.equal(result.transcriptFallbackUsed, false);
  assert.equal(result.metadata.provenance.image.ocrAttempted, false);
  assert.equal(result.metadata.provenance.image.ocrSucceeded, false);
  assert.deepEqual(result.metadata.warnings, []);
  assert.equal(result.rawText, "Name: Jamie Chen\nBudget: 5500");
});

test("rejects empty payloads before OCR work starts", () => {
  const validation = validateFrontOfficeLeadIntakeAssistServerInput({
    transcriptText: "   ",
    image: null,
    sourceSurface: "dashboard",
  });

  assert.equal(validation.issue?.status, 400);
  assert.equal(
    validation.issue?.error,
    "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
  );
  assert.deepEqual(validation.metadata.ocr, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    providerChain: ["local_tesseract"],
    provider: "local_tesseract",
    resolverMode: "local_only",
    attempted: false,
    succeeded: false,
    fallback: "none",
  });
  assert.equal(validation.metadata.provenance.transcript.present, false);
  assert.equal(validation.metadata.provenance.image.present, false);
  assert.deepEqual(
    validation.metadata.warnings.map((warning) => warning.code),
    ["empty_payload"],
  );
});

test("rejects oversized screenshots before OCR work starts", () => {
  const validation = validateFrontOfficeLeadIntakeAssistServerInput({
    transcriptText: "",
    image: new Blob(
      [
        new Uint8Array(FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES + 1),
      ],
      {
        type: "image/png",
      },
    ),
    sourceSurface: "dashboard",
  });

  assert.equal(validation.issue?.status, 413);
  assert.equal(
    validation.issue?.error,
    "That screenshot is too large for local OCR. Try a tighter crop under 10 MB.",
  );
  assert.deepEqual(validation.metadata.ocr, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    providerChain: ["local_tesseract"],
    provider: "local_tesseract",
    resolverMode: "local_only",
    attempted: false,
    succeeded: false,
    fallback: "none",
  });
  assert.equal(validation.metadata.provenance.image.present, true);
  assert.equal(validation.metadata.provenance.image.ocrAttempted, false);
  assert.deepEqual(
    validation.metadata.warnings.map((warning) => warning.code),
    ["oversized_image"],
  );
});

test("uses the transcript as a fallback when OCR fails on a hybrid payload", async () => {
  const result = await extractFrontOfficeLeadIntakeAssistServer({
    transcriptText: "Chat text line 1\nChat text line 2",
    image: new Blob(["fake screenshot bytes"], { type: "image/png" }),
    recognizeImage: async () => {
      throw new Error("OCR unavailable");
    },
  });

  assert.equal(result.sourceMode, "hybrid");
  assert.equal(result.hadImage, true);
  assert.equal(result.ocrSucceeded, false);
  assert.equal(result.transcriptFallbackUsed, true);
  assert.deepEqual(result.metadata.ocr, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    providerChain: ["local_tesseract"],
    provider: "local_tesseract",
    resolverMode: "local_only",
    attempted: true,
    succeeded: false,
    fallback: "transcript",
  });
  assert.equal(result.metadata.provenance.rawText.fallbackUsed, true);
  assert.deepEqual(
    result.metadata.warnings.map((warning) => warning.code),
    ["ocr_failed", "transcript_fallback"],
  );
  assert.equal(result.rawText, "Chat text line 1\nChat text line 2");
});

test("retries OpenAI after OCR fallback adds readable text for a screenshot-only payload", async () => {
  let recognizeCalls = 0;
  const openAiPayloads: string[] = [];

  const result = await extractFrontOfficeLeadIntakeAssistServer({
    image: new Blob(["fake screenshot bytes"], { type: "image/png" }),
    recognizeImage: async () => {
      recognizeCalls += 1;
      return "Buyer from WeChat. Jamie Chen wants LIC. Budget up to $5,500.";
    },
    extractWithOpenAi: async ({ rawText, ocrText }) => {
      openAiPayloads.push(`${rawText}__OCR__${ocrText}`);

      if (!ocrText) {
        return null;
      }

      return {
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
        ],
      };
    },
  });

  assert.equal(recognizeCalls, 1);
  assert.equal(openAiPayloads.length, 2);
  assert.equal(result.ocrSucceeded, true);
  assert.equal(result.metadata.provenance.image.ocrAttempted, true);
  assert.equal(result.metadata.provenance.image.ocrSucceeded, true);
  assert.equal(
    result.rawText,
    "Buyer from WeChat. Jamie Chen wants LIC. Budget up to $5,500.",
  );
  assert.deepEqual(result.aiExtraction, {
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
    ],
  });
});

test("resolves a local-only OCR contract with a single provider chain", () => {
  const contract = resolveFrontOfficeLeadIntakeOcrContract();

  assert.deepEqual(contract, {
    capability: {
      resolverMode: "local_only",
      providerBacked: false,
      providerChain: ["local_tesseract"],
      maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      fallbackStory: "transcript_fallback",
    },
    selectedProvider: "local_tesseract",
  });
});
