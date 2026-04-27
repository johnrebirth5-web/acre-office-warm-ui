import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSessionSecret } from "./auth-session-config";

const quickBooksStateMaxAgeMs = 10 * 60 * 1000;

export type QuickBooksOAuthStatePayload = {
  organizationId: string;
  membershipId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signState(serializedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(serializedPayload).digest("base64url");
}

function assertValidSignature(serializedPayload: string, signature: string) {
  const expectedSignature = signState(serializedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error("QuickBooks OAuth state is invalid.");
  }
}

export function createQuickBooksOAuthState(input: {
  organizationId: string;
  membershipId: string;
}) {
  const now = Date.now();
  const payload: QuickBooksOAuthStatePayload = {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    nonce: randomBytes(18).toString("base64url"),
    issuedAt: now,
    expiresAt: now + quickBooksStateMaxAgeMs
  };
  const serializedPayload = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(serializedPayload);

  return `${encodedPayload}.${signState(serializedPayload)}`;
}

export function verifyQuickBooksOAuthState(state: string) {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("QuickBooks OAuth state is missing.");
  }

  const serializedPayload = decodeBase64Url(encodedPayload);
  assertValidSignature(serializedPayload, signature);

  const payload = JSON.parse(serializedPayload) as Partial<QuickBooksOAuthStatePayload>;

  if (!payload.organizationId || !payload.membershipId || !payload.nonce || !payload.expiresAt) {
    throw new Error("QuickBooks OAuth state is incomplete.");
  }

  if (payload.expiresAt < Date.now()) {
    throw new Error("QuickBooks OAuth state expired. Start the connection again.");
  }

  return payload as QuickBooksOAuthStatePayload;
}
