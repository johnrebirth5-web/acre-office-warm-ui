import assert from "node:assert/strict";
import test from "node:test";
import { ProjectSigningJobType } from "@prisma/client";
import {
  archiveSalesProject,
  buildProjectSignatureJobIdempotencyKey,
  canCreateProjectSigning,
  canManageProjectSigning,
  canViewProjectSigning,
  countAssignedProjectSigningFieldsForRecipient,
  createHashMismatchAuditDetails,
  createProjectSigningToken,
  deactivateProjectSigningTemplate,
  deleteUnusedProjectSigningTemplate,
  deleteUnusedSalesProject,
  findSimilarSalesProjects,
  hashProjectSigningToken,
  isProjectSigningAdmin,
  isProjectSigningManager,
  parseProjectSigningTokenPayload,
  sanitizeArchiveSinkEmails,
  unarchiveSalesProject,
  type ProjectSigningActorContext,
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

test("project signing assigned field counter matches recipient email or membership", () => {
  const recipient = {
    membershipId: null,
    normalizedEmail: "buyer@example.com",
    session: {
      documents: [
        {
          signatureRequest: {
            recipients: [
              {
                id: "signature-recipient-1",
                email: "Buyer@Example.com",
                membershipId: null,
              },
            ],
            fields: [
              {
                assignedRecipientId: "signature-recipient-1",
              },
              {
                assignedRecipientId: null,
              },
            ],
          },
        },
        {
          signatureRequest: {
            recipients: [
              {
                id: "signature-recipient-2",
                email: "other@example.com",
                membershipId: "membership-2",
              },
            ],
            fields: [
              {
                assignedRecipientId: "signature-recipient-2",
              },
            ],
          },
        },
      ],
    },
  };

  assert.equal(countAssignedProjectSigningFieldsForRecipient(recipient), 1);
  assert.equal(
    countAssignedProjectSigningFieldsForRecipient({
      ...recipient,
      membershipId: "membership-2",
      normalizedEmail: null,
    }),
    1,
  );
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

test("project signing role tier helpers map roles to admin or manager scopes", () => {
  assert.equal(isProjectSigningAdmin("owner"), true);
  assert.equal(isProjectSigningAdmin("office_admin"), true);
  assert.equal(isProjectSigningAdmin("team_lead"), false);
  assert.equal(isProjectSigningAdmin("office_manager"), true);
  assert.equal(isProjectSigningAdmin("agent"), false);

  function makeContext(overrides: Partial<ProjectSigningActorContext> = {}): ProjectSigningActorContext {
    return {
      organizationId: "org-1",
      officeId: null,
      viewerMembershipId: "membership-1",
      viewerRole: "agent",
      viewerPermissions: [],
      ...overrides,
    };
  }

  assert.equal(isProjectSigningManager(makeContext({ viewerRole: "team_lead" })), true);
  assert.equal(isProjectSigningManager(makeContext({ viewerRole: "office_manager" })), true);
  assert.equal(
    isProjectSigningManager(makeContext({ viewerRole: "agent", viewerPermissions: ["project_signing:manage"] })),
    true,
  );
  assert.equal(
    isProjectSigningManager(makeContext({ viewerRole: "agent", viewerPermissions: ["project_signing:archive_manage"] })),
    true,
  );
  assert.equal(isProjectSigningManager(makeContext({ viewerRole: "agent" })), false);
  assert.equal(isProjectSigningManager(makeContext({ viewerRole: "owner" })), false);
});

test("project signing permission helpers gate view, create, and manage by role", () => {
  assert.equal(canViewProjectSigning({ role: "owner" }), true);
  assert.equal(canViewProjectSigning({ role: "office_admin" }), true);
  assert.equal(canViewProjectSigning({ role: "agent" }), true);
  assert.equal(canViewProjectSigning({ role: "team_lead" }), true);

  assert.equal(canCreateProjectSigning({ role: "owner" }), true);
  assert.equal(canCreateProjectSigning({ role: "agent" }), true);

  assert.equal(canManageProjectSigning({ role: "owner" }), true);
  assert.equal(canManageProjectSigning({ role: "office_admin" }), true);
  assert.equal(canManageProjectSigning({ role: "team_lead" }), true);
  assert.equal(canManageProjectSigning({ role: "agent" }), false);
  assert.equal(
    canManageProjectSigning({
      role: "agent",
      permissions: ["documents:view", "signatures:view", "project_signing:view", "project_signing:manage"],
    }),
    true,
  );
  assert.equal(
    canManageProjectSigning({
      role: "agent",
      permissions: ["documents:view", "signatures:view", "signatures:manage"],
    }),
    true,
  );
});

test("sanitizeArchiveSinkEmails deduplicates, lowercases, and drops empty values", () => {
  assert.deepEqual(
    sanitizeArchiveSinkEmails([
      "Archive@Example.com",
      " archive@example.com ",
      "another@example.com",
      "",
      "  ",
      "ARCHIVE@example.com",
    ]),
    ["archive@example.com", "another@example.com"],
  );

  assert.deepEqual(sanitizeArchiveSinkEmails([]), []);
  assert.deepEqual(sanitizeArchiveSinkEmails(["", "   "]), []);
});

test("findSimilarSalesProjects short-circuits without hitting the DB when both code and name are empty", async () => {
  const result = await findSimilarSalesProjects({
    organizationId: "org-1",
    officeId: null,
    viewerMembershipId: "membership-1",
    viewerRole: "agent",
    viewerPermissions: [],
    code: "",
    name: "   ",
  });

  assert.deepEqual(result, []);
});

test("archiveSalesProject and unarchiveSalesProject reject viewers without manage permission before touching the DB", async () => {
  const baseContext: ProjectSigningActorContext = {
    organizationId: "org-1",
    officeId: null,
    viewerMembershipId: "membership-1",
    viewerRole: "agent",
    viewerPermissions: [],
  };

  await assert.rejects(
    () => archiveSalesProject({ ...baseContext, projectId: "project-1" }),
    /Project signing manage access required/,
  );

  await assert.rejects(
    () => unarchiveSalesProject({ ...baseContext, projectId: "project-1" }),
    /Project signing manage access required/,
  );
});

test("deleteUnusedSalesProject rejects viewers without manage permission before touching the DB", async () => {
  const baseContext: ProjectSigningActorContext = {
    organizationId: "org-1",
    officeId: null,
    viewerMembershipId: "membership-1",
    viewerRole: "agent",
    viewerPermissions: [],
  };

  await assert.rejects(
    () => deleteUnusedSalesProject({ ...baseContext, projectId: "project-1" }),
    /Project signing manage access required/,
  );
});

test("project signing template delete and deactivate reject viewers without create permission before touching the DB", async () => {
  const baseContext: ProjectSigningActorContext = {
    organizationId: "org-1",
    officeId: null,
    viewerMembershipId: "membership-1",
    viewerRole: "office_user",
    viewerPermissions: [],
  };

  await assert.rejects(
    () => deleteUnusedProjectSigningTemplate({ ...baseContext, templateId: "template-1" }),
    /Project signing create access required/,
  );
  await assert.rejects(
    () => deactivateProjectSigningTemplate({ ...baseContext, templateId: "template-1" }),
    /Project signing create access required/,
  );
});

test("project signing token payload version is what callers compare against recipient tokenVersion on resend", () => {
  // Token issued when recipient.tokenVersion = 3
  const oldToken = createProjectSigningToken({ recipientId: "recipient-1", version: 3 });
  // After resend, recipient.tokenVersion is bumped to 4; the old raw token still encodes 3
  const parsed = parseProjectSigningTokenPayload(oldToken.rawToken);
  assert.deepEqual(parsed, { recipientId: "recipient-1", version: 3 });
  // Contract: caller rejects when parsed.version !== recipient.tokenVersion
  assert.notEqual(parsed?.version, 4);
});
