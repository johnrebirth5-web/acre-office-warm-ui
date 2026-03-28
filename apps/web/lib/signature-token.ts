import { createHash, randomBytes } from "node:crypto";

export function hashSignatureToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function createSignatureToken() {
  const rawToken = randomBytes(32).toString("base64url");

  return {
    rawToken,
    tokenHash: hashSignatureToken(rawToken)
  };
}
