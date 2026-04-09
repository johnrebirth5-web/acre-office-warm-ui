import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES,
  extractFrontOfficeLeadIntakeAssistServer,
  readFrontOfficeLeadIntakeAssistServerFormData,
  validateFrontOfficeLeadIntakeAssistServerInput,
} from "./front-office-intake-assist-server";

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
    provider: "local_tesseract",
    mode: "server_side",
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
    provider: "local_tesseract",
    mode: "server_side",
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
    provider: "local_tesseract",
    mode: "server_side",
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
    provider: "local_tesseract",
    mode: "server_side",
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
    provider: "local_tesseract",
    mode: "server_side",
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
