import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSignatureRequestReplyTo,
  resolveSignatureSenderDisplayName
} from "./signature-email.ts";

test("resolveSignatureSenderDisplayName trims explicit sender names before falling back", () => {
  assert.equal(resolveSignatureSenderDisplayName("  Morgan Lee  ", "Fallback Name"), "Morgan Lee");
});

test("resolveSignatureSenderDisplayName falls back to the computed sender name when blank", () => {
  assert.equal(resolveSignatureSenderDisplayName("   ", "  Avery Stone  "), "Avery Stone");
});

test("resolveSignatureSenderDisplayName uses the Acre fallback when no sender name is available", () => {
  assert.equal(resolveSignatureSenderDisplayName(null, "   "), "your Acre agent");
});

test("resolveSignatureRequestReplyTo trims whitespace and leaves blank values empty", () => {
  assert.equal(resolveSignatureRequestReplyTo("  ops@example.com  "), "ops@example.com");
  assert.equal(resolveSignatureRequestReplyTo("   "), null);
});
