import assert from "node:assert/strict";
import test from "node:test";
import { ProjectSigningJobType } from "@prisma/client";
import {
  buildProjectSignatureJobIdempotencyKey,
  createHashMismatchAuditDetails,
  createProjectSigningToken,
  hashProjectSigningToken,
  parseProjectSigningTokenPayload,
} from "./project-signing.ts";

test("project signing tokens carry recipient id and token version", () => {
  const token = createProjectSigningToken({
    recipientId: "recipient-1",
    version: 3,
  });

  assert.equal(hashProjectSigningToken(token.rawToken), token.tokenHash);
  assert.deepEqual(parseProjectSigningTokenPayload(token.rawToken), {
    recipientId: "recipient-1",
    version: 3,
  });
});

test("project signing token parser rejects missing or invalid versions", () => {
  const missingVersion = `v1.${Buffer.from(JSON.stringify({ recipientId: "recipient-1" })).toString("base64url")}.nonce`;
  const negativeVersion = `v1.${Buffer.from(JSON.stringify({ recipientId: "recipient-1", version: -1 })).toString("base64url")}.nonce`;

  assert.equal(parseProjectSigningTokenPayload(missingVersion), null);
  assert.equal(parseProjectSigningTokenPayload(negativeVersion), null);
  assert.equal(parseProjectSigningTokenPayload("not-a-token"), null);
});

test("project signature job idempotency keys follow the durable naming contract", () => {
  assert.equal(
    buildProjectSignatureJobIdempotencyKey({
      type: ProjectSigningJobType.finalize_pdf,
      sessionDocumentId: "session-document-1",
    }),
    "finalize_pdf:session-document-1",
  );
  assert.equal(
    buildProjectSignatureJobIdempotencyKey({
      type: ProjectSigningJobType.send_completion_email,
      distributionId: "distribution-1",
    }),
    "send_email:distribution-1",
  );
  assert.equal(
    buildProjectSignatureJobIdempotencyKey({
      type: ProjectSigningJobType.drive_sync,
      signatureArtifactId: "artifact-1",
    }),
    "drive_sync:artifact-1",
  );
  assert.equal(
    buildProjectSignatureJobIdempotencyKey({
      type: ProjectSigningJobType.send_completion_email,
      distributionId: "distribution-1",
      resendCount: 2,
    }),
    "send_email:distribution-1:resend:2",
  );
});

test("hash mismatch audit details keep artifact hash as the comparison contract", () => {
  const details = createHashMismatchAuditDetails({
    expected: "artifact-hash",
    actual: "downloaded-hash",
    source: "signature_artifact",
  });

  assert.equal(details.expected, "artifact-hash");
  assert.equal(details.actual, "downloaded-hash");
  assert.equal(details.source, "signature_artifact");
  assert.match(details.eventId, /^[0-9a-f-]{36}$/i);
});
