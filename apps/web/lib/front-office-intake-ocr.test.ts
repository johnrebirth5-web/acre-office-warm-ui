import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import {
  normalizeFrontOfficeLeadIntakeOcrText,
  resolveFrontOfficeLeadIntakeOcrNodeWorkerPath,
} from "./front-office-intake-ocr";

test("resolves the node worker path for local tesseract OCR", () => {
  const workerPath = resolveFrontOfficeLeadIntakeOcrNodeWorkerPath();

  assert.equal(workerPath.endsWith("tesseract.js/src/worker-script/node/index.js"), true);
  assert.equal(existsSync(workerPath), true);
});

test("normalizes OCR line endings and trims whitespace", () => {
  assert.equal(
    normalizeFrontOfficeLeadIntakeOcrText("  Jamie  \r\n  Chen \r\n\n  LIC "),
    "Jamie\nChen\n\nLIC",
  );
});
