import assert from "node:assert/strict";
import test from "node:test";
import { createSignatureToken, hashSignatureToken } from "./signature-token.ts";

test("hashSignatureToken trims surrounding whitespace before hashing", () => {
  assert.equal(hashSignatureToken("  example-token  "), hashSignatureToken("example-token"));
});

test("createSignatureToken returns a raw token and matching sha256 hash", () => {
  const { rawToken, tokenHash } = createSignatureToken();

  assert.ok(rawToken.length > 20);
  assert.match(rawToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(tokenHash, hashSignatureToken(rawToken));
});
