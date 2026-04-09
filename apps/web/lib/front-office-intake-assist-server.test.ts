import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractFrontOfficeLeadIntakeAssistServer,
  readFrontOfficeLeadIntakeAssistServerFormData,
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
  assert.equal(
    result.rawText,
    "Client text line 1\nClient text line 2\n\nOCR line 1\nOCR line 2\nOCR line 3",
  );
});

