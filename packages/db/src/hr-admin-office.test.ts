import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { SignatureContextType } from "@prisma/client";
import { prisma } from "./client.ts";
import {
  createAdminEmailRequest,
  updateAdminEmailRequestStatus,
} from "./admin-email-requests.ts";
import {
  createAdminOfficeEvent,
  exportAdminOfficeEventSignupsCsv,
  getAdminOfficeEventSignupSnapshot,
  signupForAdminOfficeEvent,
} from "./admin-office-events.ts";
import {
  createHrCandidate,
  updateHrCandidate,
} from "./hr-candidates.ts";
import { createHrChecklistInstance, updateHrChecklistItemStatus } from "./hr-checklists.ts";
import { createHrInterview } from "./hr-interviews.ts";
import {
  createHrOnboardingCase,
  issueHrOnboardingToken,
  resolveHrOnboardingToken,
} from "./hr-onboarding.ts";
import {
  generateOfflineInterviewConfirmationEmail,
  generateTerminationLetterDraft,
  generateWelcomeEmail,
} from "./hr-ai.ts";
import {
  createContextSignatureRequest,
  createStandaloneSignatureArtifact,
} from "./signature-context.ts";

after(async () => {
  await prisma.$disconnect();
});

async function createHrAdminOfficeTestContext() {
  const suffix = randomUUID().slice(0, 8);
  const organization = await prisma.organization.create({
    data: {
      name: `HR Admin Test ${suffix}`,
      slug: `hr-admin-test-${suffix}`,
    },
  });
  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      name: `HR Admin Office ${suffix}`,
      slug: `hr-admin-office-${suffix}`,
      market: "New York",
      isPrimary: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `hr-admin-${suffix}@example.com`,
      firstName: "HR",
      lastName: "Admin",
      timezone: "America/New_York",
      locale: "en-US",
      isActive: true,
    },
  });
  const membership = await prisma.membership.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      userId: user.id,
      role: "human_resources",
      status: "active",
      title: "HR",
    },
  });

  return {
    organization,
    office,
    user,
    membership,
    async cleanup() {
      await prisma.organization.delete({ where: { id: organization.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    },
  };
}

test("HR candidate status progression and Google interview failure degrade without blocking", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const candidate = await createHrCandidate({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      fullName: "Jamie Candidate",
      email: "jamie.candidate@example.com",
      phone: "212-555-0100",
      positionTitle: "Sales Assistant",
      identityType: "f1_opt",
    });

    assert.equal(candidate.statusKey, "applied");
    assert.equal(candidate.identityType, "f1_opt");

    const updated = await updateHrCandidate({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      candidateId: candidate.id,
      status: "screening",
    });

    assert.equal(updated?.statusKey, "screening");

    const interview = await createHrInterview({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      candidateId: candidate.id,
      mode: "online",
      startsAt: "2026-05-20T15:00:00.000Z",
      attendeeEmails: ["jamie.candidate@example.com"],
      interviewerNames: ["HR Admin"],
    });

    assert.equal(interview.googleSyncState, "sync_failed");
    assert.equal(interview.trackerSyncState, "not_applicable");
  } finally {
    await context.cleanup();
  }
});

test("HR onboarding tokens are hashed, non-enumerable, and checklist items can complete and reopen", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const candidate = await createHrCandidate({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      fullName: "Onboard Person",
      email: "onboard.person@example.com",
    });
    const onboardingCase = await createHrOnboardingCase({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      candidateId: candidate.id,
    });
    const issued = await issueHrOnboardingToken({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      caseId: onboardingCase.id,
    });

    assert.match(issued.publicUrl, /^\/onboarding\//);
    assert.equal(await resolveHrOnboardingToken("bad-token"), null);
    const publicSnapshot = await resolveHrOnboardingToken(issued.token);
    assert.equal(publicSnapshot?.candidateEmail, "onboard.person@example.com");

    const checklist = await createHrChecklistInstance({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      title: "Onboarding checklist",
      caseType: "onboarding",
      onboardingCaseId: onboardingCase.id,
      items: ["Offer signed"],
    });
    const item = checklist.items[0]!;

    const completed = await updateHrChecklistItemStatus({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      itemId: item.id,
      completed: true,
    });
    assert.equal(completed?.status, "completed");

    const reopened = await updateHrChecklistItemStatus({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      itemId: item.id,
      completed: false,
    });
    assert.equal(reopened?.status, "reopened");
  } finally {
    await context.cleanup();
  }
});

test("AI HR helpers return draft content only", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const offline = await generateOfflineInterviewConfirmationEmail({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      contextId: "candidate-1",
      candidateName: "Jamie",
      interviewTime: "May 20, 2026 11:00 AM",
      location: "Main Office",
      interviewerNames: ["HR Admin"],
    });
    const welcome = await generateWelcomeEmail({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      contextId: "case-1",
      candidateName: "Jamie",
      companyName: "Acre",
      startDate: "May 25, 2026",
    });
    const termination = await generateTerminationLetterDraft({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      contextId: "offboarding-1",
      employeeName: "Jamie",
      companyName: "Acre",
      lastWorkingDate: "May 30, 2026",
    });

    assert.equal(offline.draftOnly, true);
    assert.equal(welcome.draftOnly, true);
    assert.equal(termination.draftOnly, true);
    assert.match(offline.subject, /Interview confirmation/);
  } finally {
    await context.cleanup();
  }
});

test("Admin Office email requests approve, complete, and reject through explicit statuses", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const request = await createAdminEmailRequest({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      fullName: "Email Person",
      preferredEmailPrefix: "email.person",
    });
    assert.equal(request.status, "pending");

    const approved = await updateAdminEmailRequestStatus({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      requestId: request.id,
      status: "approved",
    });
    assert.equal(approved?.status, "approved");

    const completed = await updateAdminEmailRequestStatus({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      requestId: request.id,
      status: "completed",
    });
    assert.equal(completed?.status, "completed");

    const rejected = await updateAdminEmailRequestStatus({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      requestId: request.id,
      status: "rejected",
    });
    assert.equal(rejected?.status, "rejected");
  } finally {
    await context.cleanup();
  }
});

test("Admin Office events reuse Event/Rsvp for signup and CSV export", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const event = await createAdminOfficeEvent({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      title: "Broker Tour",
      eventType: "broker_tour",
      startsAt: "2026-05-21T15:00:00.000Z",
      location: "Main Office",
      signupRequired: true,
      capacity: 10,
    });

    await signupForAdminOfficeEvent({
      organizationId: context.organization.id,
      eventId: event.id,
      membershipId: context.membership.id,
    });

    const snapshot = await getAdminOfficeEventSignupSnapshot({
      organizationId: context.organization.id,
      eventId: event.id,
    });
    assert.equal(snapshot?.event.eventType, "broker_tour");
    assert.equal(snapshot?.signups.length, 1);
    assert.equal(snapshot?.signups[0]?.email, context.user.email);

    const csv = await exportAdminOfficeEventSignupsCsv({
      organizationId: context.organization.id,
      actorMembershipId: context.membership.id,
      eventId: event.id,
    });
    assert.match(csv ?? "", /hr-admin-/);
    assert.match(csv ?? "", /going/);
  } finally {
    await context.cleanup();
  }
});

test("non-transaction signature requests use HR context and standalone artifacts", async () => {
  const context = await createHrAdminOfficeTestContext();

  try {
    const request = await createContextSignatureRequest({
      organizationId: context.organization.id,
      officeId: context.office.id,
      actorMembershipId: context.membership.id,
      contextType: SignatureContextType.hr_onboarding,
      contextId: "onboarding-case-1",
      contextLabel: "Onboarding Case",
      title: "Offer Letter",
      fileName: "offer-letter.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 12,
      storageKey: "hr/onboarding/offer-letter.pdf",
      recipientName: "Signer",
      recipientEmail: "signer@example.com",
    });

    assert.ok(request);
    assert.equal(request.transactionId, null);
    assert.equal(request.contextType, "hr_onboarding");
    assert.equal(request.contextId, "onboarding-case-1");

    const signedArtifact = await createStandaloneSignatureArtifact({
      organizationId: context.organization.id,
      officeId: context.office.id,
      signatureRequestId: request.id,
      title: "Offer Letter · signed",
      fileName: "offer-letter-signed.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 20,
      storageKey: "hr/onboarding/offer-letter-signed.pdf",
    });
    assert.equal(signedArtifact.transactionId, null);
    assert.equal(signedArtifact.kind, "signed_copy");

    const stored = await prisma.signatureRequest.findUnique({
      where: { id: request.id },
      include: { artifacts: true },
    });
    assert.equal(stored?.transactionId, null);
    assert.equal(stored?.artifacts.some((artifact) => artifact.kind === "original"), true);
    assert.equal(stored?.artifacts.some((artifact) => artifact.kind === "signed_copy"), true);
  } finally {
    await context.cleanup();
  }
});
